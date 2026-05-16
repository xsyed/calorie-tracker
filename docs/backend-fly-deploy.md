# Backend Fly.io Deployment

The backend is a single-purpose Express proxy. Its public HTTP contract is `GET /health` and `POST /api/parse`; all other paths return JSON `404`.

## Runtime Configuration

Required Fly secrets:

| Secret | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Server-only OpenRouter API key. |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin service-account JSON string. |

Required environment variables in `fly.toml`:

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID. |
| `RATE_LIMIT_MAX` | Authenticated parse calls per device and user per window. Default: `50`. |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window in milliseconds. Default: `86400000`. |
| `OPENROUTER_MODEL` | OpenRouter model. Default: `google/gemini-2.0-flash-001`. |
| `PORT` | Backend listen port. Keep `8080` to match `fly.toml` `internal_port`. |
| `NODE_ENV` | Use `production` on Fly.io. |

`GET /health` checks only process liveness and Firebase Admin initialization. It intentionally does not call OpenRouter, so an OpenRouter outage cannot remove the Machine from service or block deploys. OpenRouter connectivity/API-key checks belong in a separate diagnostic job or admin-only probe when implemented.

In v1, rate limits are in memory. They reset whenever the process restarts, the Machine is replaced, or the app scales to another Machine.

Free-tier cold starts are accepted for v1 because `auto_stop_machines = "stop"` and `min_machines_running = 0`. If cold starts become unacceptable, set `min_machines_running = 1`; this is the current `http_service` setting for the older `min_machines = 1` mitigation.

## One-Time Fly Setup

1. Install and sign in to flyctl:

   ```sh
   brew install flyctl
   fly auth login
   ```

2. From the repo root, create the Fly app without deploying:

   ```sh
   fly launch --no-deploy --name calories-api --region yyz
   ```

   If Fly offers to overwrite `fly.toml`, keep this repo's config and only change `app` or `primary_region` if needed. The backend service listens on `PORT=8080`, and Fly routes public HTTPS traffic to `[http_service].internal_port = 8080`.

3. Set runtime secrets:

   ```sh
   fly secrets set OPENROUTER_API_KEY="..."
   fly secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   ```

4. Edit `fly.toml`:

   - Set `app` to the actual Fly app name.
   - Set `primary_region` to the desired region.
   - Set `FIREBASE_PROJECT_ID` to the Firebase project ID.
   - Keep `PORT = "8080"` unless the backend config and Fly `internal_port` are changed together.

5. Deploy once manually:

   ```sh
   fly deploy --remote-only
   fly status
   fly checks list
   curl https://calories-api.fly.dev/health
   ```

   Expected health response:

   ```json
   { "status": "ok", "uptime": 12.345 }
   ```

## GitHub Deploy Setup

1. Create a Fly deploy token:
   30 days is the max TTL, and the token must be recreated before it expires to avoid GitHub Action failures.

   ```sh
   fly tokens create deploy -x 720h
   ```

2. In GitHub, open the repository settings and add an Actions secret named `FLY_API_TOKEN`. Paste the whole token, including the `FlyV1` prefix.

3. Push to `master`. `.github/workflows/fly-backend.yml` deploys when backend, Fly config, lockfile, or workflow files change.

## Android Backend URL

The mobile client currently reads the backend URL from `apps/mobile/src/services/llmService.ts`:

```ts
const API_BASE_URL = 'https://calories-api.fly.dev';
```

After choosing the real Fly app name, update that constant to `https://<app-name>.fly.dev`, build Android, and verify a signed-in parse request reaches `POST /api/parse`.

## Operational Notes

- Check health with `GET /health`; it should return `200` while Firebase Admin initialization is valid.
- Debug parse failures with Fly logs:

  ```sh
  fly logs
  ```

- Logs include status codes, timeout categories, Firebase error codes, and short token hashes where useful. They must not include `OPENROUTER_API_KEY`, Firebase service-account JSON, private keys, or full bearer tokens.
- OpenRouter timeouts, malformed JSON, and upstream auth failures are logged outside the health path.

IMPORTANT: OPENROUTER key will expired 90 days. (August, 2026) and also Github actions token will expired 30 days. (june, 2026)