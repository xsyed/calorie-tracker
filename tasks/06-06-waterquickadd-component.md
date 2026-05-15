# Task 6.6: Build `WaterQuickAdd` component

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on:** Task 6.1 (water_entries table + waterRepository)
**Required by:** Task 6.8 (HomeScreen integration)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| `waterRepository.ts` | Created in Task 6.1. Exposes `insertWaterEntry`, `getWaterEntriesByDate`, `getDailyWaterTotal`. |
| `WaterEntry` type | Created in Task 6.1. Fields: `id`, `user_id`, `date`, `amount_ml`, `timestamp`. |
| Progress bar pattern | No existing pattern. Task 6.5 (DailySummary) establishes the nested-View approach. Use same pattern. |
| Button styling | `InputBar.tsx` uses pill buttons: `borderRadius: 20`, `paddingHorizontal: 16`, `paddingVertical: 10`. Follow this pattern for quick-add buttons. |
| Debounce pattern | No existing debounce. Use `useRef<boolean>` or `useRef<NodeJS.Timeout>`. |
| Loading indicator | `InputBar.tsx` uses `<ActivityIndicator size="small" color={...} />` from react-native. |
| Default water goal | `2000` ml. Export as constant `DEFAULT_WATER_GOAL`. |

---

## File to create

- `apps/mobile/src/components/WaterQuickAdd.tsx`

---

## Design

```
┌─ Water ────────────────────────────────────┐
│  💧 800ml / 2000ml  ████████░░░░ 40%       │
│  [+200ml]  [+500ml]  [+Custom]             │
└─────────────────────────────────────────────┘
```

### Props

```ts
interface WaterQuickAddProps {
  dailyTotal: number;               // ml consumed today (0 if none)
  waterGoal: number;                // ml goal target
  onAddWater: (amountMl: number) => Promise<void>;
  isAdding: boolean;                // any add in progress
}
```

### Exported constant

```ts
export const DEFAULT_WATER_GOAL = 2000;
```

---

## Behavior

### Progress bar

- Percentage = `Math.min(Math.round((dailyTotal / waterGoal) * 100), 100)`
- Bar color: `#007AFF` light / `#0A84FF` dark (same blue as calories)
- Track: `#E5E5E5` light / `#3A3A3C` dark
- Height: 8px, borderRadius: 4
- Label above: `"800ml / 2000ml (40%)"`

### Quick-add buttons

Three buttons in a horizontal row below the progress bar:

1. **+200ml**: Calls `handleQuickAdd(200)`
2. **+500ml**: Calls `handleQuickAdd(500)`
3. **+Custom**: Opens inline TextInput for custom amount

### Debounce

```ts
const debounceRef = useRef(false);

async function handleQuickAdd(amount: number) {
  if (debounceRef.current || isAdding) return;
  debounceRef.current = true;
  try {
    await onAddWater(amount);
  } finally {
    setTimeout(() => { debounceRef.current = false; }, 500);
  }
}
```

The 500ms debounce is enforced via a ref flag. The `isAdding` prop provides parent-level loading state.

### Per-button loading state

The parent manages loading via `isAdding`. During an add, all buttons show `ActivityIndicator` (or are disabled). No per-button loading distinction needed — the insert is fast enough that one global loading state is sufficient.

### Custom amount input

Third button `[+Custom]` toggles an inline input:

```tsx
const [showCustom, setShowCustom] = useState(false);
const [customAmount, setCustomAmount] = useState('');
const [customError, setCustomError] = useState<string | null>(null);
```

When `showCustom` is true, render a `TextInput` + Submit button inline below the quick-add buttons:

```
[+200ml]  [+500ml]  [+Custom]
[  ___ ml] [Add]              ← appears when [+Custom] tapped
```

Validation on submit:
```ts
const amount = parseInt(customAmount, 10);
if (isNaN(amount) || amount < 1 || amount > 5000) {
  setCustomError('Enter 1–5000ml');
  return;
}
await onAddWater(amount);
setCustomAmount('');
setShowCustom(false);
setCustomError(null);
```

### Empty state

When `dailyTotal === 0`: Show "No water logged yet today" as a subtle text above the progress bar (or in place of the percentage label). Keep the progress bar at 0%.

---

## Component structure

```
<View style={card}>
  <Text style={title}>Water</Text>
  <Text style={statsLabel}>800ml / 2000ml (40%)</Text>
  <View style={track}><View style={bar} /></View>
  <View style={buttonRow}>
    <Pressable onPress={() => handleQuickAdd(200)}>+200ml</Pressable>
    <Pressable onPress={() => handleQuickAdd(500)}>+500ml</Pressable>
    <Pressable onPress={() => setShowCustom(prev => !prev)}>+Custom</Pressable>
  </View>
  {showCustom && <CustomInput />}
</View>
```

### Card styling

Match DailySummary card style:
- Background: `#FFFFFF` light / `#1C1C1E` dark
- Border radius: 12
- Padding: 16
- Title: "Water" in bold, 16px

### Button styling

Follow `InputBar.tsx` button pattern:
- Outline/pill style: `borderRadius: 16`, `paddingHorizontal: 12`, `paddingVertical: 6`
- Border: 1px, `#007AFF` / `#0A84FF`
- Text: `#007AFF` / `#0A84FF`
- Disabled/loading: opacity 0.4

---

## Edge cases

| Case | Behavior |
|------|----------|
| `dailyTotal` is 0 | Show empty state text, bar at 0%, buttons active |
| `dailyTotal` exceeds `waterGoal` | Bar capped at 100%, label shows actual e.g. `"2500ml / 2000ml (125%)"` |
| `waterGoal` is 0 | Treat as invalid — use `DEFAULT_WATER_GOAL` (parent should never pass 0, but guard anyway) |
| Rapid double-tap on +200ml | Debounce (500ms ref) prevents second call. Second tap is no-op. |
| Network error during `onAddWater` | Error handled by parent. Component shows no visible change (optimistic update not applied — parent re-renders with original `dailyTotal`). |
| Custom amount input: empty submit | Guard: `customAmount.trim() === ''` → do nothing |
| Custom amount input: non-numeric | `parseInt` returns `NaN` → validation fails with error message |
| Custom amount input: 0 or negative | Validate `amount < 1` → error |
| Custom amount input: >5000 | Validate `amount > 5000` → error |
| Multiple quick adds in succession | Each add completes before next starts (sequential). `onAddWater` is async, parent tracks `isAdding`. |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Progress bar shows correct water percentage (capped at 100%)
- [ ] +200ml and +500ml buttons call `onAddWater` with correct amount
- [ ] Buttons debounced — rapid double-tap only inserts once (500ms window)
- [ ] Loading state shown during INSERT (buttons disabled/dimmed)
- [ ] Custom amount: tapping [+Custom] reveals TextInput + Add button
- [ ] Custom amount: validates range 1–5000ml, shows inline error for invalid
- [ ] Custom amount: clears input and hides on successful submit
- [ ] Empty state shown when `dailyTotal === 0`
- [ ] Dark mode renders correctly
- [ ] `DEFAULT_WATER_GOAL = 2000` exported as constant
