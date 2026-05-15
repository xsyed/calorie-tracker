# Water Trend and History

## Goal

Add the Water screen trend chart and multi-day history.

## Description

Extend the Water screen with a default 7-day trend and a history section. The trend uses local aggregate data only and should be lightweight enough to avoid a heavy charting dependency unless the codebase already has one.

Chart scaling should use the active daily goal as the main visual reference. The goal line remains fixed at the configured goal, with bars allowed to exceed the goal when intake is higher.

## Acceptance Criteria

- [ ] Water screen queries aggregate water totals for the default last 7 days.
- [ ] Trend data includes days with no entries as `0ml`.
- [ ] Trend renders 7 data points in date order.
- [ ] Trend chart uses the daily goal as the primary Y-axis reference.
- [ ] Trend chart shows a goal line.
- [ ] Bars or points can extend above the goal when daily intake exceeds the goal.
- [ ] Trend rendering does not add a heavy charting library unless already present in the app.
- [ ] History groups entries by date for the displayed period.
- [ ] History shows each entry amount and time.
- [ ] History is derived from local SQLite data only.
- [ ] Empty states are shown when no water entries exist for the period.
- [ ] Trend and history refresh after adding or deleting an entry on the Water screen.
- [ ] `npm run check` passes.

## Dependencies

- `01-water-storage-and-repository.md`
- `03-water-screen-daily-logging.md`
