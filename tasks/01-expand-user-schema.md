# 01 — Expand User Schema

**Source**: `docs/features/02-onboarding.md`

---

## Goal

Extend the User table in op-sqlite to store all profile fields collected during onboarding.

## Description

The current User table (`apps/mobile/src/database/database.ts:10`) only has `id` and
`firebase_uid`. Onboarding requires storing: gender, height, age, current weight, goal,
target weight, timeframe, daily target calories, and macro targets.

Tasks:
1. Define a `User` TypeScript type in `apps/mobile/src/database/types.ts`
2. Define an `OnboardingFormData` type (the input shape before calculation)
3. Update `initDatabase()` CREATE TABLE to include all columns
4. Add `insertUser` to `userRepository.ts` — INSERT on onboarding confirm
5. Add `getUser` to `userRepository.ts` — SELECT by firebase_uid (for Settings later)
6. Keep existing `userExists` as-is (RootNavigator depends on it)
7. Export new types and functions from `apps/mobile/src/database/index.ts`

## Schema

Columns to add (beyond `id TEXT PRIMARY KEY, firebase_uid TEXT UNIQUE NOT NULL`):

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| gender | TEXT NOT NULL | — | 'male' or 'female' |
| height_cm | REAL NOT NULL | — | 100–250 |
| current_weight_kg | REAL NOT NULL | — | 30–300 |
| age | INTEGER NOT NULL | — | 10–120, required for BMR |
| goal | TEXT NOT NULL | — | 'lose', 'maintain', or 'gain' |
| target_weight_kg | REAL | nullable | null when goal=maintain |
| timeframe_days | INTEGER | nullable | null when goal=maintain |
| daily_target_calories | REAL | nullable | set on onboarding confirm |
| protein_g | REAL | nullable | set on onboarding confirm |
| carbs_g | REAL | nullable | set on onboarding confirm |
| fat_g | REAL | nullable | set on onboarding confirm |

No separate `onboarding_complete` flag — implied by `daily_target_calories IS NOT NULL`.

## Acceptance Criteria

- [ ] `types.ts` exports `User` and `OnboardingFormData` types with strict TS types
- [ ] `initDatabase()` CREATE TABLE includes all columns with correct types and constraints
- [ ] Database opens without error on fresh install (table created with all columns)
- [ ] `insertUser(data)` inserts a row and returns the created User
- [ ] `insertUser` fails clearly if firebase_uid already exists (UNIQUE constraint)
- [ ] `getUser(firebaseUid)` returns `User | null` — null when no row exists
- [ ] `userExists(firebaseUid)` still works (unchanged behaviour)
- [ ] `index.ts` exports all new types and functions
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

None — builds on existing `database.ts` and `userRepository.ts`.

## Files to Change

| File | Action |
|------|--------|
| `apps/mobile/src/database/types.ts` | Create — User and OnboardingFormData types |
| `apps/mobile/src/database/database.ts` | Modify — expand CREATE TABLE |
| `apps/mobile/src/database/userRepository.ts` | Modify — add insertUser, getUser |
| `apps/mobile/src/database/index.ts` | Modify — export new types and functions |
