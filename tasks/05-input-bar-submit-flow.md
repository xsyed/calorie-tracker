# Task 05: Input Bar & Submit Flow

## Goal

Implement the text input bar on the HomeScreen and the full submit pipeline: connectivity check → LLM parse → database save → UI update.

## Description

Build the input bar component and integrate the submit flow into `HomeScreen.tsx`. The submit handler orchestrates all previously built services (connectivity, LLM parse, repository). This is the glue that wires together Tasks 01–04 into a working logging feature.

### InputBar component

Create `apps/mobile/src/components/InputBar.tsx`:

```tsx
interface InputBarProps {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function InputBar({ onSubmit, isSubmitting }: InputBarProps)
```

Behavior:
- `TextInput` with placeholder "What did you eat or do?"
- Submit button (or keyboard return key) triggers `onSubmit(text)`
- While `isSubmitting`: disable input, show loading indicator (ActivityIndicator) in place of submit button
- After successful submit: clear input field
- After failed submit: keep text in input so user can retry

### Submit handler (in HomeScreen)

The `handleSubmit` function in `HomeScreen.tsx`:

```
1. Validate: text.trim() is non-empty → if empty, do nothing
2. Set isSubmitting = true, clear any previous error
3. Call parseFoodText(text) from llmService
4. On success (outcome === 'success'):
   a. Call saveParsedLogEntry from foodRepository with userId, today's date, rawText, foods, exercises
   b. On DB success: clear input, reset isSubmitting
   c. On DB failure: show error toast, keep text in input, reset isSubmitting
5. On error (outcome === 'error'):
   a. Map error code to user-facing message per spec table below
   b. Keep text in input (user can retry or edit)
   c. Reset isSubmitting
```

### Error code → user message mapping

| Error Code | User Message |
|---|---|
| `no_network` | "No internet. Your entry will be saved offline." |
| `token_refresh_failed` | "Session expired. Please sign in again." |
| `rate_limit_exceeded` | "Daily limit reached. Try again tomorrow." |
| `invalid_token` | "Session expired. Please sign in again." |
| `parse_failed` | "Couldn't understand that. Try rephrasing." |
| `llm_timeout` | "Request timed out. Tap to retry." |
| `llm_error` | "Something went wrong. Tap to retry." |
| `empty_result` | "Nothing recognized. Try describing what you ate or did." |
| `server_error` | "Service unavailable. Tap to retry." |
| `network_error` | "Connection failed. Tap to retry." |

Note: `no_network` delegates to offline queue in feature 05. For now, just show the toast and save the entry as status='pending' with raw_text preserved (the offline queue will process it later). Use `insertFoodEntry` directly (not `saveParsedLogEntry`) to create a pending entry.

### Loading / error states

- `isSubmitting: boolean` — true while parse+save is in flight
- `error: string | null` — shown as a temporary banner/tooltip below the input bar, auto-clears after 5 seconds or on next submit
- Input bar: disabled while submitting, ActivityIndicator replaces submit icon

### HomeScreen layout (minimal)

Replace the stub content with a basic layout:

```
┌──────────────────────────────────┐
│  Home                            │  (header placeholder)
│                                  │
│  (space for daily summary —      │
│   implemented in feature 06)     │
│                                  │
│  (space for entry list —         │
│   implemented in feature 06)     │
│                                  │
│                                  │
├──────────────────────────────────┤
│  [error banner if error]         │
│  [Type what you ate...]  [Send]  │
└──────────────────────────────────┘
```

The daily summary area and entry list area are placeholders — they will be filled in by feature 06. For this task, just leave space and ensure the input bar is pinned to the bottom.

### Keyboard avoidance

- Use `KeyboardAvoidingView` with `behavior="padding"` on iOS
- Input bar should be pinned to bottom of screen, pushing up when keyboard appears
- Submit on keyboard return key triggers submit

### Files to create/modify

- **Create** `apps/mobile/src/components/InputBar.tsx`
- **Modify** `apps/mobile/src/screens/HomeScreen.tsx` — replace stub with layout + submit flow

## Acceptance Criteria

- [ ] Input bar renders at bottom of HomeScreen with placeholder text
- [ ] Tapping submit (or keyboard return) with empty text does nothing
- [ ] Tapping submit with text calls `parseFoodText`, shows loading spinner, disables input
- [ ] On successful parse + save: input clears, loading stops
- [ ] On parse error: error message shown below input, text preserved for retry, loading stops
- [ ] On DB save failure: error message shown, text preserved, loading stops
- [ ] On `no_network` error: entry saved with status='pending' in food_entries, toast shown
- [ ] On `rate_limit_exceeded`: appropriate error message shown, text preserved
- [ ] On `empty_result`: "Nothing recognized" message shown, text preserved
- [ ] Error banner auto-clears after 5 seconds
- [ ] Error banner clears immediately when user starts typing again
- [ ] Keyboard avoidance works — input bar stays visible when keyboard opens
- [ ] Loading state prevents double-submission (isSubmitting guard)
- [ ] Daily summary area and entry list area are empty placeholders (reserved for feature 06)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

- [Task 01: Database Tables & Types for Logging Entities](./01-database-tables-logging.md)
- [Task 02: Food & Exercise Repository Layer](./02-food-exercise-repository.md)
- [Task 03: Connectivity Service](./03-connectivity-service.md)
- [Task 04: LLM Parse Service](./04-llm-parse-service.md)
