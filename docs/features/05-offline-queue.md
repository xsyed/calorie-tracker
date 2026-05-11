# TDD: Offline Queue

## Feature Summary
When the user submits food text without internet connectivity, the FoodEntry is saved locally with status `pending` and raw_text preserved. When connectivity is restored (detected via react-native-netinfo), pending entries are automatically flushed to the backend for LLM parsing.

---

## Data Flow

```
User submits food text without internet
  │
  ▼
Check connectivity via NetInfo.fetch()
  │
  ▼
CONNECTIVITY = false:
  │
  ▼
INSERT FoodEntry:
  user_id, date = selected date (default: today),
  raw_text = "2 scrambled eggs and toast",
  status = "pending",
  created_at = now()
  │
  ▼
INSERT into offline_queue table (or query by status=pending):
  food_entry_id, created_at, retry_count = 0
  │
  ▼
Show toast: "Saved offline — will process when connected"
  │
  ▼
Entry appears in day view with "pending" badge (grayed out, no macro data)
  │
  ▼
Daily summary does NOT include this entry's macros (they don't exist yet)

═══ Later, connectivity restored ═══

NetInfo.addEventListener fires with isConnected = true
  │
  ▼
QueueFlusher triggered:
  1. Check auth token is valid (refresh if needed)
  2. Query: SELECT * FROM food_entries WHERE status = 'pending'
     ORDER BY created_at ASC
  3. For each pending entry:
     │
     ├── POST /api/parse with raw_text
     │     │
     │     ├── SUCCESS (200):
     │     │     BEGIN TRANSACTION
     │     │     UPDATE food_entries SET status = 'complete' WHERE id = entry.id
     │     │     INSERT FoodItems from response.foods[]
     │     │     INSERT ExerciseEntry from response.exercises[] (if any)
     │     │     COMMIT
     │     │     → entry now shows macro data, pending badge removed
     │     │
     │     ├── RATE LIMITED (429):
     │     │     → STOP processing queue. More entries would also fail.
     │     │     → Keep remaining entries as pending.
     │     │     → Schedule retry for when rate limit resets
     │     │       (check Retry-After header or default to 24h)
     │     │
     │     ├── AUTH FAILURE (401/403):
     │     │     → Try refreshing token, retry once.
     │     │     → If still fails: STOP queue. All entries will fail.
     │     │     → Show notification "Sign-in required to process entries."
     │     │
     │     └── OTHER FAILURE (5xx, timeout, network drop mid-flush):
     │           → UPDATE food_entries SET retry_count = retry_count + 1
     │           → IF retry_count >= 3: status = 'failed'
     │           → IF retry_count < 3: stay as pending, will retry next flush
     │
     └── After queue processing:
           Show notification: "X entries processed" or
           "X entries processed, Y failed" (if failures)
           Update 7-day strip and daily summary
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| react-native-netinfo | Connectivity state detection (subscribe to changes + on-demand check) | Native bridge |
| POST /api/parse (same as logging) | Flush pending entries to LLM | HTTPS REST |
| Firebase Auth getIdToken(true) | Ensure valid token before flushes | Native SDK |
| AppState API (react-native) | Detect app returning to foreground — trigger immediate flush | Native bridge |
| NetInfo `useNetInfo` hook or `addEventListener` | React to connectivity changes reactively | Native bridge |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Connectivity status (isConnected, isInternetReachable, connectionType) | NetInfo hook state (in-memory, auto-updated) | App session |
| Pending FoodEntries (status='pending') | SQLite food_entries table | Persistent (until flushed or failed) |
| Queue flush progress (currently processing, success count, failure count) | Component/Service state | Duration of flush |
| retry_count per entry | SQLite food_entries.retry_count column | Persistent per entry |
| Last flush timestamp | Optional: SQLite or AsyncStorage. Used to avoid flushing too frequently (e.g. not more than once per 30s). | Persistent |

---

## Background Jobs

| Job | Trigger | Behavior |
|---|---|---|
| **Queue flusher (connectivity change)** | NetInfo listener fires isConnected=true | Iterate all pending entries, POST each to /api/parse. Process sequentially (rate limit concern). Update DB after each success/failure. |
| **Queue flusher (app foreground)** | AppState 'active' event | Same as above. Ensures entries logged while app was backgrounded (or device had no signal) get flushed immediately when user opens app. |
| **Queue flusher (rate limit reset)** | After receiving 429, schedule alarm for Retry-After period | Use setTimeout (if app in foreground) or schedule a local notification / background task. Re-trigger flush. |
| **Periodic health check** | Optional: every 15 minutes (only if pending entries exist) | If connectivity is available and entries pending, attempt flush. This catches cases where NetInfo didn't fire (known unreliability on some Android devices). Use react-native-background-fetch or a setInterval while app is foregrounded. |
| **Stale pending cleanup** | Periodic (optional) | Entries pending > 7 days could be auto-marked as failed or deleted. User should be notified. v1: manual cleanup only. |

---

## Battery / Performance Impact

- **Battery**:
  - NetInfo listener: negligible. Uses OS connectivity callbacks. No polling.
  - Queue flush: one HTTPS request per pending entry. If user has 20 pending entries, that's 20 requests. Constrain: flush max 10 entries per batch to avoid burst battery drain. Remaining entries flushed on next trigger (30s delay).
  - AppState listener: negligible. OS-level callback on foreground.
  - Periodic health check (optional): slight impact. If implemented, use minimum viable interval (15 min).
- **Performance**:
  - SQLite query for pending entries: indexed by status column, very fast (<1ms even with thousands of entries).
  - Sequential processing ensures rate limit is respected. Parallel would risk 429 on the second call if user is near limit.
  - UI: batch update after flush completes (single re-render with all new data).

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Pending entries never flush** | User never regains connectivity. User uninstalls app. Device lost. | Data loss — raw text entries with no macros. | Raw text is saved. On reinstall + restore from backup: entries remain as pending, can be flushed after restore. This is acceptable data retention for a calorie tracker. |
| **Flush fails for all entries (auth expired)** | Firebase token expired, couldn't refresh (auth backend unreachable) | All pending entries remain pending. User sees stale "pending" badges. | Queue flusher catches 401/403. Stops processing. Shows in-app notification: "Sign-in required to process X entries." Users can manually retry after re-auth. |
| **Flush partially completes** | First 3 entries flush, 4th fails (OpenRouter error), 5th not attempted | Partial data update. Some entries complete, some pending. Home screen shows mix. | Queue flusher continues past transient failures. Only rate-limit and auth failures stop the queue. Each entry is independent — success/failure is per-entry. |
| **Race condition: user edits a pending entry while queue is flushing it** | User opens entry edit UI just as queue flusher picks it | DB conflict — update vs update | Handle with SQLite transactions. If queue flusher picks up entry, it locks the row. Concurrent edit attempt: show "This entry is being processed. Please wait." |
| **Connectivity drops mid-flush** | User enters tunnel/elevator while queue is processing | Current request fails, next entries not attempted | NetInfo will fire another event when connectivity returns. Queue flusher will re-query pending entries and process from the start (already-processed entries are now status=complete and won't be re-processed). |
| **Rate limited mid-queue** | 49/50 calls used. Queue has 5 pending entries. 1st succeeds, 2nd gets 429. | 1 entry processed, 4 remain pending. | Stop queue on 429. Store `rate_limit_reset_at` timestamp. Disable manual submit until reset. Auto-resume queue flusher when rate limit window reopens. |
| **NetInfo false positive** | Android: NetInfo reports connected (WiFi connected) but no actual internet (captive portal, router without WAN). Queue flusher starts, all requests fail. | Entries remain pending. flusher wastes battery on failed requests. | Before flushing: ping backend with a lightweight HEAD request or check `isInternetReachable` from NetInfo (which does a test request). If unreachable: abort flush. |
| **Large queue (user was offline for a week)** | 21+ pending entries accumulated | Queue flush takes long time, may hit rate limit (50/day) after processing some | Show progress indicator: "Processing 5 of 21 entries..." Rate limit aware: if limit is 50/day and user has 21 pending, they'll all fit. If user has 60+ pending, only 50 will process today. Show "X entries will process tomorrow" message. |
| **App killed during flush** | OS terminates app (memory pressure, user swipe-kills) | Queue processing interrupted. Some entries may be mid-write. | SQLite transactions protect individual entry state changes. On app restart: pending entries are re-queried and processing resumes from start. No partial states (each entry is atomically updated). |
| **Duplicate processing** | Queue flusher triggered by both NetInfo and AppState simultaneously | Same entry submitted to /api/parse twice | Guard: use a mutex/isFlushing flag. If flush is already in progress, skip the second trigger. Additionally: on /api/parse success, check if entry.status already = complete before updating (defense against race). |

---

## Constraints
- Only FoodEntry goes through the queue. WaterEntry, WeightEntry, and ExerciseEntry are stored locally without network dependency.
- Maximum retry count of 3 per entry before marking as failed.
- Queue flush processes entries sequentially, not in parallel.
- Entries must be flushed in chronological order (oldest first) so the user's daily history builds correctly.
- "Pending" badge must be visible in the day view so user knows which entries lack macro data.
