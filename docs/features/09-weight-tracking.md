# TDD: Weight Tracking

## Feature Summary
Second bottom tab. Displays weigh-in history as a list and trend line chart. User can log new weigh-ins with weight in kg. Calculates and displays weight change trends. No network dependency.

---

## Data Flow

```
User taps Weight tab in bottom navigation
  │
  ▼
Weight screen mounts:
  │
  ▼
Query WeightEntries:
  SELECT date, weight_kg, timestamp
  FROM weight_entries
  WHERE user_id = ?
  ORDER BY date DESC
  (No LIMIT — chart needs all entries for trend line)
  │
  ▼
Compute chart data from entries:
  - Sort chronologically (oldest → newest)
  - Calculate trend line (simple moving average or linear regression)
  - Compute weight change: current_entry.weight - first_entry.weight
  - Compute weekly rate if >= 7 days of data
  │
  ▼
Render:
  ┌─ Weight ──────────────────────────────────┐
  │                                            │
  │  Current: 78.5 kg                          │
  │  Change: -2.3 kg (since Apr 15)            │
  │  Rate: -0.5 kg/week                        │
  │                                            │
  │  ┌─ Trend ────────────────────────────────┐│
  │  │  82┼                                   ││
  │  │    │  ●                                ││
  │  │  81┼   ●                              ││
  │  │    │    ●                             ││
  │  │  80┼     ●  ●                         ││
  │  │    │        ●  ●                      ││
  │  │  79┼           ●  ●                   ││
  │  │    │              ●                   ││
  │  │  78┼                ● ●               ││
  │  │    └──┴──┴──┴──┴──┴──┴──┴──┴──┴───── ││
  │  │     Apr 15       Apr 22       May 1   ││
  │  └────────────────────────────────────────┘│
  │                                            │
  │  ┌─ History ──────────────────────────────┐│
  │  │  May 10, 2026    78.5 kg               ││
  │  │  May 8, 2026     78.7 kg  -0.2         ││
  │  │  May 5, 2026     79.0 kg  -0.3         ││
  │  │  May 1, 2026     79.3 kg  -0.3         ││
  │  │  Apr 28, 2026    79.8 kg  -0.5         ││
  │  │  ...                                   ││
  │  └────────────────────────────────────────┘│
  │                                            │
  │  [+ Log Weight]  (floating button / header│
  │                    action)                 │
  └────────────────────────────────────────────┘

═══ Log Weight Flow ═══

User taps "+ Log Weight"
  │
  ▼
Modal or inline input:
  ┌─ Log Weight ──────────────────────────────┐
  │                                            │
  │  Date: [May 10, 2026]  (default: today)    │
  │  Weight: [____] kg                         │
  │                                            │
  │  [Cancel]  [Save]                          │
  └────────────────────────────────────────────┘
  │
  ▼
Validate:
  - weight_kg > 0 and < 500
  - date <= today
  │
  ▼
INSERT WeightEntry:
  user_id, date, weight_kg, timestamp = now()
  │
  ▼
Weight screen updates: history list + chart re-rendered with new entry
```

---

## APIs Involved

None. All local SQLite operations.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Weight entries list | Component state (from SQLite query) | Weight tab session, refreshed on focus |
| Chart data (processed from entries) | Derived state (useMemo / computed) | Weight tab session |
| Current weight, change, rate | Derived state | Weight tab session |
| Log weight modal visibility | Component state | Ephemeral |
| Log weight form (date, weight_kg) | Component state | Within modal session |
| Validation errors | Component state | Ephemeral |

---

## Background Jobs

None.

---

## Battery / Performance Impact

- **Battery**: None. Local only.
- **Performance**:
  - SQLite query: all weight entries for a user. For daily weigh-ins over 2 years = 730 entries. Trivial (<5ms with index on user_id, date).
  - Chart: 730 data points are too many to render individually. Need to downsample for display. v1: show last 30 entries as dots on chart. Or: aggregate by week/month for chart, individual entries in history list.
  - Trend calculation: simple linear regression on N entries is O(N). For 730 entries: <1ms.
  - History list: FlatList with virtualization. Should handle 1000+ entries without issue.
- **Memory**: 730 entries × ~100 bytes = 73KB. Negligible.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **No entries yet** | User hasn't logged weight, or onboarding weight not imported as first entry | Empty chart, empty history. Looks broken. | Show: "No weigh-ins yet. Tap '+ Log Weight' to add your first entry." Consider: auto-create first WeightEntry from onboarding current_weight on the onboarding date. |
| **Single entry** | User only logged weight once | Chart shows single dot. Cannot compute change or rate. | Show: "Log another weigh-in to see your trend." Don't show change/rate sections. |
| **Gap in weigh-ins** | User skipped weeks between weigh-ins | Chart shows gap, trend line may be misleading (straight line between far-apart points) | Chart should show actual data points without interpolated lines, or show dotted line for gaps > 7 days. History list shows all entries regardless of gap. |
| **Negative weight change** (gain) when user's goal is "lose" | User gained weight | Negative progress can be demotivating | Show change neutrally: "▲ +0.3 kg since last week" (not red/green). Weight trend is data, not judgment. User knows their goal. |
| **Outlier entry** | User accidentally logs 780 kg instead of 78.0 kg | Chart Y-axis scales to 780, making real data invisible. Trend massively skewed. | Validate: weight_kg between 20 and 500 kg. Show input validation error. If an outlier somehow gets saved (e.g., manual DB edit or data import): flag entries > 3σ from mean as "suspicious" and exclude from chart/trend. Or: allow swipe-to-delete. |
| **Multiple entries same day** | User logs weigh-in twice in one day | Two entries for same date. Chart shows both (overlapping points) | Allow multiple per day (user might weigh morning+evening). Chart: if multiple same-day, show average or most recent. History list: show all. |
| **Delete entry** | User swipes to delete | Entry removed, chart and trend recalculated | DELETE WHERE id = ?. No confirmation needed for swipe-delete if undone briefly with a snackbar ("Entry deleted. Undo?"). Use optimistic delete with undo timer. |
| **Database error** | Corruption, disk full | Entry appears saved but wasn't | Wrap INSERT in try/catch. On error: show "Failed to save weigh-in." |
| **Future date** | User accidentally sets date to 2027 | Entry appears at end of chart, creates 1-year gap | Validate: date cannot be in the future. Show inline error: "Date cannot be in the future." |

---

## Constraints
- Weight tab is bottom tab 2. Only two tabs: Home and Weight.
- Weight is stored in kg. No unit conversion in v1.
- One WeightEntry per weigh-in. Multiple per day allowed.
- Chart shows chronological trend with data points. X-axis: date. Y-axis: weight_kg.
- No network dependency — purely local.
- ExerciseEntry calories are excluded from weight tracking context (no "calories burned → weight" calculation).
