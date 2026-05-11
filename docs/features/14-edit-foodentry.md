# TDD: Edit FoodEntry

## Feature Summary
User can edit a previously logged FoodEntry's raw text prompt and re-submit to the LLM for fresh parsing. The old FoodEntry + FoodItems are deleted (in a transaction, after successful parse) and replaced with the new result. No revision history is kept — edit-in-place only. Original raw text is shown below the edited prompt for transparency.

---

## Data Flow

```
User is on Home screen, views today's entries
  │
  ▼
Tap on an existing FoodEntry (in the entry list)
  │
  ▼
Entry detail / action menu appears:
  ┌─ Entry Actions ─────────────────────────────┐
  │  "2 scrambled eggs, toast with butter"       │
  │    • scrambled eggs  140 kcal  P12 C0 F10   │
  │    • toast           70 kcal   P3 C14 F1    │
  │    • butter          72 kcal   P0 C0 F8     │
  │                                              │
  │  [Edit Prompt]  [Save as Meal]  [Delete]     │
  └──────────────────────────────────────────────┘
  │
  ▼
User taps "Edit Prompt"
  │
  ▼
Edit screen (modal or inline expansion on Home):
  ┌─ Edit Entry ────────────────────────────────┐
  │                                              │
  │  New prompt:                                 │
  │  ┌──────────────────────────────────────┐    │
  │  │ 2 scrambled eggs, toast with butter  │    │
  │  └──────────────────────────────────────┘    │
  │                                              │
  │  Original prompt (read-only):                │
  │  "2 eggs on toast"                           │
  │                                              │
  │  [Cancel]  [Re-submit to LLM]                │
  └──────────────────────────────────────────────┘
  │
  ▼
User modifies prompt: "2 scrambled eggs, toast with butter, and coffee"
  │
  ▼
Tap "Re-submit to LLM"
  │
  ▼
Check connectivity
  ├── OFFLINE → Cannot edit when offline (LLM required). Show error.
  └── ONLINE:
        │
        ▼
      POST /api/parse with new prompt (same flow as 03-llm-logging.md)
      Show loading state on the edit form
        │
        ├── PARSE FAILED (rate limit, error, timeout):
        │     → Show error but DO NOT delete old entry
        │     → User can edit prompt again and retry
        │     → Or cancel → old entry remains intact
        │
        └── PARSE SUCCEEDED (200 with foods[] and exercises[]):
              │
              ▼
            BEGIN TRANSACTION
              1. Query old FoodEntry to confirm it still exists
                 and still belongs to this user (defensive check)
              2. DELETE FROM food_items WHERE food_entry_id = old_entry.id
              3. DELETE existing ExerciseEntries for this FoodEntry (if any:
                 exercise entries are tied to user+date, not food_entry_id,
                 so need careful handling — see note below)
              4. UPDATE food_entries SET
                   raw_text = new_prompt,
                   status = 'complete'
                 WHERE id = old_entry.id
              5. INSERT new FoodItems for each item in response.foods[]
              6. INSERT new ExerciseEntry if response.exercises[] non-empty
                 (DELETE old exercise entries for this user+date first,
                  or overwrite — exercise is date-based, not entry-linked)
            COMMIT
            │
            ▼
          Dismiss edit screen
          Home screen updates: new FoodItems shown, macros recalculated

═══ Handling ExerciseEntry on Edit ═══

ExerciseEntry is date-based (user_id + date), NOT linked to a specific FoodEntry.
This means on edit, we cannot simply replace "the" ExerciseEntry — there may be
multiple or none.

Options:
  A. Link ExerciseEntry to FoodEntry via optional food_entry_id FK.
     → Schema change: add food_entry_id (nullable) to exercise_entries.
     → On edit: DELETE WHERE food_entry_id = old_entry.id.
     → Pros: clean, explicit link. Cons: schema change not in current spec.

  B. Remove all exercise entries for the date and re-create from LLM response.
     → DELETE FROM exercise_entries WHERE user_id=? AND date=?
     → Then insert new ones from LLM response.
     → Pros: no schema change. Cons: destroys exercise entries from OTHER
       FoodEntries logged on the same date.

  C. Track which exercise entries came from which prompt (in-memory or metadata).
     → Not practical without schema support.

  D. On edit: only update food items. Leave exercise entries untouched.
     → Pros: simple. Cons: stale exercise data remains if user changed
       the exercise portion of the prompt.

Decision: Option A. Add `food_entry_id` to exercise_entries as a nullable FK.
This properly scopes exercise entries to their source prompt and enables clean
edit/delete. Null = manually logged exercise or legacy data.
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| POST /api/parse (backend proxy) | Re-parse edited prompt | HTTPS REST |
| SQLite (local) | Transaction for delete + insert | Local |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Edit mode visibility (modal open / inline expanded) | Component state | Screen session |
| Edited prompt text | Component state (initialized from existing raw_text) | Edit session |
| Original prompt text (read-only display) | Extracted from current FoodEntry.raw_text | Edit session |
| Parse loading state | Component state | During /api/parse call |
| Parse error state | Component state | Per edit attempt |
| Old FoodEntry data (used for rollback if needed) | In-memory via component props or query | Edit session |
| FoodEntry actions menu visibility | Component state | Ephemeral |

---

## Background Jobs

None. All operations are synchronous within user interaction.

---

## Battery / Performance Impact

- **Battery**: Same as LLM logging (03-llm-logging.md): one HTTPS request. Negligible.
- **Performance**:
  - SQLite transaction: DELETE FoodItems + DELETE ExerciseEntries + UPDATE FoodEntry + INSERT FoodItems + INSERT ExerciseEntry. Within a single transaction: <10ms.
  - The dominant factor is the /api/parse call (1-3s).
  - UI: re-render of the edited entry row + daily summary recalculation. Minimal.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Parse fails after old entry already deleted** | Transaction not used, old data deleted before parse completed | Data loss — old entry gone, new entry not created | CRITICAL: Use transaction. DELETE old data only AFTER successful parse response is received and validated. If parse fails, old entry remains. Transaction ensures atomicity. |
| **Transaction partially commits** | SQLite error mid-transaction (disk full) | Partial state: some items deleted, some not | SQLite transactions are atomic. If any part fails, entire transaction rolls back. Old entry intact. Catch error, show "Edit failed. Your original entry is preserved." |
| **Parse returns empty arrays** | User's edited prompt is unrecognizable: "asdfghjkl" | If we deleted old entry, nothing to show. | Parse BEFORE delete. If response has empty foods[] and empty exercises[]: show "Nothing recognized in your new prompt. Try rephrasing." Do NOT delete old entry. |
| **User cancels edit** | User opens edit, changes prompt, then hits Cancel | No change. Old entry preserved. | Simply dismiss edit form. No DB writes occurred. |
| **Concurrent edit by queue flusher** | Entry was pending (offline), queue flusher picks it up while user is editing | Race: flusher updates entry, user's edit conflicts | Lock: if entry.status = 'pending' and is being flushed, disable edit button. Show "Entry is being processed. Editing will be available once complete." |
| **Edit entry from a different date** | User navigates to past date, edits a FoodEntry from last week. The edited FoodEntry's date stays the same (date is NOT changed by edit). | Expected behavior. FoodEntry.date is preserved. | Edit only changes raw_text and FoodItems. Date remains unchanged. |
| **User edits prompt, LLM returns different foods than original** | Original: "eggs and toast" (eggs=140, toast=70). Edited: "just coffee" (coffee=5). | Expected behavior — that's the point of editing. Old items replaced entirely. | No issue. |
| **User edits prompt but only fixes a typo** | Original: "2 scrambeled eggs". Edits to: "2 scrambled eggs". LLM should return similar result. | Minor change. Full re-parse is overkill but ensures consistency. | Acceptable. Single LLM call per edit is ~1-2s. |
| **Cannot access previous prompt for reference** | FoodEntry.raw_text was updated from "eggs" to "eggs and toast" on first edit. Original "eggs" is lost. | Only the most recent edit's "original" is shown. No full edit history. | This is by design (design decision #6). No revision history. |
| **Dietary/allergen change** | User edits to remove a food item they're allergic to. LLM correctly excludes it. | Expected. | No issue. |
| **Deleted FoodEntry but it was a Saved Meal source** | User saved "My Breakfast" from a FoodEntry, then later edits that FoodEntry. | SavedMeal is independent copy (SavedMealItems are copies, not references). No impact on Saved Meal. | By design: SavedMealItems are stored separately. |
| **Delete entire FoodEntry (separate action from Edit)** | User taps "Delete" on entry actions menu | FoodEntry + FoodItems + linked ExerciseEntries removed | DELETE transaction: 1. Check entry exists. 2. DELETE food_items WHERE food_entry_id = ?. 3. DELETE exercise_entries WHERE food_entry_id = ? (if FK added). 4. DELETE food_entries WHERE id = ?. COMMIT. Show undo snackbar ("Entry deleted. Undo?") with 5s timeout. Undo = re-insert from cached data. |
| **Undo delete timeout** | User deletes, walks away, comes back > 5s later, taps Undo | Undo no longer available. Entry permanently gone. | 5s is reasonable. Could extend to 10s. Food logs are low-stakes — user can recreate with same prompt. |

---

## Constraints
- Edit is in-place replacement. No revision history kept.
- Original raw text shown below edited prompt for reference. Not editable.
- Parse new prompt BEFORE deleting old data (defensive: avoid data loss on parse failure).
- Use SQLite transaction for atomicity of delete + insert.
- Date of FoodEntry is NOT changed by edit.
- Editing a pending entry (status=pending) is not allowed while it's being flushed.
- ExerciseEntry editing requires schema change: add food_entry_id FK to exercise_entries.
- Delete action: use optimistic delete with undo snackbar.
