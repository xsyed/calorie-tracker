# Design Decisions — Calories App

Interview date: 2026-05-10. Domain: mobile calorie tracker with LLM food/exercise parsing.

---

## 1. Sync Scope Creep → Backup Pivot

**Initial ask:** "Seamless sync across devices using default Android/iOS SDKs."

**What we learned:** Structured cross-device sync over two fundamentally different cloud APIs (Google Drive AppData + iCloud KVS) is a v2-sized engineering project on its own. You'd need a sync queue, conflict resolution, timestamps, merge logic — all while the two backends have no common semantics. `firestore` was floated but rejected as not "OS built-in."

**Decision:** File-level SQLite backup to Google Drive AppData (Android) and iCloud (iOS later). Not real-time sync — backup/restore on device switch or reinstall. The use case (single-device calorie tracking) doesn't justify sync complexity.

**Why it matters:** This removed a backend-sized problem from the frontend scope. The word "sync" was the trap — it implied bidirectional merge when the actual need was backup.

---

## 2. Exercise as Non-Offsetting

**Initial ask:** Track food, exercise, calories and macros.

**What we learned:** The natural impulse is "calories in minus calories out" — exercise reduces the daily budget. But:
- LLM-estimated exercise calories are unreliable (a 5km run for a 60kg person vs 90kg person burns vastly different amounts)
- Encouraging users to "eat back" exercise calories undermines weight-loss goals
- Simpler model: show exercise data without letting it touch the food budget

**Decision:** `ExerciseEntry` has calories burned as a display value only. The daily calorie summary shows food calories consumed against target — exercise shown separately, never subtracted.

**Why it matters:** Changed the entity relationship model. ExerciseEntry does NOT participate in the calorie budget calculation. The Home screen shows two parallel tracks — food vs target, and exercise burned.

---

## 3. LLM Auto-Detect Over Manual Toggle

**Initial ask:** Log food via freeform text. Also exercise.

**What we learned:** Two approaches for handling "I had pancakes then ran 5km":
- Toggle on input bar (Food/Exercise mode) — predictable but forces the user to classify. Fails for mixed input.
- Auto-detect — LLM classifies each item. Supports mixed responses naturally. One prompt, two entries.

**Decision:** Auto-detect. LLM returns JSON with `foods[]` and `exercises[]` arrays (either or both can be populated). The raw prompt is shared; the app creates one `FoodEntry` (containing multiple `FoodItems`) plus one `ExerciseEntry` as needed. Empty arrays = unrecognizable input, show retry prompt.

**Why it matters:** The input UX stays dead simple — one text field, one microphone button. No mode switching. The LLM prompt does the classification work.

---

## 4. Onboarding Safety: Block, Don't Warn

**Initial ask:** "Be careful if they're going in unhealthy dangerous limit."

**What we learned:** Two interpretations of "be careful":
- Warn user, let them proceed anyway. They're an adult, it's their body.
- Block outright, suggest a safe alternative. "Be careful" means don't let them hurt themselves.

**Decision:** Block outright. If the weight-loss rate exceeds 1kg/week (based on current weight, target weight, timeframe), reject the goal and propose a safe timeframe instead. Mifflin-St Jeor BMR × sedentary activity factor (adjustable later) minus deficit.

**Why it matters:** Sets a product philosophy: the app takes responsibility for safety. Also avoids the ethical and potential liability problem of facilitating dangerous dieting.

---

## 5. Auth-First Flow

**Initial ask:** Onboarding first, then auth — so users see the value proposition before signing up.

**What we learned:** This conflicts with the backend-proxied LLM calls. Without auth, you can't rate-limit, can't associate onboarding data with an account, and the offline queue has no user ID to flush against. Auth-first is structurally required by the backend dependency.

**Decision:** App launch → Login/Signup (Google + Apple only, no email/password friction) → Onboarding → Home.

**Why it matters:** Firebase Auth became a hard dependency. The onboarding profile (gender, height, weight, goal) is stored server-side, enabling future cross-device restore via backup.

---

## 6. Edit-in-Place, No Revision History

**Initial ask:** User can edit a FoodEntry prompt and re-submit to LLM.

**What we learned:** Keep edit history or just replace? Food logs are low-stakes — nobody needs a git blame for their breakfast. Revision history adds schema complexity (versioning, parent references) for zero user value.

**Decision:** Replace in place. Old FoodEntry + FoodItems deleted, new LLM result written. The original raw text is optionally shown below the edited prompt for transparency, but not persisted as a separate record.

**Why it matters:** Minimal schema. FoodEntry has one state, not a lineage.

---

## 7. Backend Proxy for LLM — the Hidden Cost

**Initial ask:** Hide the API key from users.

**What we learned:** This decision cascaded into: need a backend (chose Node.js/Express on Fly.io), need auth (chose Firebase), need rate limiting (50 calls/device/day), need deployment and monitoring. For one decision ("don't make users paste an API key"), we gained an entire infrastructure component.

**Why it matters:** The backend is the only server-side piece in an otherwise offline-first app. It's a single-purpose proxy: authenticate → rate-limit → relay to OpenRouter → return JSON. Keeping it thin is critical — resist the temptation to add features there.

---

## 8. 7-Day Strip + Month Dropdown Over Full Calendar Tab

**Initial ask:** Calendar view.

**What we learned:** A full calendar tab consumes a bottom-nav slot for something used sparingly. A 7-day strip in the Home header + a month-picker dropdown gives the same navigational power in less space. The bottom tabs drop from 3 to 2: Home and Weight.

**Decision:** No Calendar tab. Home header shows 7-day strip (colored dots for logged days), dropdown gives month-at-a-glance with navigation to any past date. Tapping a date loads that day's entries in Home.

**Why it matters:** Condensed navigation. Two tabs feel lighter, less intimidating.

---

## 9. History Overlay, Not History Screen

**Initial ask:** History to repeat past meals. Saved meals as templates.

**What we learned:** History is a utility accessed while logging — navigating away to a separate screen breaks flow. An overlay (triggered by bookmark icon on the input bar) keeps the user in context.

**Decision:** Both History and Saved Meals persist. History is auto-populated, chronologically grouped, accessible via overlay from the log screen. Saved Meals are user-curated, named templates — also accessible from the same overlay via a toggle or tab. No separate screen.

**Why it matters:** Reduces navigation depth. The log screen is the hub — everything you need to compose a new entry is one tap away on the same screen.

---

## 10. Offline Queue with Auto-Retry

**Initial ask:** Log food offline? What happens?

**What we learned:** Blocking offline users from logging is hostile — they'll forget to log later. Better to save the raw text, show it in the day view with a "pending" badge, and auto-submit when connectivity returns.

**Decision:** `FoodEntry.status` enum: `pending | complete | failed`. On submit without internet: save as `pending`, add to queue. `react-native-netinfo` detects connectivity → flush queue. Failed LLM responses also save as `pending` with the raw text preserved. User can retry manually.

**Why it matters:** Offline-first UX without offline LLM. The food parsing is async from the logging — user gets immediate feedback (entry appears) even if macro numbers arrive seconds later.

---

## 11. Onboarding → Daily Target → Macro Targets

**Initial ask:** Calculate daily calorie limit from goal, weight, height, gender.

**What we learned:** Calorie target alone isn't enough — the Home screen shows macro progress bars (protein, carbs, fat). Those need targets too.

**Decision:** Onboarding: collect gender, height, current weight, goal, target weight, timeframe. Calculate BMR (Mifflin-St Jeor), apply sedentary multiplier, adjust for deficit/surplus. Derive macro targets from calorie target using goal-driven ratios: weight loss = 40/30/30 (protein/carbs/fat), maintenance = 30/40/30, gain = 25/45/30. Convert % to grams (4/4/9 cal/g). All adjustable in Settings.

**Why it matters:** A single algorithm chain: BMR → calorie target → macro targets. Changing the calorie target in Settings cascades to macro targets automatically.

---

## 12. Water: Dual-Access Pattern

**Initial ask:** Track water intake.

**What we learned:** Water is both a daily habit (log quickly from Home) and something users want to review (dedicated screen with history/chart). Two access points serve two intents.

**Decision:** `WaterEntry` as standalone entity. Home screen shows daily progress bar + quick-add buttons (+200ml, +500ml). Dedicated Water screen (accessible from Home) for history and trends. Not a bottom tab — reached from Home.

**Why it matters:** No "Water" tab. Screen count stays low while functional depth is preserved.

---

## Summary: Architecture Diagram

```
┌─ React Native (bare) ────────────────────────────────┐
│  ┌─ Navigation ─────────────────────────────────────┐│
│  │  Bottom Tabs: [Home] [Weight]                    ││
│  │  Home: 7-day strip + month dropdown + input bar  ││
│  │  Overlays: History / Saved Meals (from input)    ││
│  │  Settings: gear in header                        ││
│  └──────────────────────────────────────────────────┘│
│  ┌─ State ──────────────────────────────────────────┐│
│  │  op-sqlite + repository layer                    ││
│  │  Entities: FoodEntry→FoodItem, WaterEntry,       ││
│  │            WeightEntry, ExerciseEntry, SavedMeal  ││
│  └──────────────────────────────────────────────────┘│
│  ┌─ Services ───────────────────────────────────────┐│
│  │  LLM: send raw text → backend proxy → OpenRouter ││
│  │  Voice: react-native-voice → text → LLM pipeline ││
│  │  Auth: Firebase Auth (Google + Apple sign-in)    ││
│  │  Backup: Google Drive AppData (file-level)       ││
│  │  Reminders: local notifications, fixed times     ││
│  │  Offline: NetInfo → queue pending → auto-flush   ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
          │
          ▼
┌─ Backend (Node.js/Express on Fly.io) ───────┐
│  Auth middleware (Firebase token verify)     │
│  Rate limiter (50 calls/device/day)          │
│  OpenRouter proxy (Gemini Flash default)     │
└──────────────────────────────────────────────┘
```
