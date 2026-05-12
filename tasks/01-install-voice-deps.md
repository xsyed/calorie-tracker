# Task: Install Voice Recognition Dependencies & Native Config

## Goal
Install `@react-native-voice/voice` and configure iOS/Android native permissions for on-device speech recognition.

## Description
Add the `@react-native-voice/voice` package (modern fork of the deprecated `react-native-voice`) plus native OS-level configuration required for microphone and speech recognition access on both platforms. This is a prerequisite for all voice input code — no JS logic can work without this foundation.

### What to change
- `apps/mobile/package.json` — add `@react-native-voice/voice` dependency
- `apps/mobile/ios/CaloriesApp/Info.plist` — add `NSSpeechRecognitionUsageDescription` key
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — add `RECORD_AUDIO` permission

### No JS code changes in this task

## Acceptance Criteria
- [ ] `@react-native-voice/voice` is in `apps/mobile/package.json` dependencies (not devDependencies)
- [ ] `import Voice from '@react-native-voice/voice'` resolves without TypeScript errors
- [ ] iOS `Info.plist` contains:
  ```
  <key>NSSpeechRecognitionUsageDescription</key>
  <string>CaloriesApp uses speech recognition to let you log meals by voice.</string>
  ```
- [ ] Android `AndroidManifest.xml` contains `<uses-permission android:name="android.permission.RECORD_AUDIO" />` inside `<manifest>` but outside `<application>`
- [ ] `npm run typecheck` passes (from repo root or `apps/mobile`)
- [ ] `npm run lint` passes

## Dependencies
None
