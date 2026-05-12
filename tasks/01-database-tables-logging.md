# Task 01: Database Tables & Types for Logging Entities

## Goal

Create SQLite tables and TypeScript types for `food_entries`, `food_items`, and `exercise_entries`.

## Description

Add `CREATE TABLE IF NOT EXISTS` statements to `database.ts` following the existing pattern used for the `User` table. Define matching TypeScript interfaces in `types.ts` with strict types. The tables must support the full FoodEntry status lifecycle (pending → complete → failed).

### Tables to create

**food_entries**
| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NOT NULL |
| date | TEXT | NOT NULL (ISO date string 'YYYY-MM-DD') |
| raw_text | TEXT | NOT NULL |
| status | TEXT | NOT NULL DEFAULT 'pending' (values: 'pending', 'complete', 'failed') |
| retry_count | INTEGER | NOT NULL DEFAULT 0 |
| created_at | TEXT | NOT NULL (ISO 8601 timestamp) |

**food_items**
| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| food_entry_id | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| calories | REAL | NOT NULL |
| protein_g | REAL | NOT NULL |
| carbs_g | REAL | NOT NULL |
| fat_g | REAL | NOT NULL |

**exercise_entries**
| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NOT NULL |
| date | TEXT | NOT NULL (ISO date string 'YYYY-MM-DD') |
| exercise_type | TEXT | NOT NULL |
| duration_minutes | REAL | NOT NULL |
| calories_burned | REAL | NOT NULL |
| timestamp | TEXT | NOT NULL (ISO 8601 timestamp) |

**app_settings** (key-value store for device_id, etc.)
| Column | Type | Constraints |
|---|---|---|
| key | TEXT | PRIMARY KEY |
| value | TEXT | NOT NULL |

### Types to add

```ts
interface FoodEntry {
  id: string;
  user_id: string;
  date: string;
  raw_text: string;
  status: 'pending' | 'complete' | 'failed';
  retry_count: number;
  created_at: string;
}

interface FoodItem {
  id: string;
  food_entry_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface ExerciseEntry {
  id: string;
  user_id: string;
  date: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  timestamp: string;
}

interface AppSetting {
  key: string;
  value: string;
}
```

### Files to modify

- `apps/mobile/src/database/database.ts` — add 4 CREATE TABLE statements (after existing User table)
- `apps/mobile/src/database/types.ts` — add FoodEntry, FoodItem, ExerciseEntry, AppSetting interfaces
- `apps/mobile/src/database/index.ts` — export new types

## Acceptance Criteria

- [ ] `database.ts` defines `food_entries`, `food_items`, `exercise_entries`, and `app_settings` tables with correct columns and types
- [ ] All tables use `CREATE TABLE IF NOT EXISTS` (idempotent, no migration needed)
- [ ] `types.ts` exports `FoodEntry`, `FoodItem`, `ExerciseEntry`, `AppSetting` interfaces
- [ ] `status` field on `FoodEntry` is typed as `'pending' | 'complete' | 'failed'` union
- [ ] `index.ts` re-exports all new types
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

None
