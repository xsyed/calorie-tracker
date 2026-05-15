# Water Storage and Repository

## Goal

Add the local SQLite storage and repository APIs needed for water tracking.

## Description

Create a `WaterEntry` persistence model backed by SQLite. Each entry belongs to the current app user and stores the logged amount, the date being tracked, and the actual timestamp when the entry was created. Add the indexes and repository methods required by Home and the Water screen.

Persist the daily water goal locally with a default of `2000ml/day`. Use the existing persistence approach that best fits the current architecture, either the `User` table if that remains the local user settings store, or an existing settings store if one exists by implementation time.

All behavior is local-only. Do not add API calls, background jobs, sync queues, or backend assumptions.

## Acceptance Criteria

- [ ] SQLite has a water entries table with `user_id`, `date`, `amount_ml`, and `timestamp`.
- [ ] Water entries can be inserted for a specific user and date.
- [ ] Water entries can be deleted by id for the current user.
- [ ] A daily total can be queried for one user and one date.
- [ ] Daily entries can be queried for one user and one date, ordered by timestamp.
- [ ] A date-range aggregate can be queried as `date` plus summed `total_ml`, ordered ascending by date.
- [ ] The date-range aggregate supports the Water screen default period of the last 7 days.
- [ ] Storage includes an index suitable for `user_id` plus `date` queries.
- [ ] The daily water goal defaults to `2000ml` when no custom value exists.
- [ ] The daily water goal can be read and persisted locally.
- [ ] Repository operations surface database failures to callers so UI can show an error and revert optimistic updates.
- [ ] No network dependency is introduced.
- [ ] `npm run check` passes.

## Dependencies

None
