# 03 — Onboarding Form State Hook

**Source**: `docs/features/02-onboarding.md` (Data Flow, State Management, Failure Scenarios)

---

## Goal

Implement a custom React hook (`useOnboardingForm`) that manages multi-step
onboarding form state, per-field validation, step progression/regression with
conditional branching, and safety gate integration.

## Description

Create `apps/mobile/src/onboarding/useOnboardingForm.ts`. No UI rendering —
returns state and callbacks consumed by task 04 screens.

### Step sequence

```
gender → age → height_cm → current_weight_kg → goal → target_weight_kg → timeframe → [safety_gate] → summary
```

**Branching rules:**
- Goal = `maintain`: skip target_weight_kg, timeframe, and safety_gate entirely → go straight to summary
- Goal = `lose` or `gain`: continue to target_weight_kg → timeframe → run safety gate on advance from timeframe
- Safety gate passes → summary
- Safety gate rejects → insert safety_gate step (one-time interstitial) between timeframe and summary
- Safety gate accept → summary (with safe timeframe replacing user's value)
- Safety gate revise → jump back to goal step (user changes goal or target weight)

### Hook API

```ts
function useOnboardingForm(): {
  step: StepName;                    // current step identifier
  stepIndex: number;                 // current position (for progress indicator)
  totalSteps: number;                // visible step count
  formData: PartialOnboardingFormData;
  errors: Partial<Record<keyof OnboardingFormData, string>>;
  safetyGateResult: SafetyGateResult | null;  // null until checked
  calculationResults: OnboardingResults | null; // null until summary
  isSummaryReady: boolean;           // true when results computed
  canAdvance: boolean;               // current step passes validation
  setField: (field, value) => void;
  goNext: () => void;                // validates, branches, advances
  goBack: () => void;                // regresses one step
  acceptSafeTimeframe: () => void;   // safety gate: accept proposed days
  reviseGoal: () => void;            // safety gate: go back to goal step
  reset: () => void;
}
```

### Per-field validation (on blur / on goNext)

| Field | Rules |
|-------|-------|
| gender | Required. Must be 'male' or 'female'. |
| age | Required. Integer 10–120. |
| height_cm | Required. Number 100–250. |
| current_weight_kg | Required. Number 30–300. |
| goal | Required. 'lose', 'maintain', or 'gain'. |
| target_weight_kg | Required when goal ≠ maintain. Number. Must be < current_weight for lose, > current_weight for gain. |
| timeframe_days | Required when goal ≠ maintain. Positive integer > 0. |

Validation runs on `goNext()`. Invalid field → set error, don't advance.
Error cleared when user changes the field value (via `setField`).

### Calculation trigger

When advancing from `timeframe` (or from `goal` when maintain):
1. Assemble full form data
2. Call `checkSafetyGate` if goal is lose or gain
3. If rejected: set `safetyGateResult`, step becomes `safety_gate`
4. If passed: call `calculateOnboardingResults`, set `calculationResults`, step becomes `summary`
5. For maintain: skip safety gate, call calculateOnboardingResults directly

### Safety gate accept/revise

- `acceptSafeTimeframe()`: sets timeframe_days to safeDays, recalculates (now passes), goes to summary
- `reviseGoal()`: clears safety gate result, sets step to `goal`, user re-picks

### Edge cases

- `goNext()` called on summary → no-op (no step beyond)
- `goBack()` called on gender → no-op (no step before)
- `goBack()` from summary → clears calculation results
- `goBack()` from target_weight_kg when goal was changed from maintain to lose → re-check conditional steps
- Goal changes from maintain to lose/gain on goBack → target_weight_kg and timeframe must re-appear
- Goal changes from lose/gain to maintain → target_weight_kg and timeframe removed, advance goes to summary

## Acceptance Criteria

- [ ] Hook file at `apps/mobile/src/onboarding/useOnboardingForm.ts`
- [ ] Returns all API properties listed above with correct types
- [ ] Step navigation is linear gender→age→height→weight→goal (always)
- [ ] Goal=maintain: goNext from goal goes directly to summary (skips 3 steps)
- [ ] Goal=maintain: target_weight_kg and timeframe are auto-set (to current_weight and null)
- [ ] Goal=lose/gain: goNext from goal goes to target_weight_kg
- [ ] Goal=lose/gain: goNext from timeframe runs safety gate
- [ ] Safety gate rejection: step becomes safety_gate, safetyGateResult populated
- [ ] Safety gate rejection: two error scenarios:
  - Lose 15kg in 14 days → rejected (rate ≈ 7.5 kg/week)
  - Lose 5kg in 21 days → rejected (rate ≈ 1.67 kg/week) with safeDays = 35
- [ ] Safety gate pass: step becomes summary, calculationResults populated
- [ ] acceptSafeTimeframe: timeframe updated to safeDays, advance to summary
- [ ] reviseGoal: back to goal step, safetyGateResult cleared
- [ ] Per-field validation blocks advance with error message when invalid
- [ ] Error cleared when field value changes (re-validated next goNext)
- [ ] goBack from any step goes to previous visible step
- [ ] goBack from summary clears calculationResults but keeps formData
- [ ] goBack then change goal from maintain → lose makes target_weight_kg/timeframe appear
- [ ] canAdvance is false when current field invalid, true otherwise
- [ ] totalSteps reflects actual visible step count (changes with goal/safety gate)
- [ ] Each individual function under 80 lines (eslint: max-lines-per-function)
- [ ] Cognitive complexity under 15 per function (sonarjs)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

- **02-onboarding-calculations** — imports `checkSafetyGate` and `calculateOnboardingResults`
- **01-expand-user-schema** — imports `OnboardingFormData` type

## Files to Create/Change

| File | Action |
|------|--------|
| `apps/mobile/src/onboarding/useOnboardingForm.ts` | Create |
| `apps/mobile/src/onboarding/index.ts` | Create — barrel export |
