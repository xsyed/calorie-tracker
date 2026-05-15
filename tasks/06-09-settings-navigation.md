# Task 6.9: Wire Settings navigation (gear icon)

**Feature spec:** `docs/features/10-settings.md`
**Depends on:** Task 6.8 (HomeScreen integration)
**Blocks:** Nothing

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| Navigation types | `navigation/types.ts` — 4 routes: `Splash`, `Login`, `Home`, `Onboarding`. No `Settings` route. 6 lines total. |
| Root navigator | `navigation/RootNavigator.tsx` — 115 lines. 4 `Stack.Screen` entries (one per route). No Settings screen. |
| Settings screen | Does **not** exist. |
| HomeScreen | Currently has no gear icon or navigation hook. `useNavigation` not imported. |
| Navigation import pattern | `RootNavigator.tsx` imports screens at top, uses them in `Stack.Screen` inside conditional rendering. |

---

## Files to create

- `apps/mobile/src/screens/SettingsScreen.tsx`

## Files to modify

- `apps/mobile/src/navigation/types.ts` — add `Settings` route
- `apps/mobile/src/navigation/RootNavigator.tsx` — add Settings screen to stack
- `apps/mobile/src/screens/HomeScreen.tsx` — add gear icon navigation

---

## Step 1: Add Settings to navigation types

In `navigation/types.ts`, add after `Onboarding`:

```ts
export type RootStackParamList = {
  Splash: undefined;
  Login: { message?: string } | undefined;
  Home: undefined;
  Onboarding: { onOnboardingComplete?: () => void } | undefined;
  Settings: undefined;
};
```

Line 5 currently ends with `Onboarding: { onOnboardingComplete?: () => void } | undefined;`. Add `Settings: undefined;` as a new line after it.

## Step 2: Create SettingsScreen stub

Create `apps/mobile/src/screens/SettingsScreen.tsx`:

```tsx
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }, isDarkMode && styles.containerDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>Settings</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.comingSoon, isDarkMode && styles.comingSoonDark]}>
          Coming soon
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  containerDark: { backgroundColor: '#000000' },
  header: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#000000' },
  titleDark: { color: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  comingSoon: { fontSize: 16, color: '#888888' },
  comingSoonDark: { color: '#999999' },
});
```

Minimal screen. Matches HomeScreen header pattern (28px bold title, same padding).

Back button: React Navigation's native stack automatically provides a back button in the header. Since `headerShown: false` is set globally in `RootNavigator.tsx` (line 68: `screenOptions={{ headerShown: false }}`), the Settings screen header won't show a back button either.

**Solutions:**
1. Add a custom back button in the SettingsScreen component
2. Override `headerShown` for the Settings screen specifically

**Recommended**: Add a simple back arrow in the SettingsScreen header area:

```tsx
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Inside SettingsScreen:
const navigation = useNavigation();

// In the header View, before the title:
<Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
  <Text style={[styles.backArrow, isDarkMode && styles.backArrowDark]}>← Back</Text>
</Pressable>
```

## Step 3: Add Settings to stack navigator

In `RootNavigator.tsx`:

1. **Import** `SettingsScreen` at top (after `import OnboardingScreen`):
```ts
import SettingsScreen from '../screens/SettingsScreen';
```

2. **Add** `<Stack.Screen name="Settings" component={SettingsScreen} />` inside the navigator.

The navigator uses conditional rendering for the current screen (lines 70-93). There are 4 branches: `showSplash`, `unauthenticated`, `exists` (Home), `not-exists` (Onboarding). Settings must be accessible from Home, so it must be added to the `exists` branch.

The `exists` branch currently renders a single `Stack.Screen`:

```tsx
) : userCheckState === 'exists' ? (
  <Stack.Screen name="Home" component={HomeScreen} />
```

Settings needs to be a separate screen in the same stack. Use a React Fragment to group multiple screens:

```tsx
) : userCheckState === 'exists' ? (
  <>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </>
```

React Fragment (`<>...</>`) works because `Stack.Navigator` accepts children. This way Settings is only accessible when the user is authenticated + exists in DB.

## Step 4: Add gear button to HomeScreen header

In `HomeScreen.tsx`:

1. **Import** `useNavigation`:
```ts
import { useNavigation } from '@react-navigation/native';
```

2. **Add** navigation hook (after other hooks, e.g., after `useSafeAreaInsets()`):
```ts
const navigation = useNavigation<any>();
```

Using `any` because the typed approach requires importing `RootStackParamList` and `NativeStackNavigationProp` — can be tightened later.

3. **Implement** `handleSettingsPress` (from the stub created in Task 6.8):
```ts
const handleSettingsPress = useCallback(() => {
  navigation.navigate('Settings');
}, [navigation]);
```

4. **Ensure gear icon renders**. Task 6.8 added the gear icon in the header next to MonthDropdown:

```tsx
<Pressable onPress={handleSettingsPress} hitSlop={8}>
  <View style={[styles.gearIcon, isDarkMode && styles.gearIconDark]}>
    <Text style={[styles.gearIconText, isDarkMode && styles.gearIconTextDark]}>⚙</Text>
  </View>
</Pressable>
```

5. **Add gear icon styles** to `StyleSheet.create()`:
```ts
gearIcon: {
  width: 36,
  height: 36,
  borderRadius: 18,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F0F0F0',
},
gearIconDark: {
  backgroundColor: '#2C2C2E',
},
gearIconText: {
  fontSize: 18,
},
gearIconTextDark: {},
```

---

## Edge cases

| Case | Behavior |
|------|----------|
| Back from Settings to Home | `useFocusEffect` in HomeScreen (wired in Task 6.8) refreshes user targets |
| Settings screen back button | `navigation.goBack()` returns to Home |
| Deep navigation (Home → Settings → back) | Standard stack behavior — Home is preserved |
| Settings pressed during data loading | Navigation still works — HomeScreen component stays mounted (stack) |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `RootStackParamList` includes `Settings: undefined`
- [ ] `SettingsScreen` exists with "Settings" title, "Coming soon" message, back button
- [ ] `RootNavigator` registers Settings screen in the `exists` branch
- [ ] Gear icon (⚙) visible in top-right of Home header
- [ ] Tapping gear icon navigates to SettingsScreen
- [ ] Back button on SettingsScreen returns to HomeScreen
- [ ] Dark mode renders correctly on SettingsScreen
- [ ] Home data refreshes on return from Settings (via `useFocusEffect` from Task 6.8)
