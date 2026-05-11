# TDD: LLM Food/Exercise Logging

## Feature Summary
Core input mechanic: user types freeform text describing what they ate and/or exercise performed. Text is sent to backend proxy → OpenRouter (Gemini Flash) → parsed JSON returned with `foods[]` and `exercises[]`. App creates FoodEntry with FoodItems and optionally an ExerciseEntry. LLM auto-detects item types — no manual food/exercise toggle.

---

## Data Flow

```
User on Home screen
  │
  ▼
Type in input bar: "2 scrambled eggs, toast with butter, and a 30 min walk"
  │
  ▼
Tap submit (or keyboard return)
  │
  ▼
Check connectivity (react-native-netinfo)
  │
  ├── OFFLINE → delegate to Offline Queue (see 05-offline-queue.md)
  │
  └── ONLINE:
        │
        ▼
      Get Firebase ID token: auth().currentUser.getIdToken()
        │
        ▼
      POST /api/parse
        Headers:
          Authorization: Bearer <firebase-id-token>
          Content-Type: application/json
        Body:
          {
            "prompt": "2 scrambled eggs, toast with butter, and a 30 min walk",
            "device_id": "<device_unique_id>"
          }
        │
        ▼
      Backend (see 13-backend-proxy.md):
        1. Verify Firebase token
        2. Check rate limit (50/device/day)
        3. Relay to OpenRouter with structured prompt
        4. OpenRouter (Gemini Flash) returns JSON
        5. Parse & validate response
        6. Return JSON to client
        │
        ▼
      Client receives response (200):
        {
          "foods": [
            { "name": "scrambled eggs", "calories": 140, "protein_g": 12, "carbs_g": 0, "fat_g": 10 },
            { "name": "toast", "calories": 70, "protein_g": 3, "carbs_g": 14, "fat_g": 1 },
            { "name": "butter", "calories": 72, "protein_g": 0, "carbs_g": 0, "fat_g": 8 }
          ],
          "exercises": [
            { "type": "walking", "duration_minutes": 30, "calories_burned": 120 }
          ]
        }
        │
        ▼
      Begin SQLite transaction:
        1. INSERT FoodEntry:
             user_id = current user
             date = selected date (default: today)
             raw_text = "2 scrambled eggs, toast with butter, and a 30 min walk"
             status = "complete"
             created_at = now()
             → get food_entry_id

        2. For each food in response.foods[]:
             INSERT FoodItem:
               food_entry_id, name, calories, protein_g, carbs_g, fat_g

        3. If response.exercises[] is non-empty:
             For each exercise:
               INSERT ExerciseEntry:
                 user_id, date, exercise_type, duration_minutes, calories_burned, timestamp = now()

        4. COMMIT transaction
        │
        ▼
      Clear input bar
        │
        ▼
      Home screen re-renders:
        - Daily summary recalculated (totals + progress bars)
        - New entries appear in the day's entry list
        - 7-day strip dot updates for this date
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| POST /api/parse (backend proxy) | Send raw text, receive parsed foods + exercises | HTTPS REST |
| Firebase Auth `getIdToken()` | Get current JWT for Authorization header | Native SDK |
| react-native-netinfo `fetch()` | Check current connectivity state before attempting call | Native SDK |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Input bar text | Component state (uncontrolled TextInput or controlled) | Screen session, cleared after submit |
| Submit loading state (isSubmitting) | Component state | Duration of `/api/parse` call (~1-3s) |
| Parse result (temporary, before DB write) | Component state or local variable in service layer | Held in memory until DB write completes |
| FoodEntry + FoodItems (persisted) | SQLite tables: food_entries, food_items | Persistent |
| ExerciseEntry (persisted, if any) | SQLite table: exercise_entries | Persistent |
| Error state (parse failed, rate limited, network error) | Component state | Ephemeral, shown to user then cleared |

---

## Background Jobs

None during the logging flow. All operations are synchronous within user interaction.

(Offline queue flush triggers the same `/api/parse` call but that is covered in 05-offline-queue.md.)

---

## Battery / Performance Impact

- **Battery**: One HTTPS request per log entry. ~1-3s of radio activity. Negligible for typical usage (5-10 entries/day).
- **Performance**:
  - Network latency: OpenRouter (Gemini Flash) averages 500ms-2s response time. Backend adds ~50ms proxy overhead. Total end-to-end: ~1-3s.
  - SQLite: INSERT of FoodEntry + 1-5 FoodItems + 0-1 ExerciseEntry. All within a single write transaction. <10ms.
  - UI: Re-render daily summary (simple aggregation queries: SUM of FoodItem macros grouped by date). <5ms for typical data volume.
- **Cold start**: Backend on Fly.io may experience cold start (~1-2s) if the instance was idle. First request of the day may be slower.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **No network** | Airplane mode, no signal | Cannot parse food text | Detect connectivity before call. If offline: delegate to offline queue (status=pending). Show "Saved offline — will process when connected" toast. |
| **Rate limited (429)** | 50 calls/device/day exceeded | Cannot parse until next day (server-side window) | Backend returns `{ "error": "rate_limit_exceeded" }`. Show alert: "Daily limit reached. Try again tomorrow or edit existing entries." Optionally: save as pending and auto-flush when limit resets. |
| **Backend auth failure (401/403)** | Firebase token expired, invalid, or user deleted | Parse request rejected | Refresh token via `getIdToken(true)`, retry once. If still fails: force sign-out (see auth failure scenarios in 01-authentication.md). |
| **Backend timeout / 5xx** | Fly.io instance crash, OpenRouter timeout, OpenRouter returns non-JSON | Parse request fails, no response | Show "Couldn't process your entry. Tap to retry." Save raw_text in input bar (don't clear it). Do not create a FoodEntry — wait for successful parse. |
| **OpenRouter returns malformed JSON** | LLM hallucination, prompt injection, unexpected response structure | Backend cannot extract `foods[]` or `exercises[]` | Backend validates response structure. Returns 502 with `{ "error": "parse_failed" }`. Client: save FoodEntry with status=failed, raw_text preserved. Show "Couldn't understand that. Try rephrasing." with option to retry. |
| **OpenRouter returns empty arrays (both foods and exercises)** | Unrecognizable input: "asdfghjkl", a question, non-food text | No entries to create | Backend returns `{ "foods": [], "exercises": [] }`. Client: show "Nothing recognized. Try describing what you ate or did." Do NOT create an empty FoodEntry. |
| **Partial parse (some foods parsed, some missed)** | LLM missed an item in the prompt | FoodEntry created with incomplete data | No programmatic detection possible (we don't know what was missed). User must notice and manually edit or add a new entry. This is an inherent LLM limitation — documented in-app. |
| **SQLite transaction fails** | Disk full, database corruption, concurrent write conflict | FoodEntry created without FoodItems (orphan) or nothing created | Use SQLite transaction wrapping all inserts. On failure: rollback entire transaction, show error, preserve input text for retry. |
| **LLM returns impossible macro composition** | Single foodItem with protein_g + carbs_g + fat_g calories exceeding its total calories (e.g. protein=50g (200kcal) + carbs=0 + fat=0 but calories=80) | Logical inconsistency in data | Validate: `|(protein_g*4 + carbs_g*4 + fat_g*9) - calories| <= tolerance (e.g. 20kcal)`. If mismatch: trust the macro grams (used for display/counting) and override calories to computed value. Log discrepancy. |
| **Slow response (> 5s)** | OpenRouter congestion, large prompt | User waits, may think app is frozen | Show loading indicator on submit button. Timeout at 10s. On timeout: save as pending, auto-retry with offline queue. |

---

## Constraints
- LLM auto-detects food vs exercise. No manual toggle in input bar.
- ExerciseEntry calories do NOT offset Daily Target. Display-only.
- FoodEntry.status lifecycle: `pending` → `complete` (or → `failed` → retry → `complete`).
- A single prompt can produce multiple FoodItems and optionally an ExerciseEntry.
- Backend must remain thin — only auth, rate-limit, relay. No business logic.
