# 02 — Onboarding Calculation Engine

**Source**: `docs/features/02-onboarding.md` (Calculation Engine block, lines 53–76)
**Cross-ref**: `docs/ARCHITECTURE.md` §7 (Onboarding Calculation Chain)

---

## Goal

Implement pure, unit-testable calculation functions: BMR, TDEE, Daily Target,
Macro Targets, safety gate, and calorie floor.

## Description

Create `apps/mobile/src/onboarding/calculations.ts` with zero dependencies — no DB,
no React, no side effects. Every function is `(input) => output`.

### Functions to implement

#### 1. `calculateBMR(gender, weightKg, heightCm, age) -> number`
Mifflin-St Jeor formula:
- Male: `10 × weight + 6.25 × height - 5 × age + 5`
- Female: `10 × weight + 6.25 × height - 5 × age - 161`

#### 2. `calculateTDEE(bmr, activityMultiplier) -> number`
`TDEE = BMR × activityMultiplier` (default 1.2 = sedentary).

Activity multiplier is passed as a parameter (default 1.2 in callers, adjustable
later in Settings per `docs/features/10-settings.md`).

#### 3. `calculateDailyTarget(tdee, goal, adjustment) -> number`
- `lose`: `TDEE - adjustment` (default deficit = 500)
- `gain`: `TDEE + adjustment` (default surplus = 500)
- `maintain`: `TDEE`

#### 4. `applyCalorieFloor(dailyTarget, gender) -> { target: number; warned: boolean }`
Floor per WHO guidelines + spec lines 134–135:
- Female: min 1200 kcal
- Male: min 1500 kcal
- If daily_target below floor, cap at floor and set `warned = true`.

#### 5. `calculateMacroTargets(dailyTarget, goal) -> { proteinG, carbsG, fatG }`
Goal-driven ratios:
- `lose`: protein 0.40 / carbs 0.30 / fat 0.30
- `maintain`: protein 0.30 / carbs 0.40 / fat 0.30
- `gain`: protein 0.25 / carbs 0.45 / fat 0.30

`grams = (dailyTarget × ratio) / caloriesPerGram` (protein=4, carbs=4, fat=9).
Rounded to nearest integer (Math.round).

#### 6. `checkSafetyGate(goal, currentWeight, targetWeight, timeframeDays) -> SafetyGateResult`
Only applies when `goal === 'lose'`:
- `weightChange = |currentWeight - targetWeight|`
- `weeklyRate = weightChange / (timeframeDays / 7)`
- If `weeklyRate > 1.0` → rejected with safe timeframe: `safeDays = Math.ceil((weightChange / 1.0) × 7)`

Return type:
```ts
type SafetyGateResult =
  | { passed: true }
  | { passed: false; currentWeeklyRate: number; safeDays: number }
```

Per spec line 48: goal=gain may also apply symmetric 1kg/week cap.
Per spec line 49: goal=maintain always passes (no gate).

**Decision**: Apply symmetric 1kg/week gate to gain as well (spec says "or apply symmetric"). Consistency.

#### 7. `calculateOnboardingResults(data: OnboardingFormData) -> OnboardingResults`
Compose all functions above in order:
1. If goal is maintain: set targetWeight = currentWeight, timeframeDays = null before all steps
2. Safety gate check (lose and gain only)
3. BMR → TDEE → Daily Target → Calorie Floor → Macro Targets
4. Return structured result

### Constants

Extract as module-level constants (easier to find/change later):
- `SEDENTARY_MULTIPLIER = 1.2`
- `DEFAULT_DEFICIT = 500`
- `DEFAULT_SURPLUS = 500`
- `MAX_WEEKLY_RATE_KG = 1.0`
- `CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 }`
- `MACRO_RATIOS` by goal
- `CALORIE_FLOOR = { male: 1500, female: 1200 }`

## Acceptance Criteria

- [ ] File at `apps/mobile/src/onboarding/calculations.ts` (or `src/calculations/`)
- [ ] All functions are pure — no side effects, no imports from React/RN/Navigation/DB
- [ ] BMR matches known Mifflin-St Jeor test vectors:
  - Male 80kg, 180cm, 30yr → 1765.0
  - Female 65kg, 165cm, 25yr → 1402.5
- [ ] Safety gate passes for lose 5kg over 70 days (0.5kg/week)
- [ ] Safety gate rejects lose 5kg over 21 days (~1.67kg/week) with safeDays = 35
- [ ] Safety gate passes for maintain goal regardless of weights
- [ ] Safety gate rejects gain 5kg over 21 days (symmetric 1kg/week cap)
- [ ] Calorie floor caps female 40kg at 1200 with warned=true
- [ ] Calorie floor caps male 50kg at 1500 with warned=true
- [ ] Calorie floor passes male 80kg at 1800+ with warned=false
- [ ] Macro percentages sum to 100% (±0.5% due to rounding) for each goal
- [ ] Macro grams are integers (Math.round), never fractional
- [ ] Goal=maintain: targetWeight set to currentWeight, timeframeDays null internally
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

**01-expand-user-schema** — uses `OnboardingFormData` type and returns results
compatible with the `User` type defined there.

## Files to Create/Change

| File | Action |
|------|--------|
| `apps/mobile/src/onboarding/calculations.ts` | Create — all pure functions |
| `apps/mobile/src/onboarding/types.ts` | Create — SafetyGateResult, OnboardingResults types |
