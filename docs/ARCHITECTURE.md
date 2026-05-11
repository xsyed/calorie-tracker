# System Architecture — Calories App

A mobile calorie tracker using LLM-powered food/exercise parsing from freeform text or dictation, with water and weight tracking. Offline-first UX backed by a thin server-side proxy.

---

## 1. High-Level Architecture

```
┌─ React Native (bare workflow) ──────────────────────────────────────────┐
│                                                                          │
│  ┌─ Navigation ───────────────────────────────────────────────────────┐ │
│  │  Bottom Tabs: [Home]  [Weight]                                     │ │
│  │  Home: 7-day strip + month dropdown + text/voice input bar         │ │
│  │  Overlays: History / Saved Meals (triggered from input bar)        │ │
│  │  Settings: gear icon in header                                     │ │
│  │  Water: dedicated screen, reached from Home (not a tab)            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─ State (op-sqlite + repository layer) ─────────────────────────────┐ │
│  │  Entities: FoodEntry → FoodItem, WaterEntry,                       │ │
│  │            WeightEntry, ExerciseEntry, SavedMeal                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─ Services ─────────────────────────────────────────────────────────┐ │
│  │  LLM Proxy:  raw text → backend → OpenRouter (Gemini Flash)        │ │
│  │  Voice:      react-native-voice → speech-to-text → LLM pipeline    │ │
│  │  Auth:       Firebase Auth (Google + Apple sign-in only)           │ │
│  │  Backup:     Google Drive AppData — file-level SQLite backup       │ │
│  │  Reminders:  local notifications, user-configured fixed times      │ │
│  │  Offline:    react-native-netinfo → queue pending → auto-flush     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │ HTTPS + Firebase JWT
                                       ▼
┌─ Backend (Node.js / Express on Fly.io) ─────────────────────────────────┐
│                                                                          │
│  POST /api/parse                                                         │
│  ├─ Auth middleware: verify Firebase ID token                            │
│  ├─ Rate limiter: 50 calls per device per day                            │
│  └─ Relay to OpenRouter → return parsed JSON                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Client framework | React Native (bare, not Expo) | Specified in design decision #8 |
| Local database | op-sqlite | Specified in architecture diagram |
| Auth provider | Firebase Auth | Specified in design decision #5 |
| Auth methods | Google sign-in, Apple sign-in | Specified in design decision #5 |
| LLM gateway | OpenRouter | Specified in design decision #7 |
| Default LLM model | Gemini Flash | Specified in architecture diagram |
| Backend runtime | Node.js / Express | Specified in design decision #7 |
| Backend host | Fly.io | Specified in design decision #7 |
| Android backup | Google Drive AppData (file-level) | Specified in design decision #1 |
| iOS backup | iCloud (planned, not initial) | Specified in design decision #1 |
| Voice dictation | react-native-voice | Specified in architecture diagram |
| Connectivity detection | react-native-netinfo | Specified in design decision #10 |
| Local notifications | React Native local notifications | Specified in architecture diagram |

---

## 3. Frontend Architecture

### 3.1 Navigation Map

```
App Launch
  │
  ▼
Firebase Auth ──(not authenticated)──▶ Login/Signup (Google / Apple only)
  │
  ▼ (authenticated, first run)
Onboarding
  collect: gender, height, current weight, goal (lose/maintain/gain),
           target weight, timeframe
  validate: reject if weight-loss > 1kg/week → propose safe alternative
  compute: Mifflin-St Jeor BMR × sedentary × deficit/surplus → Daily Target
  derive:  Macro Targets from Daily Target via goal-driven ratios
  │
  ▼ (authenticated, returning user)
Home Screen
  ├── [input bar] ──▶ text entry or voice dictation
  ├── [bookmark icon] ──▶ History / Saved Meals overlay
  ├── [7-day strip] ──▶ select date (colored dots = logged days)
  ├── [month dropdown] ──▶ month-at-a-glance, navigate to any date
  ├── [Water progress] ──▶ tap → dedicated Water screen
  └── [gear icon] ──▶ Settings (adjust Daily Target, Macro Targets)

Weight Screen (2nd bottom tab)
  └── weigh-in log + trend chart

Water Screen (reached from Home, not a tab)
  └── water history + trend chart + quick-add
```

### 3.2 Screens & Overlays

| Screen / Overlay | Access | Purpose |
|---|---|---|
| Login/Signup | Launch (if unauthenticated) | Firebase Auth with Google or Apple |
| Onboarding | First launch after auth | Collect profile, compute targets, safety gate |
| Home | Bottom tab 1 | Primary logging & daily summary |
| Weight | Bottom tab 2 | Weigh-in history & trend |
| Water | Tap from Home | Water history & trend |
| Settings | Gear icon in Home header | Adjust targets, profile, reminders |
| History overlay | Bookmark icon on Home input bar | Past FoodEntries grouped chronologically, auto-populated |
| Saved Meals overlay | Toggle/tab within History overlay | Named templates for repeated logging, user-curated |

### 3.3 State Management & Data Layer

Pattern: **op-sqlite + repository layer**. No external state library specified.

- Each entity has a corresponding repository that wraps raw SQL.
- Repositories are the only interface to the database — no direct SQL in UI code.
- The database is the source of truth. No in-memory caching layer is specified.

---

## 4. Entity Model

### 4.1 Entities

| Entity | Description | Key Fields (derived from docs) |
|---|---|---|
| **User** | Authenticated user, syncs with Firebase Auth UID | id, firebase_uid, gender, height, current_weight, goal, target_weight, timeframe, daily_target_calories |
| **FoodEntry** | A logged meal/snack containing raw text and LLM-derived macro totals | id, user_id, date, raw_text, status (pending \| complete \| failed), created_at |
| **FoodItem** | A specific food parsed by LLM from FoodEntry prompt | id, food_entry_id, name, calories, protein_g, carbs_g, fat_g |
| **WaterEntry** | Water consumed | id, user_id, date, amount_ml, timestamp |
| **WeightEntry** | Weigh-in record | id, user_id, date, weight_kg, timestamp |
| **ExerciseEntry** | Logged exercise — calories are display-only, do not offset food budget | id, user_id, date, exercise_type, duration_minutes, calories_burned, timestamp |
| **SavedMeal** | Named reusable template created from a FoodEntry | id, user_id, name, created_at |
| **SavedMealItem** | FoodItem copy within a Saved Meal template | id, saved_meal_id, name, calories, protein_g, carbs_g, fat_g |
| **MacroTarget** | Derived daily protein/carbs/fat gram targets | protein_g, carbs_g, fat_g (stored on User or as User setting) |

### 4.2 Relationships

```
User ──1:N──▶ FoodEntry ──1:N──▶ FoodItem
User ──1:N──▶ WaterEntry
User ──1:N──▶ WeightEntry
User ──1:N──▶ ExerciseEntry
User ──1:N──▶ SavedMeal ──1:N──▶ SavedMealItem
```

- **FoodEntry** contains one or more **FoodItems** (a single prompt can parse multiple foods)
- **FoodEntry**, **WaterEntry**, **WeightEntry**, and **ExerciseEntry** each belong to exactly one User and one date
- **SavedMeal** is created from a FoodEntry; when applied, it generates a new FoodEntry with copied FoodItems
- **Daily Target** (calories) derives **Macro Targets** (protein/carbs/fat grams) via goal-driven ratios
- **ExerciseEntry** does **not** participate in the calorie budget calculation. Exercise calories are informational only.

### 4.3 FoodEntry Status Lifecycle

```
                  ┌──────────┐
                  │ pending  │  ← saved with raw_text when offline
                  └────┬─────┘
                       │ connectivity restored → auto-flush
                       ▼
                  ┌──────────┐
                  │ complete │  ← LLM returned parsed FoodItems + macros
                  └──────────┘

                  ┌──────────┐
                  │  failed  │  ← LLM response error / unrecognizable input
                  └──────────┘
                       │
                       ▼ user retries or edits prompt
                  ┌──────────┐
                  │ complete │
                  └──────────┘
```

---

## 5. Backend Architecture

The backend is a **single-purpose proxy** — it exists solely because the OpenRouter API key cannot be embedded in the client.

### 5.1 Endpoint

```
POST /api/parse
Authorization: Bearer <firebase-id-token>

Request:
{
  "prompt": "I had pancakes and ran 5km",
  "device_id": "..."   // for rate limiting
}

Response (200):
{
  "foods": [
    { "name": "pancakes", "calories": 350, "protein_g": 8, "carbs_g": 55, "fat_g": 12 }
  ],
  "exercises": [
    { "type": "running", "duration_minutes": 25, "calories_burned": 250 }
  ]
}

Response (429 — rate limited):
{ "error": "rate_limit_exceeded", "retry_after": "..." }
```

### 5.2 Middleware Stack

| Order | Middleware | Purpose |
|---|---|---|
| 1 | Firebase token verification | Reject unauthenticated requests |
| 2 | Rate limiter (per device_id) | Enforce 50 calls/device/day |
| 3 | Request relay | Forward prompt to OpenRouter, return parsed JSON |

### 5.3 Design Constraint

> Keep the backend thin. Resist adding features. It is a single-purpose proxy: authenticate → rate-limit → relay to OpenRouter → return JSON.

This is explicitly called out in design decision #7 — the backend was an unintended consequence of "hide the API key," and feature creep there adds deployment/monitoring burden with no offline value.

---

## 6. Data Flows

### 6.1 LLM Food/Exercise Logging (Online)

```
User types/dictates "pancakes and a 5km run"
        │
        ▼
Home input bar → raw_text captured
        │
        ▼
LLM Service sends POST /api/parse (with Firebase JWT)
        │
        ▼
Backend verifies token → rate-limits → relays to OpenRouter
        │
        ▼
OpenRouter returns JSON with foods[] and exercises[] arrays
        │
        ▼
App creates:
  1. FoodEntry (status: complete, date: today)
     └── FoodItem × N (one per food in response)
  2. ExerciseEntry (if exercises[] non-empty)
        │
        ▼
Home screen updates: daily summary recalculated
```

### 6.2 Offline Queue Flow

```
User types text without internet
        │
        ▼
FoodEntry saved with status: pending, raw_text preserved
  → Entry appears in day view with "pending" badge
  → Added to offline queue (in SQLite)
        │
        ▼
react-native-netinfo detects connectivity restored
        │
        ▼
Queue flusher iterates pending entries:
  1. POST /api/parse with raw_text
  2. On success: update status → complete, create FoodItems
  3. On failure: update status → failed, keep raw_text for retry
        │
        ▼
Home screen updates: pending badges replaced with macro data
```

### 6.3 Voice Input Flow

```
User taps microphone button on Home input bar
        │
        ▼
react-native-voice captures speech → returns text
        │
        ▼
Text inserted into input bar (editable before submission)
        │
        ▼
User submits → same LLM pipeline as typed input (6.1 or 6.2)
```

### 6.4 Backup Flow

```
User triggers manual backup from Settings
   or
App triggers periodic backup (if configured)
        │
        ▼
Read op-sqlite database file from app storage
        │
        ▼
Upload to Google Drive AppData folder (Android)
  → Hidden from user's normal Drive files
  → Scoped to the app only
        │
        ▼
Restore: on new device or reinstall
  1. Authenticate with same Firebase account
  2. App detects no local database
  3. Prompt user to restore from backup
  4. Download SQLite file from Drive AppData
  5. Replace local database → all data restored
```

Note: This is **not** bidirectional sync. It is file-level backup/restore for device migration or reinstall. There is no merge logic, no conflict resolution, no sync queue.


---

## 7. Onboarding Calculation Chain

```
Inputs: gender, height_cm, current_weight_kg, goal, target_weight_kg, timeframe_days
          │
          ▼
    ┌─ Safety Gate ──────────────────────────────────────┐
    │  weight_loss_rate = (current - target) / timeframe  │
    │  IF goal = lose AND rate > 1 kg/week:               │
    │    → REJECT. Propose safe timeframe.                │
    └─────────────────────────────────────────────────────┘
          │ (if safe)
          ▼
    ┌─ BMR (Mifflin-St Jeor) ─┐
    │  Male:   10×wt + 6.25×ht - 5×age + 5              │
    │  Female: 10×wt + 6.25×ht - 5×age - 161            │
    └─────────────────────────┘
          │
          ▼
    ┌─ Daily Target (calories) ─────────────────────────┐
    │  BMR × sedentary_multiplier (1.2, adjustable)      │
    │  IF goal = lose:  subtract deficit    (e.g. 500)   │
    │  IF goal = gain:  add surplus        (e.g. 500)    │
    │  IF goal = maintain: no adjustment                 │
    └────────────────────────────────────────────────────┘
          │
          ▼
    ┌─ Macro Targets (grams) ───────────────────────────┐
    │  Ratios by goal:                                   │
    │    Lose:      40% protein / 30% carbs / 30% fat    │
    │    Maintain:  30% protein / 40% carbs / 30% fat    │
    │    Gain:      25% protein / 45% carbs / 30% fat    │
    │                                                    │
    │  Conversion:                                       │
    │    protein_g = (daily_target × ratio%) / 4         │
    │    carbs_g   = (daily_target × ratio%) / 4         │
    │    fat_g     = (daily_target × ratio%) / 9         │
    └────────────────────────────────────────────────────┘
```

All values (daily target, macro targets, activity multiplier) are adjustable in Settings.

---

## 8. Security Model

| Concern | Implementation |
|---|---|
| User identity | Firebase Auth — Google & Apple sign-in only (no email/password) |
| API authentication | Firebase ID token sent as Bearer token to backend; verified server-side |
| LLM API key | Stored only on backend; never exposed to client |
| Rate limiting | 50 calls per device per day, enforced server-side |
| Data at rest | SQLite file in app-private storage; backed up to Google Drive AppData (scoped to app) |
| Unsafe weight loss | Blocked during onboarding: >1kg/week rate rejected with safe alternative proposed |

---

## 9. Offline Strategy

| Scenario | Behavior |
|---|---|
| No internet, user logs food | FoodEntry saved as `pending` with raw_text; appears in day view with pending badge |
| No internet, user logs water/weight | Entries saved locally immediately (no network needed) |
| Internet restored | `react-native-netinfo` fires → queue flusher sends all pending FoodEntries to backend → LLM results written back |
| LLM fails (online) | FoodEntry saved as `failed` with raw_text preserved; user can retry |
| LLM returns unrecognizable input | No FoodItems created; user sees retry prompt |

---

## 10. Backup Strategy

- **Mechanism**: File-level copy of the op-sqlite database file.
- **Android**: Google Drive AppData — hidden from user's normal Drive, scoped to the app.
- **iOS**: iCloud (planned for later release, not in initial build).
- **Trigger**: Manual from Settings; optionally periodic.
- **Restore**: Authenticate on new device → detect empty database → offer restore → download file → replace.
- **What it is NOT**: Structured cross-device sync, merge logic, conflict resolution, or real-time multi-device access.

---

## 11. Key Architectural Decisions

All decisions below are sourced from `research/design-decisions.md`.

| # | Decision | Rationale |
|---|---|---|
| 1 | **Backup, not sync** | Structured cross-device sync over Google Drive + iCloud with no common semantics is a v2-sized project. File-level SQLite backup covers device migration/reinstall — the actual need. |
| 2 | **Exercise non-offsetting** | LLM-estimated exercise calories are unreliable; encouraging "eating back" exercise undermines weight-loss goals. ExerciseEntry calories are display-only. |
| 3 | **LLM auto-detect over manual toggle** | No Food/Exercise mode switch. Single input field; LLM returns `foods[]` and `exercises[]` — either or both. Handles mixed input ("pancakes and a 5km run"). |
| 4 | **Block unsafe weight loss** | Warn vs block: chose block. If weight-loss rate > 1kg/week, reject the goal and propose a safe timeframe. App takes responsibility for safety. |
| 5 | **Auth-first flow** | Backend-proxied LLM requires auth for rate-limiting and user association. Onboarding comes after login. Firebase Auth with Google + Apple only (no email/password). |
| 6 | **Edit-in-place, no revision history** | Food logs are low-stakes. Old FoodEntry + FoodItems deleted, new LLM result written. Original raw text shown below edited prompt but not persisted separately. |
| 7 | **Backend proxy for LLM** | Hiding the API key forced a Node.js/Express backend on Fly.io with Firebase auth middleware and rate limiting (50/device/day). Must remain thin — single-purpose proxy. |
| 8 | **7-day strip + month dropdown (no Calendar tab)** | Full calendar tab consumes a bottom-nav slot for infrequent use. Strip + dropdown gives same navigational power in less space. 2 tabs: Home, Weight. |
| 9 | **History overlay, not History screen** | History is a utility accessed while logging — navigating away breaks flow. Overlay triggered from Home input bar via bookmark icon. History + Saved Meals in same overlay. |
| 10 | **Offline queue with auto-retry** | Blocking offline users is hostile. Raw text saved as `pending`, auto-submitted when `react-native-netinfo` detects connectivity. Failed LLM responses also saved as `pending` for retry. |
| 11 | **BMR → Daily Target → Macro Targets** | Single calculation chain: Mifflin-St Jeor BMR → sedentary multiplier → deficit/surplus adjustment → calorie target → goal-driven macro ratios (loss=40/30/30, maint=30/40/30, gain=25/45/30). |
| 12 | **Water: dual-access from Home** | Water is both a daily habit (Home quick-add: +200ml, +500ml) and reviewable data (dedicated screen with history/chart). No Water bottom tab — screen reached from Home. |

---

## 12. Bounded Contexts

```
┌─────────────────────────────────┐
│  Logging Context                │
│  FoodEntry, FoodItem, LLM parse │
│  Offline queue, Voice input     │
│  History, SavedMeals            │
├─────────────────────────────────┤
│  Tracking Context               │
│  WaterEntry, WeightEntry        │
│  ExerciseEntry (display only)   │
├─────────────────────────────────┤
│  Profile Context                │
│  Onboarding, Daily Target       │
│  Macro Targets, Settings        │
├─────────────────────────────────┤
│  Infrastructure Context         │
│  Auth, Backup, LLM Proxy        │
│  Rate Limiting                  │
└─────────────────────────────────┘
```
