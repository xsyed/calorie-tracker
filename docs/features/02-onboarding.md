# TDD: Onboarding & Profile

## Feature Summary
First-run flow collecting gender, height, current weight, goal, target weight, and timeframe. Calculates BMR via Mifflin-St Jeor, applies deficit/surplus, derives Daily Target and Macro Targets. Safety gate rejects weight-loss rates exceeding 1kg/week.

---

## Data Flow

```
User completes Authentication (first sign-in, no User row in SQLite)
  │
  ▼
Onboarding screen sequence:
  │
  ├── Step 1: Gender selection (male / female)
  │     → stored in form state
  │
  ├── Step 2: Height input (cm)
  │     → stored in form state
  │
  ├── Step 3: Current weight input (kg)
  │     → stored in form state
  │
  ├── Step 4: Goal selection (lose / maintain / gain)
  │     → stored in form state
  │     ├── (maintain) → skip target weight + timeframe, jump to Calculation
  │     └── (lose or gain) → continue to steps 5-6
  │
  ├── Step 5: Target weight input (kg)
  │     → stored in form state
  │
  ├── Step 6: Timeframe input (days, weeks, or months)
  │     → stored in form state
  │     │
  │     ▼
  │   ┌─ Safety Gate ──────────────────────────────────┐
  │   │  weight_change = |current_weight - target_weight|
  │   │  weekly_rate = weight_change / (timeframe_days / 7)
  │   │
  │   │  IF goal = lose AND weekly_rate > 1.0 kg/week:
  │   │    → REJECT
  │   │    → Calculate safe timeframe:
  │   │        safe_days = ceil((weight_change / 1.0) * 7)
  │   │    → Show: "This is too fast. A safe timeframe is X days."
  │   │    → User must accept safe timeframe or revise goal.
  │   │
  │   │  IF goal = gain: no safety gate (or apply symmetric 1kg/week cap)
  │   │  IF goal = maintain: skip gate entirely
  │   └─────────────────────────────────────────────────┘
  │     │ (if safe or revised)
  │     ▼
  │   ┌─ Calculation Engine ───────────────────────────┐
  │   │
  │   │  Step A: BMR (Mifflin-St Jeor)
  │   │    Male:   10 × weight_kg + 6.25 × height_cm - 5 × age + 5
  │   │    Female: 10 × weight_kg + 6.25 × height_cm - 5 × age - 161
  │   │
  │   │  Step B: Daily Target (calories)
  │   │    TDEE = BMR × sedentary_multiplier (1.2)
  │   │    IF lose:   daily_target = TDEE - deficit (default 500)
  │   │    IF gain:   daily_target = TDEE + surplus (default 500)
  │   │    IF maintain: daily_target = TDEE
  │   │
  │   │  Step C: Macro Targets (grams)
  │   │    Ratios by goal:
  │   │      Lose:     protein 40% / carbs 30% / fat 30%
  │   │      Maintain: protein 30% / carbs 40% / fat 30%
  │   │      Gain:     protein 25% / carbs 45% / fat 30%
  │   │
  │   │    protein_g = (daily_target × protein_ratio) / 4
  │   │    carbs_g   = (daily_target × carbs_ratio)   / 4
  │   │    fat_g     = (daily_target × fat_ratio)     / 9
  │   │
  │   │    All values rounded to nearest gram.
  │   └─────────────────────────────────────────────────┘
  │
  ├── Step 7: Summary screen
  │     Display: Daily Target (kcal), Macro Targets (g), goal, timeframe
  │     User can go back and adjust any input.
  │     "Confirm" button → write User row to SQLite → navigate to Home
  │
  └── Edge case: Age input
        Age is required for BMR formula but the architecture does not specify an age collection step.
        Sources reviewed: design-decision.md line 56 mentions "BMR × sedentary activity factor",
        ARCHITECTURE.md line 82 shows "gender, height, current weight, goal, target_weight, timeframe"
        → Age is NOT in the onboarding input list.
        Resolution: Add age field to onboarding. Required for BMR calculation.
```

---

## APIs Involved

None. This is a client-side-only calculation. No network calls.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Onboarding step index (which screen is shown) | Component state (React Navigation step counter or local state) | Onboarding session |
| Form inputs (gender, height, weight, goal, target_weight, timeframe, age) | Component state or form library (React Hook Form, Formik) | Onboarding session, lost on app kill |
| Calculation results (BMR, TDEE, daily_target, protein_g, carbs_g, fat_g) | Derived state, computed from form inputs | Onboarding session |
| Safety gate rejection state (show/hide error, proposed safe timeframe) | Component state | Ephemeral |
| Validation errors (negative values, missing fields, impossible goals) | Component state per field | Ephemeral |
| Final User entity (gender, height, weight, goal, target_weight, timeframe, daily_target_calories, macro targets) | SQLite User table (INSERT on confirm) | Persistent |
| Onboarding completion flag | SQLite User table (`onboarding_complete BOOLEAN` or implied by existence of User row with non-null daily_target_calories) | Persistent |

---

## Background Jobs

None. All calculations are synchronous arithmetic.

---

## Battery / Performance Impact

- **Battery**: None. No network calls, no background processing.
- **Performance**: Arithmetic operations are constant time (O(1)). Form rendering is trivial. No performance concerns.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Invalid inputs** | Negative height/weight, zero values, target_weight > current_weight when goal=lose | Calculation returns nonsensical results or division by zero | Per-field validation on blur and before advancing: height 100-250cm, weight 30-300kg, age 10-120, target_weight must be lower than current for lose, higher for gain. Show inline error messages. |
| **Safety gate rejection** | Weight-loss rate > 1 kg/week | User cannot proceed with unsafe goal | Show clear explanation: current rate vs safe rate. Show proposed safe timeframe. Two options: "Accept X days" or "Revise goal". Do not allow bypass. |
| **Goal = maintain but user enters target weight** | Form logic allows inputting target_weight when goal=maintain | Target weight collected but ignored in calculation — confusing | When goal=maintain: hide target_weight and timeframe fields entirely. Set target_weight = current_weight internally, timeframe = null. |
| **BMR formula requires age but not collected** | Age field missing from onboarding form | BMR calculation fails or returns NaN | Age field must be added to onboarding steps. If missing, block advancement with validation error. |
| **Calculation produces daily_target < 1200 kcal** | Extreme deficit on very small person (e.g. 40kg female with lose goal) | Unsafe calorie target displayed to user | Lower bound check: if daily_target < 1200, cap at 1200 with warning: "Minimum safe intake is 1200 kcal." (WHO guideline). Similarly cap at 1200 for women, 1500 for men. |
| **Macro targets produce fractional grams** | Rounding from percentage calculations | Minor display issue — 0.3g doesn't matter nutritionally | Round all macro targets to nearest integer gram. |
| **User kills app mid-onboarding** | App termination during onboarding flow | All form input lost. Must restart onboarding from step 1. | Acceptable for v1 (onboarding is 5-7 screens, takes ~2 minutes). Enhancement: save partial progress to AsyncStorage each step, restore on relaunch. |
| **User changes OS font size / accessibility settings** | Large text breaks form layout | Onboarding forms become unusable | All text inputs and buttons must respect Dynamic Type / accessibility scaling. Test with largest OS font size setting. |

---

## Constraints
- Collect age during onboarding (required for BMR, currently missing from spec).
- Onboarding must complete before any other screen is accessible.
- All calculated values (Daily Target, Macro Targets) are adjustable later in Settings.
- Safety gate is a hard block — no override allowed.
