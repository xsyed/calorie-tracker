# Water Screen Daily Logging

## Goal

Build the dedicated Water screen daily logging experience.

## Description

Add a Water screen reached from Home. The screen should show the selected date, the daily total, the configured goal, the progress indicator, daily entries for that date, and controls for adding water.

The screen supports fixed quick-add amounts for `+100ml`, `+200ml`, and `+500ml`, plus a custom amount input. Custom input uses a numeric keyboard and validates values before insert.

Daily entries can be deleted through a deliberate delete interaction with confirmation. After add or delete, the daily total and entry list are refreshed.

## Acceptance Criteria

- [ ] Water screen is registered in the authenticated navigation stack.
- [ ] Water screen can be opened from Home for the selected date.
- [ ] Water screen header shows the date being edited.
- [ ] Water screen has a back action.
- [ ] Water screen shows daily progress as total ml, goal ml, and percent.
- [ ] Water screen lists entries for the selected date with time and amount.
- [ ] Water screen has `+100ml`, `+200ml`, and `+500ml` add controls.
- [ ] Water screen has a custom amount input using a numeric keyboard.
- [ ] Custom amount validation requires an amount greater than `0ml`.
- [ ] Custom amount validation rejects amounts above `5000ml`.
- [ ] Invalid custom input shows an inline error and does not insert an entry.
- [ ] Successful add inserts a water entry for the current user and selected date.
- [ ] Database insert failure shows `Failed to log water. Try again.`
- [ ] Entries can be deleted with confirmation text equivalent to `Delete this entry?`
- [ ] After delete, the daily total and entry list are recalculated.
- [ ] Database delete failure leaves the entry visible and shows an error.
- [ ] No network dependency is introduced.
- [ ] `npm run check` passes.

## Dependencies

- `01-water-storage-and-repository.md`
- `02-home-water-quick-add.md`
