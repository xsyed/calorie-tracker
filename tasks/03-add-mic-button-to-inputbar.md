# Task: Add Mic Button & Waveform Indicator to InputBar

## Goal
Add microphone toggle button, WaveformIndicator component, and `setText` imperative ref to InputBar so voice text can be inserted programmatically.

## Description
Extend `InputBar` to support voice input as an alternative entry method. The input bar remains the single text entry point — voice is additive, not a separate path.

### What to create/modify
- `apps/mobile/src/components/InputBar.tsx` — add mic button, voice state props, `setText` ref
- `apps/mobile/src/components/WaveformIndicator.tsx` — new component for listening animation

### InputBar changes
1. Convert to `React.forwardRef` exposing `{ setText: (text: string) => void }`
2. Accept new optional voice props:
   ```ts
   voiceStatus?: 'idle' | 'listening' | 'processing' | 'stopped' | 'error';
   voicePartialText?: string;
   voiceError?: string | null;
   isVoiceAvailable?: boolean;
   onMicPress?: () => void;
   ```
3. When `onMicPress` is provided, render mic button to the LEFT of the TextInput
4. Mic button behavior:
   - `voiceStatus === 'listening'` or `'processing'` → show WaveformIndicator instead of mic icon
   - `idle` / `stopped` / `error` → show normal mic icon, tap calls `onMicPress`
   - `isVoiceAvailable === false` → show mic icon in disabled/grayed-out state
5. When `voicePartialText` is non-empty and `voiceStatus === 'listening'`, display it in the TextInput as the user speaks (real-time feedback)
6. `setText(ref)` allows external code to programmatically set input text (used by voice final result insertion)

### WaveformIndicator component
- Animated vertical bars (3-5 bars) that pulse during listening
- MUST use RN `Animated` API (no Lottie dependency — avoids adding a heavy lib)
- Bars oscillate at slightly different speeds for a natural waveform look
- Accepts `isActive: boolean` — animate when true, static when false
- Dark mode: bars adapt color based on `useColorScheme()`
- Lightweight: no external dependencies, pure RN Animated

### Backward compatibility
- When none of `voiceStatus`, `onMicPress`, etc. are passed, InputBar renders exactly as it does today (no mic button)
- Existing `onSubmit`, `isSubmitting`, `onChangeText` behavior unchanged

## Acceptance Criteria

### Mic button
- [ ] `onMicPress` provided → mic button renders to the left of TextInput (inside the same row)
- [ ] Mic button uses a recognizable microphone icon (Unicode character `🎤` or simple drawn icon via View/SVG)
- [ ] `voiceStatus === 'listening'` or `'processing'` → WaveformIndicator replaces mic button
- [ ] `voiceStatus === 'idle'` | `'stopped'` | `'error'` → normal mic button shown, tappable
- [ ] `isVoiceAvailable === false` → mic button disabled, reduced opacity, not tappable
- [ ] `isVoiceAvailable === false` and mic pressed → no-op, `onMicPress` not called
- [ ] `onMicPress` NOT provided → no mic button rendered, layout identical to current
- [ ] Dark mode: mic icon color adapts (white in dark mode, black in light mode)

### WaveformIndicator
- [ ] Shows 3-5 animated vertical bars when `isActive === true`
- [ ] Bars animate independently (different `Animated.timing` delays/speeds for natural look)
- [ ] Bars stop animation when `isActive === false` (static height)
- [ ] Dark mode: bar colors invert for visibility on dark background
- [ ] Component has no external dependencies beyond `react-native`
- [ ] Animation does not cause jank or UI thread blocking

### Text insertion
- [ ] `ref.current.setText('hello')` sets the TextInput value to 'hello'
- [ ] Text set via `setText` is fully editable by user (cursor position maintained, keyboard works)
- [ ] When `voicePartialText` is non-empty AND `voiceStatus === 'listening'`, TextInput shows the partial text
- [ ] voicePartialText updates appear in real-time in the TextInput as the user speaks
- [ ] Once `voiceStatus` transitions away from `listening`, voicePartialText stops driving the input (user takes over)
- [ ] `setText` trumps internal voice partial display — if both are active, `setText` wins

### Layout & styling
- [ ] Mic button is the same height as the TextInput, vertically centered
- [ ] Mic button has adequate touch target (≥ 44px on iOS, ≥ 48dp on Android)
- [ ] RTL not required; left-positioned mic works for LTR
- [ ] TextInput padding adjusts to accommodate mic button (no text overlapping icon)
- [ ] All new styles have dark mode variants

### No regressions
- [ ] InputBar without voice props renders identically to current version
- [ ] `onSubmit` still works with keyboard return (`onSubmitEditing`) and Send button
- [ ] `isSubmitting` still disables TextInput and shows ActivityIndicator
- [ ] `onChangeText` still fires on manual typing
- [ ] Text trimming before submit unchanged
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes — no complexity violations, max-lines not exceeded

## Dependencies
- `02-create-voice-service` — requires `VoiceInputState` type shape to be defined for props interface
