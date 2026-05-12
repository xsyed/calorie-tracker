# Task: Create Voice Input Service & Hook

## Goal
Create `useVoiceInput` hook wrapping `@react-native-voice/voice` with full state machine, permission flow, timeout, background handling, platform checks, and all 10 error scenarios from the spec.

## Description
This is the core voice logic layer. It must handle every edge case from `docs/features/04-voice-input.md` sections: Data Flow (lines 8-59), Failure Scenarios (lines 114-128), and Constraints (lines 131-136).

### What to create
- `apps/mobile/src/services/voiceService.ts` — `useVoiceInput` hook
- Update `apps/mobile/src/services/index.ts` barrel export

### State machine
```
idle → (startListening) → listening → (speech ends) → stopped → (finalText consumed) → idle
                                  ↓ (error) → error → idle
                                  ↓ (manual stop) → stopped → idle
                                  ↓ (background) → stopped → idle
                                  ↓ (silence timeout 5s) → stopped → idle
```

### Permission flow (inside `startListening`)
1. Check microphone permission (iOS: already handled by OS when SFSpeechRecognizer activates, Android: `PermissionsAndroid.request('android.permission.RECORD_AUDIO')`)
2. If denied permanently: set error "Microphone access needed"
3. If granted: check platform availability:
   - Android: `Voice.isAvailable()` (maps to `SpeechRecognizer.isRecognitionAvailable()`)
   - iOS: `Voice.isAvailable()` (maps to `SFSpeechRecognizer` authorization status)
4. If unavailable: set error, disable voice
5. If available: `Voice.start('en-US')`, transition to `listening`

### Event subscriptions (inside useEffect)
- `Voice.onSpeechStart` → set state to `listening`
- `Voice.onSpeechPartialResults` → update `partialText` (use last array element), reset silence timeout
- `Voice.onSpeechResults` → set `finalText` (use best/last result), transition to `stopped`
- `Voice.onSpeechEnd` → transition to `stopped` (if not already), preserve last partial as final if no final received
- `Voice.onSpeechError` → extract error message, set `error`, transition to `idle`
- AppState change (`background`) → call `stopListening()` to preserve partial text

### Silence timeout
- On each `onSpeechPartialResults`, reset a 5-second timer
- If timer fires while `listening`, call `Voice.stop()`, transition to `stopped`
- Clear timeout on unmount, on state change away from `listening`

### Platform-specific checks
- Android: `Voice.isAvailable()` returns false → error "Google Speech Services required"
- Android: no network (can check via connectivity service) → but Voice handles this via `onSpeechError` with network error code
- iOS: recognition interrupted (call, Siri) → AppState or `onSpeechError` fires, preserve partial text
- iOS: long dictation > 1 min → iOS auto-stops `SFSpeechRecognizer`, `onSpeechEnd` fires naturally

### Return interface
```ts
interface VoiceInputState {
  status: 'idle' | 'listening' | 'processing' | 'stopped' | 'error';
  partialText: string;
  finalText: string | null;
  error: string | null;
  permissionDenied: boolean;
  isAvailable: boolean;
}

interface VoiceInputActions {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearFinalText: () => void;
  reset: () => void;
}

function useVoiceInput(): VoiceInputState & VoiceInputActions;
```

### Design rules
- `finalText` is set ONCE per session. After consumer reads it, call `clearFinalText()` to reset it.
- `partialText` streams continuously during `listening` — consumers display it in real-time.
- `error` reflects the last error encountered. It IS NOT auto-cleared — consumer decides when to dismiss.
- `permissionDenied` is derived from permission check, persists across sessions.
- `isAvailable` reflects platform speech recognition availability, checked once on mount.
- All event listeners removed in useEffect cleanup to prevent leaks.
- Timeout refs cleared in cleanup.
- Never call `Voice.destroy()` — the library manages its own lifecycle.

## Acceptance Criteria

### Permission & availability
- [ ] `startListening()` requests `RECORD_AUDIO` on Android via `PermissionsAndroid`, returns early if denied
- [ ] `permissionDenied` is `true` when permission was permanently denied or blocked
- [ ] `isAvailable` is `false` when `Voice.isAvailable()` returns false (checked on mount)
- [ ] If permission denied → `startListening` is a no-op, `error` set

### Recognition lifecycle
- [ ] `startListening()` calls `Voice.start('en-US')`, transitions to `listening`
- [ ] `onSpeechStart` event sets `status` to `listening`
- [ ] `onSpeechPartialResults` updates `partialText` with last recognized string from the array
- [ ] `onSpeechResults` sets `finalText` to best result, transitions to `stopped`
- [ ] `onSpeechEnd` transitions to `stopped`, uses last `partialText` as `finalText` if no explicit `onSpeechResults` fired
- [ ] `stopListening()` calls `Voice.stop()`, transitions to `stopped`, `finalText` = last partial

### Silence timeout
- [ ] If no `onSpeechPartialResults` fires for 5 seconds while `listening` → auto-calls `stopListening()`
- [ ] Timeout cleared when any partial result arrives (reset on each partial)
- [ ] Timeout cleared on unmount (no leaked timers)

### Background handling
- [ ] AppState `change` to `background` while `listening` → calls `stopListening()`, preserves partial as final
- [ ] AppState listener removed on unmount

### Error scenarios (from spec lines 114-128)
- [ ] Permission denied → `permissionDenied: true`, `startListening` no-op
- [ ] Speech recognition unavailable (locale/device) → `isAvailable: false`, `startListening` no-op, error set
- [ ] No speech detected (timeout fires) → transitions to `stopped`, `finalText` may be empty string
- [ ] `Voice.onSpeechError` fires with error code → `error` set, `status` to `error`
- [ ] Android: Google Speech Services not installed → `isAvailable: false`
- [ ] Android: network error from Voice → `error` set via `onSpeechError`
- [ ] iOS: recognition interrupted (call/Siri) → `status` to `stopped`, `finalText` = partial text captured before interruption
- [ ] Long dictation (> 1 min iOS) → iOS auto-stops, `onSpeechEnd` fires → partial text preserved
- [ ] Audio session conflict → `onSpeechError` fires, error includes conflict message

### Cleanup & correctness
- [ ] Voice event listeners removed in useEffect cleanup (no double-firing on re-render)
- [ ] Timeout ref cleared in cleanup
- [ ] AppState listener removed in cleanup
- [ ] No state updates after unmount (guard with ref or AbortController)
- [ ] `clearFinalText()` resets `finalText` to null without side effects
- [ ] `reset()` returns to `idle`, clears partial/final/error
- [ ] Exported from `src/services/index.ts`
- [ ] TypeScript strict: no `any`, return types explicit
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies
- `01-install-voice-deps` — requires `@react-native-voice/voice` to be installed
