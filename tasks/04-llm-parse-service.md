# Task 04: LLM Parse Service

## Goal

Create the HTTP client service that sends user text to the backend proxy (`POST /api/parse`) and returns typed parsed results, handling all failure modes.

## Description

Create `apps/mobile/src/services/llmService.ts`. This service wraps the single backend endpoint. It uses the existing `useAuth().getIdToken()` to get a Firebase JWT for the `Authorization: Bearer` header. Returns strongly-typed success/error result discriminated by outcome.

### Request/Response types

```ts
interface ParseRequest {
  prompt: string;
  device_id: string;
}

interface ParsedFood {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface ParsedExercise {
  type: string;
  duration_minutes: number;
  calories_burned: number;
}

interface ParseSuccess {
  outcome: 'success';
  foods: ParsedFood[];
  exercises: ParsedExercise[];
}

type ParseErrorCode =
  | 'no_network'
  | 'token_refresh_failed'
  | 'rate_limit_exceeded'
  | 'invalid_token'
  | 'parse_failed'
  | 'llm_timeout'
  | 'llm_error'
  | 'empty_result'
  | 'server_error'
  | 'network_error';

interface ParseFailure {
  outcome: 'error';
  error: ParseErrorCode;
  message: string;
}

type ParseResult = ParseSuccess | ParseFailure;
```

### Main export

```ts
async function parseFoodText(prompt: string): Promise<ParseResult>
```

### Implementation flow

1. Check connectivity via `checkConnectivity()` from Task 03 — if offline, return `{ outcome: 'error', error: 'no_network' }`
2. Get device_id from `app_settings` table (generate + persist if not exists, using `getSetting`/`setSetting` from Task 02)
3. Get Firebase ID token via `auth().currentUser?.getIdToken()` — if null, return `{ outcome: 'error', error: 'token_refresh_failed' }`
4. POST to `POST /api/parse` with `Authorization: Bearer <token>`, `Content-Type: application/json`, body: `{ prompt, device_id }`
5. Handle response:
   - **200**: Parse JSON body. Validate structure (both `foods` and `exercises` must be arrays). Validate macro consistency (see below). Return `{ outcome: 'success', foods, exercises }`
   - **401/403**: Try token refresh via `getIdToken(true)`, retry once. If still fails, return `{ outcome: 'error', error: 'invalid_token' }`
   - **429**: Return `{ outcome: 'error', error: 'rate_limit_exceeded' }`
   - **502**: Return `{ outcome: 'error', error: 'parse_failed' }`
   - **504**: Return `{ outcome: 'error', error: 'llm_timeout' }`
   - **5xx other**: Return `{ outcome: 'error', error: 'server_error' }`
   - **Empty arrays** (both foods[] and exercises[] are empty): Return `{ outcome: 'error', error: 'empty_result' }`
   - **Network error / timeout** (fetch throws): Return `{ outcome: 'error', error: 'network_error' }`

### Macro calorie validation

For each food item, validate macro consistency:

```
computed_calories = protein_g * 4 + carbs_g * 4 + fat_g * 9
if |computed_calories - calories| > 20:
    override calories = computed_calories
    // Log discrepancy for debugging (console.warn, not visible to user)
    // Keep original protein/carbs/fat grams — they are more reliable
```

Apply this transformation silently — the caller always gets corrected data.

### Server timeout

Set fetch timeout to 10s via `AbortController`. On timeout, return `network_error` (the backend has its own 10s timeout, but the client should enforce its own as well).

### Server URL

Use a configurable constant. Backend URL is a placeholder until the backend is deployed:

```ts
const API_BASE_URL = 'https://calories-api.fly.dev'; // placeholder — update when backend is deployed
```

### Files to create/modify

- **Create** `apps/mobile/src/services/llmService.ts`
- **Modify** `apps/mobile/src/services/index.ts` — barrel export (create if needed, or just export from llmService)

## Acceptance Criteria

- [ ] `parseFoodText("2 scrambled eggs")` calls POST /api/parse with correct headers and body
- [ ] Authorization header contains a valid Firebase JWT
- [ ] Device ID is generated once, persisted in `app_settings`, and reused across calls
- [ ] On 200 with valid response: returns `{ outcome: 'success', foods, exercises }`
- [ ] On 200 with both arrays empty: returns `{ outcome: 'error', error: 'empty_result' }`
- [ ] On 401/403: token refresh is attempted once before returning error
- [ ] On 429: returns `{ outcome: 'error', error: 'rate_limit_exceeded' }`
- [ ] On 502: returns `{ outcome: 'error', error: 'parse_failed' }`
- [ ] On 504: returns `{ outcome: 'error', error: 'llm_timeout' }`
- [ ] On fetch timeout (client-side 10s): returns `{ outcome: 'error', error: 'network_error' }`
- [ ] On network failure (fetch throws): returns `{ outcome: 'error', error: 'network_error' }`
- [ ] Macro validation corrects impossible calorie values (protein 50g + 0 carbs + 0 fat = 200 kcal but calories=80 → override to 200)
- [ ] Macro validation does NOT mutate items within tolerance (≤20 kcal difference)
- [ ] No credentials or secrets in source code (server URL is a config constant, not a secret)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

- [Task 02: Food & Exercise Repository Layer](./02-food-exercise-repository.md) — uses `getSetting`/`setSetting` for device_id persistence
- [Task 03: Connectivity Service](./03-connectivity-service.md) — uses `checkConnectivity()` for pre-check
