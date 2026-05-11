# TDD: Backend Proxy

## Feature Summary
A single-purpose Node.js/Express server deployed on Fly.io. Exists solely to proxy LLM requests to OpenRouter without exposing the API key to the client. Middleware stack: Firebase token verification → rate limiting (50 calls/device/day) → relay to OpenRouter → return JSON. Must be kept thin — no business logic, no database, no additional features.

---

## Data Flow

```
Client POST /api/parse
  { prompt: "string", device_id: "string" }
  Authorization: Bearer <firebase-id-token>
  │
  ▼
═══════════════════════════════════════════════════════
Layer 1: Express route
═══════════════════════════════════════════════════════
  │
  ▼
Validate request body:
  - prompt: required, string, 1-1000 chars
  - device_id: required, string, non-empty
  │
  ├── INVALID → 400 { error: "invalid_request", details: "..." }
  │
  └── VALID:
        │
        ▼
═══════════════════════════════════════════════════════
Layer 2: Firebase Auth middleware
═══════════════════════════════════════════════════════
  │
  ▼
Extract Bearer token from Authorization header
  │
  ├── MISSING → 401 { error: "missing_token" }
  │
  └── PRESENT:
        │
        ▼
      Verify token with Firebase Admin SDK:
        admin.auth().verifyIdToken(token)
        │
        ├── INVALID / EXPIRED / REVOKED → 401 { error: "invalid_token" }
        │
        └── VALID:
              │
              ▼
            Extract uid from decoded token (for logging/audit)
            Attach to req: req.user = { uid, email, ... }
            │
            ▼
═══════════════════════════════════════════════════════
Layer 3: Rate Limiter middleware
═══════════════════════════════════════════════════════
  │
  ▼
Key: device_id (from request body)
Strategy: sliding window or fixed window

For each device_id, track:
  - count: number of calls in current window
  - window_start: timestamp

  │
  ▼
Check: count < 50 ?
  │
  ├── YES → increment count, proceed
  │
  └── NO → 429 { error: "rate_limit_exceeded", retry_after: <seconds until reset> }
  │
  ▼
═══════════════════════════════════════════════════════
Layer 4: OpenRouter relay
═══════════════════════════════════════════════════════
  │
  ▼
Construct OpenRouter request:
  POST https://openrouter.ai/api/v1/chat/completions
  Headers:
    Authorization: Bearer <OPENROUTER_API_KEY>
    Content-Type: application/json
    HTTP-Referer: <app-identifier>
    X-Title: Calories App
  Body:
    {
      "model": "google/gemini-2.0-flash-001",
      "messages": [
        {
          "role": "system",
          "content": "You are a nutrition parser. Given a freeform text description of food and/or exercise, return a JSON object with two arrays: 'foods' and 'exercises'. For each food item: name, calories (kcal), protein_g, carbs_g, fat_g. For each exercise: type, duration_minutes, calories_burned. If nothing is recognized, return empty arrays. Output ONLY valid JSON, no markdown, no explanation."
        },
        {
          "role": "user",
          "content": "<the user's prompt>"
        }
      ],
      "temperature": 0.1,
      "max_tokens": 1000,
      "response_format": { "type": "json_object" }
    }
  │
  ▼
OpenRouter response received:
  │
  ├── TIMEOUT (10s) → 504 { error: "llm_timeout" }
  │
  ├── NON-200 → 502 { error: "llm_error", details: "..." }
  │
  └── 200 OK:
        │
        ▼
═══════════════════════════════════════════════════════
Layer 5: Response parsing & validation
═══════════════════════════════════════════════════════
  │
  ▼
Extract parsed JSON from OpenRouter response:
  choices[0].message.content → string

Parse JSON string:
  │
  ├── JSON.parse fails → 502 { error: "parse_failed", reason: "invalid_json" }
  │
  └── Valid JSON:
        │
        ▼
      Validate structure:
        {
          foods: Array<{
            name: string,
            calories: number,
            protein_g: number,
            carbs_g: number,
            fat_g: number
          }>,
          exercises: Array<{
            type: string,
            duration_minutes: number,
            calories_burned: number
          }>
        }
        │
        ├── STRUCTURE INVALID → 502 { error: "parse_failed", reason: "invalid_structure" }
        │
        └── VALID:
              │
              ▼
            Clean / sanitize:
              - Trim food/exercise names
              - Clamp negative values to 0
              - Round numeric values to reasonable precision
              - Ensure arrays exist (default to [])

            Return 200:
              {
                "foods": [...],
                "exercises": [...]
              }
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| Express.js | HTTP server, route handling, middleware chain | HTTP/HTTPS |
| Firebase Admin SDK (`firebase-admin`) | Verify Firebase ID tokens server-side | Google Cloud Identity Platform REST |
| OpenRouter API | LLM text-to-JSON parsing | HTTPS REST |
| In-memory store (Map / node-cache) | Rate limit counters per device_id | In-process memory |
| Fly.io | Hosting, HTTPS termination, auto-scaling | PaaS |
| (Optional) Redis / Upstash | Persist rate limit counters across Fly.io instance restarts (avoid cold-start reset) | TCP/TLS |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Rate limit counters (device_id → { count, window_start }) | In-memory Map (or Redis for persistence) | Lost on process restart (without Redis) |
| Firebase Auth verification cache | Firebase Admin SDK internal caching (token verification results cached for token's TTL) | Process memory |
| OpenRouter API key | Environment variable (Fly.io secrets) | Process lifetime |
| Firebase Admin service account credentials | Environment variable or mounted secret | Process lifetime |

---

## Background Jobs

| Job | Trigger | Behavior |
|---|---|---|
| Rate limit window cleanup | Periodic (every 5 minutes) via setInterval | Sweep in-memory rate limit store: remove entries with expired windows (outside current 24h window). Prevents memory leak from accumulating device_ids indefinitely. |
| Health check endpoint | Fly.io probes (GET /health) | Return 200 with uptime and OpenRouter connectivity status. Used for Fly.io auto-scaling and monitoring. |
| (Optional) Rate limit persistence | On rate limit counter update | If using Redis: sync counters so they survive process restart. Without persistence: counter resets on deploy/restart — user could get >50 calls. |

---

## Battery / Performance Impact

- **Battery**: Server-side only. No impact on client battery.
- **Performance** (per request):
  - Firebase token verification: <50ms (cached for subsequent requests with same token). First verification: 200-500ms (network call to Google).
  - Rate limit check: <1ms (in-memory Map lookup).
  - OpenRouter relay: 500ms-3s (dominates total latency). Gemini Flash is fast; worst-case with congestion: 5-10s.
  - Response parsing/validation: <5ms (trivial JSON manipulation).
  - Total p50 latency: ~1.5s. Total p95: ~4s.
- **Throughput**: Fly.io free tier: 3 shared CPU VMs, 256MB RAM each. Should handle ~50 concurrent requests easily (the app is rate-limited to 50/device/day, so even with 100 DAU, peak concurrent is manageable).
- **Cold starts**: Fly.io stops unused instances. First request after idle period: ~1-3s cold start (container boot + Firebase Admin init). Mitigation: Fly.io `min_machines = 1` on paid plan (keeps one instance warm). On free tier: accept cold starts.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **OpenRouter timeout** | OpenRouter congestion, network issue between Fly.io and OpenRouter | Parse request hangs, user waits >10s | Set HTTP timeout: 10s. On timeout: return 504 `{ "error": "llm_timeout" }`. Client retries (or saves as pending). Log timeout for monitoring. |
| **OpenRouter returns malformed JSON** | LLM hallucination, response wrapped in markdown fence, unexpected output format | Cannot parse response | Attempt to extract JSON: strip markdown fences (```json ... ```), trim whitespace, retry JSON.parse. If still fails: return 502 `{ "error": "parse_failed" }`. Log raw response for debugging. |
| **OpenRouter returns non-JSON success** | API version change, configuration error | Backend can't forward useful response | Return 502 `{ "error": "llm_error" }`. Log full response. |
| **Firebase token verification fails** | Token expired, revoked, or malformed. Firebase Auth backend unreachable. | 401 returned to client | `verifyIdToken` throws. Catch and return 401. If Firebase Auth is unreachable: return 503 `{ "error": "auth_service_unavailable" }`. |
| **Rate limit store lost on deploy/restart** | Fly.io deploys new version, process restarts. In-memory Map is empty. | Counters reset to 0. Users who hit limit before restart get 50 more calls. | Acceptable on free tier (no Redis). On paid tier: use Upstash Redis for rate limit persistence. v1: accept reset on deploy. |
| **Rate limit bypass via fake device_id** | Malicious user changes device_id header | Circumvents rate limit | device_id is sent from client — inherently untrustable. Rate limiting by device_id is a soft limit, not a security control. For abuse prevention: additionally rate limit by firebase_uid (extracted from verified token). Dual-key rate limiting: (uid + device_id). If uid hits 100/day, block even across device_ids. |
| **OpenRouter API key expired / invalid** | Key rotated in OpenRouter dashboard, not updated in Fly.io secrets | All requests return 401/403 from OpenRouter | Backend should log OpenRouter auth errors immediately. Return 502 `{ "error": "llm_error", "details": "upstream_auth_failed" }`. Alert: API key check on health endpoint. |
| **Fly.io instance out of memory** | Memory leak in rate limit store (too many device_ids), large request bodies | Instance killed by OOM killer, requests fail | Rate limit store sweep (see Background Jobs). Limit prompt size to 1000 chars (prevents memory exhaustion from huge prompts). Monitor memory usage. |
| **DDoS / abuse** | Malicious actor floods /api/parse with fake tokens | Service degraded for all users. Fly.io bill increases. | Rate limit by IP in addition to device_id. Add global rate limit: max 100 req/s across all IPs (express-rate-limit with IP key). Cloudflare or Fly.io DDoS protection as additional layer. |
| **Fly.io region outage** | Fly.io region goes down | Users in that region cannot reach backend | Fly.io automatically routes to nearest healthy region if `multi-region` is configured. Single-region deployment: accept downtime. |
| **Health check fails** | OpenRouter unreachable during health check | Fly.io may restart instance unnecessarily | Health check: shallow check (process alive + Firebase Admin initialized). Optional: check OpenRouter connectivity on a longer interval (every 5 min via health check endpoint). Don't make health check depend on OpenRouter — false positives cause restart loops. |
| **Large prompt (near 1000 chars)** | User pastes long text | OpenRouter response may exceed max_tokens (1000), get truncated | Set max_tokens=1500 to allow for larger structured responses. Validate response JSON completeness (must parse successfully). If truncated JSON: return 502 `{ "error": "parse_failed", "reason": "response_truncated" }`. |

---

## Environment & Configuration

| Variable | Purpose | Source |
|---|---|---|
| OPENROUTER_API_KEY | API key for OpenRouter | Fly.io secret |
| FIREBASE_SERVICE_ACCOUNT | Firebase Admin SDK credentials (JSON string or path) | Fly.io secret |
| FIREBASE_PROJECT_ID | Firebase project identifier | Env var |
| RATE_LIMIT_MAX | Max calls per device per day (default: 50) | Env var |
| RATE_LIMIT_WINDOW_MS | Window duration (default: 86400000 = 24h) | Env var |
| PORT | Express port (default: 8080) | Env var / Fly.io |
| NODE_ENV | Environment (development/production) | Env var |

---

## Constraints
- Backend is a single-purpose proxy. No business logic, no database, no auth state management beyond token verification.
- POST /api/parse is the only endpoint beyond health check.
- Rate limit: 50 calls per device_id per 24h sliding window.
- OpenRouter model: google/gemini-2.0-flash-001 (configurable via env var for model upgrades).
- Request timeout: 10s. Response must be returned within this window.
- Server must validate and sanitize LLM response before returning to client.
- Health endpoint: GET /health → 200 { status: "ok", uptime: N }
- All errors return consistent JSON: `{ "error": "<error_code>", "details": "..." }`
