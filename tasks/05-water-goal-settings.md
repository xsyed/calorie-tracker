# Water Goal Settings

## Goal

Allow users to view and change their daily water goal from the Water screen.

## Description

Add a goal settings affordance on the Water screen. Users can view the current goal, change it, and have the new value persist locally. The rest of water tracking should use the saved goal immediately after it changes.

The default goal remains `2000ml/day` when the user has not saved a custom goal.

## Acceptance Criteria

- [ ] Water screen shows a clear goal settings affordance.
- [ ] Current goal is displayed as ml/day.
- [ ] If no custom goal exists, the displayed goal is `2000ml/day`.
- [ ] User can enter a custom daily goal in ml.
- [ ] Goal input uses a numeric keyboard.
- [ ] Goal validation rejects non-positive values.
- [ ] Goal validation rejects unreasonably high values using the same upper-bound style as custom entries unless product code defines a separate constant.
- [ ] Invalid goal input shows an inline error and does not persist.
- [ ] Valid goal input persists locally.
- [ ] Home progress uses the updated goal after it is changed.
- [ ] Water screen progress and trend goal line use the updated goal after it is changed.
- [ ] No onboarding requirement is introduced for setting a water goal.
- [ ] No network dependency is introduced.
- [ ] `npm run check` passes.

## Dependencies

- `01-water-storage-and-repository.md`
- `03-water-screen-daily-logging.md`
- `04-water-trend-and-history.md`
