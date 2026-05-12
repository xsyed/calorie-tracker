# Task: Wire Voice Input into HomeScreen

## Goal
Integrate `useVoiceInput` hook into HomeScreen, connecting voice text flow to InputBar so recognized speech is inserted for user review/editing before LLM submission.

## Description
HomeScreen is the orchestrator. It owns the `useVoiceInput` hook, passes voice state to InputBar, handles voice text insertion, and displays voice-specific errors. Voice text flows through the exact same `handleSubmit` → `parseFoodText` pipeline as typed text.

### What to modify
- `apps/mobile/src/screens/HomeScreen.tsx` — integrate voice hook, wire to InputBar

### Key integration points
1. `useVoiceInput()` hook is called in HomeScreen
2. InputBar receives voice props: `voiceStatus`, `voicePartialText`, `voiceError`, `isVoiceAvailable`, `onMicPress`
3. `onMicPress` toggles: idle → `startListening()`, listening → `stopListening()`
4. When `finalText` is non-null (voice completed), insert into InputBar via ref, then call `clearFinalText()`
5. Voice errors from `useVoiceInput.error` displayed via existing error banner
6. Mic disabled when `isSubmitting === true` (user is waiting for LLM response)
7. Voice text inserted into InputBar is editable — user can modify before tapping Submit
8. Submit flow unchanged — text goes through `handleSubmit` → LLM pipeline from `03-llm-logging.md`

### Error message mapping
Voice-specific error messages from `useVoiceInput.error`:
- Permission denied → "Microphone access needed. Enable in Settings." + iOS: `Linking.openURL('app-settings:')` on action
- Unavailable locale → "Voice input not available for your device language."
- No speech → "Didn't catch that. Tap mic to try again."
- Android: no Google Speech → "Google Speech Services required."
- Android: no network → "Voice input needs internet."
- Audio conflict → "Cannot use mic while another app is using it."

General errors (already handled by existing error banner auto-dismiss at 5s) — voice errors follow same pattern.

### Mic disabled during submission
When `isSubmitting === true`, pass `isVoiceAvailable: false` to InputBar to disable mic button. User should not start voice recognition while an LLM request is in-flight.

## Acceptance Criteria

### Voice lifecycle wiring
- [ ] `useVoiceInput()` hook is called at top level of `HomeScreen`
- [ ] InputBar receives `voiceStatus`, `voicePartialText`, `isVoiceAvailable`, `onMicPress` props
- [ ] `onMicPress` calls `startListening()` when `voiceStatus` is `idle`/`stopped`/`error`
- [ ] `onMicPress` calls `stopListening()` when `voiceStatus` is `listening`/`processing`
- [ ] InputBar receives `ref` from HomeScreen via `useRef<InputBarHandle>`

### Text insertion
- [ ] When `voiceStatus` changes to `stopped` AND `finalText` is non-null and non-empty:
  - `ref.current.setText(finalText)` is called — text appears in InputBar
  - `clearFinalText()` is called immediately after
- [ ] When `finalText` is empty string (user spoke nothing / noise / "Didn't catch that"):
  - No text inserted, no `setText` call
  - Error banner shows "Didn't catch that. Tap mic to try again."
- [ ] After voice text is inserted, user can edit it — typing, deleting, cursor movement all work
- [ ] Submitting voice-inserted text triggers `handleSubmit` which calls `parseFoodText` — identical flow to typed input

### Mic disabled during LLM submission
- [ ] When `isSubmitting === true`, `isVoiceAvailable` passed to InputBar is `false`
- [ ] Mic button appears disabled/grayed during submission
- [ ] `onMicPress` is a no-op when `isSubmitting` (InputBar already guards this via `isVoiceAvailable === false`)

### Error display
- [ ] When `useVoiceInput` produces an error (`.error` field non-null), it's displayed in the existing error banner
- [ ] Voice errors auto-dismiss after 5 seconds (same as existing error banner behavior)
- [ ] Permission denied error text: "Microphone access needed. Enable in Settings."
- [ ] Unavailable locale error: "Voice input not available for your device language."
- [ ] Android: no Google Speech error: "Google Speech Services required."
- [ ] Android: no network error: "Voice input needs internet."
- [ ] Audio conflict error: "Cannot use mic while another app is using it."

### Manual stop → partial text preserved
- [ ] User taps mic to stop listening → `stopListening()` is called → `finalText` set to whatever was recognized so far → inserted into InputBar
- [ ] Silence timeout triggers same behavior (auto-stop → partial inserted)

### Background interruption
- [ ] When app goes to background while listening, `useVoiceInput` auto-stops → partial text inserted into InputBar

### State reset
- [ ] Voice state resets when navigating away from HomeScreen (component unmount cleans up effect in hook)
- [ ] No stale voice state on re-mount

### No regressions
- [ ] Typing text and submitting without using voice still works exactly as before
- [ ] Error banner for LLM errors still displays correctly
- [ ] Keyboard avoiding view behavior unchanged
- [ ] Dark mode works for all voice-related UI (handled by InputBar/WaveformIndicator in Task 3)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies
- `02-create-voice-service` — requires `useVoiceInput` hook
- `03-add-mic-button-to-inputbar` — requires InputBar voice props and `setText` ref
