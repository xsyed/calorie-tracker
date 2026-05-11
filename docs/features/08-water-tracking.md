# TDD: Water Tracking

## Feature Summary
Water intake tracking with dual access: quick-add buttons (+200ml, +500ml) on the Home screen, and a dedicated Water screen (reached from Home) with history list and trend chart. Water is not a bottom tab.

---

## Data Flow

```
═══ Path A: Quick-Add from Home ═══

User on Home screen, sees water progress bar
  │
  ▼
Tap [+200ml] or [+500ml] button
  │
  ▼
INSERT WaterEntry:
  user_id = current user
  date = selected date (today or the date being viewed)
  amount_ml = 200 or 500
  timestamp = now()
  │
  ▼
Home screen: water daily total re-computed → progress bar updates instantly
  (No network needed — local SQLite insert)

═══ Path B: Dedicated Water Screen ═══

User taps water progress bar on Home (or a dedicated "See more" link)
  │
  ▼
Navigate to Water screen
  │
  ▼
Query water entries for display period (default: last 7 days, configurable):
  SELECT date, SUM(amount_ml) AS total_ml
  FROM water_entries
  WHERE user_id = ? AND date BETWEEN ? AND ?
  GROUP BY date
  ORDER BY date ASC
  │
  ▼
Render:
  ┌─ Water ────────────────────────────────────┐
  │  [< Back]                  [⚙️ Goal]       │
  │                                              │
  │  ┌─ Today ─────────────────────────────────┐│
  │  │  💧 800ml / 2000ml  ████████░░░░ 40%   ││
  │  │  [+100] [+200] [+500] [+Custom]        ││
  │  │                                          ││
  │  │  09:30 AM  +200ml                       ││
  │  │  12:00 PM  +500ml                       ││
  │  │  03:30 PM  +100ml                       ││
  │  └──────────────────────────────────────────┘│
  │                                              │
  │  ┌─ Trend (Last 7 Days) ────────────────────┐│
  │  │  2000┼                    █              ││
  │  │      │              █     █              ││
  │  │  1500┼        █     █     █     █       ││
  │  │      │  █     █     █     █     █  █    ││
  │  │  1000┼  █  █  █  █  █  █  █  █  █  █  ││
  │  │      └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴── ││
  │  │       M  T  W  T  F  S  S               ││
  │  └──────────────────────────────────────────┘│
  │                                              │
  │  ┌─ History ────────────────────────────────┐│
  │  │  May 10  →  200ml (09:30)               ││
  │  │           →  500ml (12:00)               ││
  │  │           →  100ml (15:30)               ││
  │  │                                          ││
  │  │  May 9   →  200ml (08:00)               ││
  │  │          →  500ml (11:00)                ││
  │  │          →  300ml (14:00)                ││
  │  │          →  500ml (18:00)                ││
  │  └──────────────────────────────────────────┘│
  └──────────────────────────────────────────────┘

═══ Path C: Custom Amount ═══

User taps [+Custom] button
  │
  ▼
Show number input (keyboard type: numeric) or predefined amounts list
  │
  ▼
User enters amount (ml) and taps "Add"
  │
  ▼
INSERT WaterEntry with entered amount_ml
```

---

## APIs Involved

None. All local SQLite operations.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Daily water total (Home screen) | Component state (recomputed from SQLite query) | Home screen session |
| Water entries for selected day (Water screen) | Component state | Water screen session |
| Water entries for trend period (7-day aggregate) | Component state | Water screen session |
| Custom amount input value | Component state | Water screen session |
| Water goal (ml/day) | SQLite User table or Settings store | Persistent |
| Quick-add loading state (per button) | Component state (brief, INSERT operation) | Ephemeral |

---

## Background Jobs

None.

---

## Battery / Performance Impact

- **Battery**: None. Local only.
- **Performance**:
  - Quick-add INSERT: single row insert. <5ms.
  - Water history query (7 days, grouped by date): index on (user_id, date) makes this <2ms even with years of data.
  - Trend chart: 7 data points. Trivial rendering (simple bar/line chart). No heavy charting library needed — can use react-native-svg or a lightweight chart component.
  - Custom amount input: standard keyboard + TextInput. No performance concern.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Water goal not set** | Not configured in onboarding or Settings. Not specified in architecture. | Progress bar shows 0 denominator (NaN) or no progress shown | Default water goal: 2000ml (common recommendation). Show "Goal: 2000ml" with option to change in Settings. If user sets custom goal in Water screen Settings, override default. |
| **Double-tap quick-add** | User taps +200ml rapidly twice | Two WaterEntries created inadvertently | Debounce quick-add buttons: disable for 500ms after tap. Or: use optimistic UI — increment local total instantly, but DB insert is async. If identical timestamp+amount entries are detected, show undo option. v1: simple debounce. |
| **Adding water for wrong date** | User on Home screen viewing a different date (via 7-day strip) taps quick-add. Entry goes to the viewed date, not today. | Water logged on wrong date | This is intentional — if user is viewing May 8, water quick-add should log for May 8. BUT: this is unexpected for quick-add (typically "right now"). Consider: quick-add always logs for today regardless of selected date; or show a clear date label next to quick-add buttons. Decision: log for selected date. Water screen header shows the date. |
| **Negative or zero amount** | Custom amount input allows entering 0 or negative values | Meaningless entry or no entry | Validate: amount must be > 0 and <= 5000ml. Show inline error if invalid. |
| **Extreme amount** | User accidentally types 99999ml | One entry dominates daily total, obscuring real data | Upper bound: 5000ml (5L). Single entry cannot exceed this. Show inline validation. |
| **Delete WaterEntry** | User taps to remove an entry | Entry removed, daily total recalculated | Swipe-to-delete or tap-to-delete with confirmation ("Delete this entry?"). After delete: re-query daily total and update. |
| **Database error on insert** | Disk full, corruption | Quick-add appears to work but entry not saved | Wrap INSERT in try/catch. On error: revert optimistic UI update, show "Failed to log water. Try again." |
| **Trend chart scaling issue** | One day user drank 0ml, another day 3000ml | Y-axis scale makes 0-3000 range; low values hard to see | Fix Y-axis to goal (2000ml) with 0 at bottom. Show goal line. This provides consistent visual context. Bars extend above goal line if exceeded. |

---

## Constraints
- Water screen is reached from Home, not a bottom tab.
- Quick-add buttons on Home: +200ml, +500ml (no undo for quick-add — a separate entry can be deleted).
- Water screen has: today's progress, today's entries list, trend chart, history list, custom amount input.
- No predefined water goal in onboarding architecture — default to 2000ml/day, configurable in Settings.
- WaterEntry has date and timestamp so intra-day history can be shown.
- No network dependency — purely local.
