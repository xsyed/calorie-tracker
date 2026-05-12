# 04 — Onboarding Screens & Persist

**Source**: `docs/features/02-onboarding.md` (Steps 1–7, Summary, Confirm, Failure Scenarios)
**Cross-ref**: `docs/features/01-authentication.md` (auth → onboarding transition)
**Cross-ref**: `docs/features/10-settings.md` (Daily Target/Macro Target consumed here)

---

## Goal

Build the onboarding UI screens, summary, confirm-then-persist flow, and wire
the navigation transition to Home.

## Description

Replace the placeholder `OnboardingScreen.tsx` with a real multi-step onboarding
flow using `useOnboardingForm()`.

### 1. Step components (`apps/mobile/src/onboarding/steps/`)

Each step is a pure presentational component receiving props from the hook.

| Step | Input Type | Component |
|------|-----------|-----------|
| Gender | Two large touchable buttons (Male / Female), selected state highlighted | `GenderStep` |
| Age | Numeric TextInput, "years" label | `AgeStep` |
| Height | Numeric TextInput, "cm" label | `HeightStep` |
| Current weight | Numeric TextInput, "kg" label | `WeightStep` |
| Goal | Three touchable buttons (Lose / Maintain / Gain), selected highlighted | `GoalStep` |
| Target weight | Numeric TextInput, "kg" label. Hint: "Must be lower than current weight" (lose) or "higher" (gain) | `TargetWeightStep` |
| Timeframe | Numeric TextInput + unit picker (Days / Weeks / Months). Convert to days: `number × {1, 7, 30}`. Store as `timeframe_days`. | `TimeframeStep` |
| Safety gate | Rejection message + "Accept X days" / "Revise goal" buttons | `SafetyGateStep` |
| Summary | Calculation results display + Confirm button + Back button | `SummaryStep` |

All numeric inputs: `keyboardType="numeric"`, `returnKeyType="done"`.

### 2. OnboardingScreen (`apps/mobile/src/screens/OnboardingScreen.tsx`)

- Uses `useOnboardingForm()` hook
- Renders current step component based on `step`
- Shows progress indicator: "Step {stepIndex + 1} of {totalSteps}" or a progress bar
- Dark mode support (follow `useColorScheme` pattern from `LoginScreen.tsx`)
- KeyboardAvoidingView on iOS
- ScrollView wrapping content for small screens

### 3. Summary screen details

Display:
- Daily Target: `{calculationResults.dailyTarget} kcal/day`
- Macro Targets: `Protein: {proteinG}g | Carbs: {carbsG}g | Fat: {fatG}g`
- Goal: human-readable (`Weight Loss`, `Maintenance`, `Weight Gain`)
- Timeframe: displayed only if goal ≠ maintain
- Minimum calorie warning if `calculationResults.calorieFloorWarned`

Back button → `goBack()` to adjust inputs.
Confirm button → persist to DB → navigate to Home.

### 4. Confirm → Persist flow

```ts
async function handleConfirm() {
  setSaving(true);
  try {
    const userId = generateId(); // crypto.randomUUID() or similar
    await insertUser({
      id: userId,
      firebase_uid: auth.user.uid,
      gender: formData.gender,
      height_cm: formData.height_cm,
      current_weight_kg: formData.current_weight_kg,
      age: formData.age,
      goal: formData.goal,
      target_weight_kg: formData.target_weight_kg ?? null,
      timeframe_days: formData.timeframe_days ?? null,
      daily_target_calories: results.dailyTarget,
      protein_g: results.proteinG,
      carbs_g: results.carbsG,
      fat_g: results.fatG,
    });
    // Navigate to Home
  } catch (err) {
    setSaveError('Failed to save. Try again.');
  } finally {
    setSaving(false);
  }
}
```

Show ActivityIndicator while saving. Show inline error on failure — keep form data intact for retry.

### 5. RootNavigator transition

After DB insert, navigate to Home. The current `RootNavigator.tsx` uses conditional
rendering of screens — registered screens depend on `userCheckState`. After onboarding
confirm, this state must reflect that the User row exists.

Minimal change: after DB insert in OnboardingScreen, trigger a re-evaluation in
RootNavigator. Options (implementer chooses the simplest that works):
- Always register all screens, use `navigation.navigate('Home')`
- Or register a callback/event that updates `userCheckState`

### 6. Accessibility

- All text must respect Dynamic Type (no fixed font sizes, use system font scaling)
- Touch targets: minimum 44×44pt (Apple HIG)
- Test labels: each interactive element needs an `accessibilityLabel`
- Test at largest OS font size — verify no text clipping or layout breakage

## Acceptance Criteria

- [ ] OnboardingScreen renders GenderStep on mount (step 1)
- [ ] Each step shows its own UI: correct input type, label, error display
- [ ] "Next" button disabled when current field invalid (`canAdvance === false`)
- [ ] "Back" button returns to previous step, form data preserved
- [ ] Progress indicator updates as user advances through steps
- [ ] Goal=maintain: target weight + timeframe steps are skipped entirely
- [ ] Goal=lose/gain: target weight + timeframe steps appear
- [ ] Timeframe unit picker (Days/Weeks/Months) converts correctly to days
- [ ] Safety gate rejection: interstitial screen with message "This is too fast. A safe timeframe is X days."
- [ ] Safety gate "Accept X days" advances to summary with adjusted timeframe
- [ ] Safety gate "Revise goal" returns to goal selection step
- [ ] Summary shows all calculation results correctly formatted
- [ ] Summary shows calorie floor warning if `warned === true`
- [ ] Confirm button shows loading spinner while inserting
- [ ] Confirm failure shows retryable error message, form data preserved
- [ ] Confirm success navigates to Home screen (HomeScreen renders)
- [ ] RootNavigator correctly transitions from Onboarding to Home after confirm
- [ ] Back from summary clears results but keeps form values
- [ ] All inputs respect Dynamic Type — no text clipping at largest font size
- [ ] All touch targets ≥ 44pt (no tiny tappable areas)
- [ ] Dark mode: all text and backgrounds invert correctly
- [ ] Keyboard avoids covering inputs on iOS (KeyboardAvoidingView)
- [ ] ScrollView allows scrolling when keyboard is open on small screens
- [ ] Each component file ≤ 300 lines, each function ≤ 80 lines
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

- **01-expand-user-schema** — `insertUser` function, `User` type
- **02-onboarding-calculations** — `OnboardingResults`, `SafetyGateResult` types
- **03-onboarding-form-hook** — `useOnboardingForm()` hook with all its API

## Files to Create/Change

| File | Action |
|------|--------|
| `apps/mobile/src/onboarding/steps/GenderStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/AgeStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/HeightStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/WeightStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/GoalStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/TargetWeightStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/TimeframeStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/SafetyGateStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/SummaryStep.tsx` | Create |
| `apps/mobile/src/onboarding/steps/index.ts` | Create — barrel export |
| `apps/mobile/src/screens/OnboardingScreen.tsx` | Modify — replace placeholder |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Modify — wire Home transition |

## Notes

- No form library needed — use `TextInput` + `Pressable` natively
- No in-memory cache for user data — DB is source of truth
- Confirm writes a full row in one `INSERT` — no partial saves
- App-kill during onboarding loses all progress (acceptable per v1 spec line 137)
