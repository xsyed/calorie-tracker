# Home Water Quick-Add

## Goal

Show daily water progress on Home and support quick-add logging from Home.

## Description

Add a Home screen water section for the currently selected date. It should show the daily total against the configured goal, display a progress indicator, and provide `+200ml` and `+500ml` quick-add actions.

Quick-add logs to the selected date being viewed on Home, not always today. Make that date context visible near the controls so users understand where the entry will be recorded.

The Home water section is also the entry point to the dedicated Water screen. Water must not be added as a bottom tab.

## Acceptance Criteria

- [ ] Home displays water progress for the selected date.
- [ ] Home displays daily total in ml and the active daily goal.
- [ ] Home progress handles the default `2000ml` goal without divide-by-zero or `NaN` states.
- [ ] Home has `+200ml` and `+500ml` quick-add buttons.
- [ ] Quick-add inserts a water entry for the current user and selected Home date.
- [ ] Home recomputes or updates the daily total immediately after a successful insert.
- [ ] Quick-add works without network access.
- [ ] Quick-add buttons have a brief per-button loading or disabled state.
- [ ] Rapid duplicate taps are prevented with a simple debounce or temporary disable of at least 500ms.
- [ ] Database insert failure shows `Failed to log water. Try again.`
- [ ] If an optimistic UI update is used, insert failure reverts the displayed total.
- [ ] Tapping the water progress section or a clear affordance navigates to the Water screen.
- [ ] Water is reachable from Home and is not added as a bottom tab.
- [ ] No quick-add undo flow is added.
- [ ] `npm run check` passes.

## Dependencies

- `01-water-storage-and-repository.md`
