# TDD: Voice Input

## Feature Summary
Microphone button on Home input bar triggers on-device speech-to-text via react-native-voice. Recognized text is inserted into the input bar for user review/editing before submission. Submitted text follows the same LLM pipeline as typed input.

---

## Data Flow

```
User on Home screen
  │
  ▼
Tap microphone button on input bar
  │
  ▼
Check microphone permission
  ├── NOT GRANTED → request permission (OS dialog)
  │     ├── GRANTED → proceed
  │     └── DENIED → show "Microphone access needed for voice input.
  │                   Enable in Settings." (with link to app settings)
  │
  └── GRANTED:
        │
        ▼
      react-native-voice.start('en-US')  // or device language
        │
        ▼
      OS-level speech recognizer activates:
        iOS:   SFSpeechRecognizer (on-device, supports offline for recent iOS)
        Android: SpeechRecognizer (Google speech services, network-dependent)
        │
        ▼
      Voice.onSpeechResults event fires with recognized text array:
        [ "2 scrambled eggs toast with butter and a 30 minute walk" ]
        │
        ▼
      Voice.onSpeechPartialResults event fires continuously during speech:
        [ "2 scrambled" ], [ "2 scrambled eggs toast" ], ...
        (used for real-time feedback — show partial text as it's recognized)
        │
        ▼
      Voice.onSpeechEnd event fires when user stops speaking or timeout
        │
        ▼
      Insert final recognized text into input bar (TextInput.value)
        │
        ▼
      User reviews text, makes corrections if needed
        │
        ▼
      User taps submit → same LLM pipeline as typed input (03-llm-logging.md)

Additional voice UX states:
  │
  ├── Voice.onSpeechStart → show listening indicator (animated mic waveform)
  ├── Voice.onSpeechError → show error, reset mic button
  └── Manual stop: user taps mic again → Voice.stop() → process partial result
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| react-native-voice | JS bridge to native speech recognition APIs | Native module bridge |
| iOS: SFSpeechRecognizer (Apple) | On-device speech-to-text | Native API |
| Android: SpeechRecognizer (Google) | Network-based speech-to-text (cloud) | Native API → Google Speech Services |
| Permissions: `react-native-permissions` or OS-level permission APIs | Microphone & speech recognition permission requests | OS permission dialogs |
| AppState API (react-native) | Detect app backgrounding — stop listening if backgrounded | Native bridge |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Microphone permission status | Permission module (cached) | Persistent (OS setting) |
| Voice listening state (idle / listening / processing / stopped) | Component state | Screen session |
| Partial recognized text | Component state (streamed from onSpeechPartialResults) | Duration of listening session |
| Final recognized text | Component state → inserted into input bar TextInput | Transferred to input bar |
| Voice error state | Component state | Per listening attempt |
| Input bar text (populated from voice) | Input bar component state | Screen session (editable by user) |

Voice state is localized to the Home screen input bar. No state persists beyond the listening session.

---

## Background Jobs

| Job | Trigger | Behavior |
|---|---|---|
| Speech recognition (Android) | Voice.start() | Audio streamed to Google Speech Services. Runs in background thread. OS manages audio session (ducking music, etc.) |
| Speech recognition (iOS) | Voice.start() | On-device processing. No network. Runs in background audio queue. iOS SFSpeechRecognizer supports ~1 minute of continuous recognition before requiring restart. |
| Listening timeout | No speech detected for N seconds (configurable, default ~5s) | Voice.stop() automatically. Insert whatever partial text was recognized. |

---

## Battery / Performance Impact

- **Battery**: 
  - iOS: Moderate impact. On-device SFSpeechRecognizer uses CPU for audio processing. Expect ~5-10% battery for a 30-second dictation on a modern device. Older devices will see higher drain.
  - Android: Lower CPU impact (cloud processing), but network radio active. ~2-5% battery for 30-second dictation.
  - Overall: acceptably low for short dictation bursts (5-30 seconds typical for food logging).
- **Performance**:
  - Audio capture + processing adds ~100-300ms latency before first partial result appears.
  - iOS on-device recognition: no network latency, results appear in 200-500ms chunks.
  - Android cloud recognition: depends on network. ~500ms-1s for first result. Can be slow on poor connections.
  - UI: Animated waveform during listening should be lightweight (Lottie or simple CSS animation).

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Microphone permission denied** | User denied at OS level, or previously denied + "Don't ask again" | Mic button disabled or shows error | Detect permission status on mount. If denied: show disabled mic icon with tooltip "Microphone access required." On tap: show alert with "Open Settings" button linking to app settings page. |
| **Microphone permission "blocked" (Android)** | User denied twice, OS blocks further prompts | Can't trigger permission dialog again | Same as above. Link to Settings is the only path. |
| **Speech recognition unavailable (locale)** | Device language not supported by recognizer. iOS supports ~60 languages; Android depends on Google Speech Services availability. | Voice.start() returns error | On error: show "Voice input not available for your device language." Disable mic button. Check SFSpeechRecognizer.supportsOnDeviceRecognition or Android SpeechRecognizer.isRecognitionAvailable(). |
| **No speech detected** | User taps mic but doesn't speak. Background noise. | Mic stays active until timeout (5s). Frustrating. | Auto-stop after 5s of silence. Insert empty string or show "Didn't catch that. Tap mic to try again." |
| **Poor recognition quality** | Background noise, accent, mumbled speech, fast speech | Garbled text inserted. User must retype entirely. | Always allow editing before submit. Recognized text is editable in the input bar — this is the primary mitigation. |
| **Android: Google Speech Services not installed/disabled** | Some Android ROMs, de-Googled devices | Voice recognition unavailable | Detect via `SpeechRecognizer.isRecognitionAvailable()`. If false: disable mic button with tooltip "Google Speech Services required." (No workaround — system limitation.) |
| **Android: network required for recognition** | No internet, Google Speech Services needs cloud | Voice.start() returns network error | Catch error. Show "Voice input needs internet." Fall back to keyboard input. (iOS: on-device recognition works offline for iOS 13+.) |
| **iOS: recognition interrupted** | Incoming call, Siri activation, app backgrounded | Listening stops, partial text may be returned | AppState listener: stop recognition on background. Voice.onSpeechEnd will fire with whatever was recognized. Insert partial text into input bar. |
| **Long dictation (> 1 minute)** | User describes complex meal at length | iOS SFSpeechRecognizer has ~1 minute limit per session | Before starting, set `voice.continuous = false` or use a task-based approach. If recognition exceeds limit: auto-stop, insert recognized text, allow re-tapping mic to continue. Alternatively: Android supports indefinite streaming — only iOS has this constraint. |
| **Audio session conflict** | Music playing, another app using microphone | Voice.start() fails with audio session error | Stop/reactivate audio session appropriately. Use `AVAudioSession.setActive(true)` on iOS before starting. On Android: request audio focus. On failure: show "Cannot use mic while another app is using it." |

---

## Constraints
- Voice is an input method, not a separate logging path. All voice-captured text must be user-editable before LLM submission.
- Microphone button is a toggle: tap to start, tap again to stop.
- Listening indicator must be visible (animated waveform) so user knows mic is active.
- On iOS, speech recognition requires `NSSpeechRecognitionUsageDescription` in Info.plist.
- On Android, speech recognition requires `RECORD_AUDIO` permission.
