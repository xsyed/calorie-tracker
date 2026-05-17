# Calories App

A mobile calorie tracker that uses LLM-powered food/exercise parsing from freeform text, with water and weight tracking.

## Language

**FoodEntry**:
A single logged meal or snack, containing a raw text prompt and LLM-derived macro totals.
_Avoid_: Meal log, food diary entry, meal record

**FoodItem**:
A specific food parsed by the LLM from the FoodEntry raw prompt, with individual calories, protein, carbs, and fat.
_Avoid_: Ingredient, food component

**WaterEntry**:
A record of water consumed — amount, timestamp, and date.
_Avoid_: Hydration log, drink entry

**WeightEntry**:
A weigh-in record — weight in kg, date, timestamp.
_Avoid_: Scale reading, body weight record

**ExerciseEntry**:
A logged exercise session with duration, type, and estimated calories burned. Calories are informational — they do not offset the daily calorie budget.
_Avoid_: Workout, activity log

**Daily Target**:
The calorie limit calculated during onboarding from BMR, goal, and timeframe. Later adjustable in Settings.
_Avoid_: Calorie budget, daily allowance

**Saved Meal**:
A named template created by the user from a FoodEntry, reusable for repeated logging.
_Avoid_: Meal preset, recipe, favorite

**History**:
Past FoodEntries grouped chronologically for repeat-use convenience. Auto-populated; not user-curated.
_Avoid_: Recents, past meals

**Macro Target**:
Daily protein, carbs, and fat gram targets derived from the Daily Target calorie goal using goal-driven ratios (e.g. weight loss = 40/30/30). Adjustable in Settings.
_Avoid_: Macro budget, nutrition targets

**Onboarding**:
First-run flow collecting gender, height, current weight, goal (lose/maintain/gain), target weight, and timeframe. Calculates Daily Target and Macro Targets using Mifflin-St Jeor BMR formula. Blocks unsafe weight-loss rates (>1kg/week).
_Avoid_: Setup wizard, initial configuration

**Backup**:
File-level SQLite backup via backend API on Fly.io volume (Android). Not structured cross-device sync.
_Avoid_: Sync, cloud sync

## Relationships

- A **FoodEntry** contains one or more **FoodItems**
- A **FoodEntry** belongs to exactly one User and one date
- A **WaterEntry** belongs to exactly one User and one date
- A **WeightEntry** belongs to exactly one User and one date
- An **ExerciseEntry** belongs to exactly one User and one date
- A **Saved Meal** is created from a **FoodEntry** and produces new **FoodEntries** when applied
- The **Daily Target** derives protein, carbs, and fat **Macro Targets** via goal-driven ratios

## Example dialogue

> **Dev:** "When the user edits a FoodEntry's prompt, do we keep the old FoodItems?"
> **Domain expert:** "No — the old FoodEntry is replaced in place with the new LLM result."

> **Dev:** "Do exercise calories count against the Daily Target?"
> **Domain expert:** "No — ExerciseEntry calories are purely informational. Only food calories count toward the Daily Target."

> **Dev:** "How does the app know if the user's input is food or exercise?"
> **Domain expert:** "The LLM auto-detects it. One prompt can return both foods and exercises — e.g. 'I had pancakes then ran 5km' produces both a FoodEntry and an ExerciseEntry."

## Flagged ambiguities

- "calorie deficit" was initially discussed as including exercise — resolved: exercise is shown separately, not subtracted from food budget.
- "sync" was initially described as real-time cross-device sync — resolved: file-level backup/restore via backend API on Fly.io volume (Android), not structured merge sync.
