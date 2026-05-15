# Home Screen & Daily Summary — Task Index

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on specs:** `03-llm-logging.md`, `05-offline-queue.md`, `08-water-tracking.md`, `10-settings.md`

This file is the index. Each task below lives in its own file with full implementation details, verified against the current codebase state.

---

## Split Tasks

| # | Task | File | Depends On |
|---|------|------|------------|
| 1 | Water table + repository | [06-01-water-table-repository.md](./06-01-water-table-repository.md) | — |
| 2 | Food aggregate queries | [06-02-food-aggregate-queries.md](./06-02-food-aggregate-queries.md) | — |
| 3 | DateStrip component | [06-03-datestrip-component.md](./06-03-datestrip-component.md) | Task 2 |
| 4 | MonthDropdown component | [06-04-monthdropdown-component.md](./06-04-monthdropdown-component.md) | Task 2 |
| 5 | DailySummary component | [06-05-dailysummary-component.md](./06-05-dailysummary-component.md) | Task 2 |
| 6 | WaterQuickAdd component | [06-06-waterquickadd-component.md](./06-06-waterquickadd-component.md) | Task 1 |
| 7 | EntryList component | [06-07-entrylist-component.md](./06-07-entrylist-component.md) | — |
| 8 | HomeScreen integration | [06-08-homescreen-integration.md](./06-08-homescreen-integration.md) | Tasks 1–7 |
| 9 | Settings navigation | [06-09-settings-navigation.md](./06-09-settings-navigation.md) | Task 8 |
| 10 | Quality gates | [06-10-quality-gates.md](./06-10-quality-gates.md) | Tasks 1–9 |

---

## Dependency Graph

```
Task 1 (water table)
  │
  ├──→ Task 6 (WaterQuickAdd) ──→ Task 8 (HomeScreen integration)
  │                                  │
  └──→ Task 2 (aggregate queries) ──┤
                                     │
Task 3 (DateStrip) ──────────────────┤
Task 4 (MonthDropdown) ──────────────┤
Task 5 (DailySummary) ───────────────┤
Task 7 (EntryList) ──────────────────┤
                                     │
Task 9 (Settings nav) ───────────────┘
                                     │
                               Task 10 (quality gates)
```

Tasks 1–7 are independent of each other (except 6→1, 3/4/5→2). Tasks 1–7 must all be complete before Task 8. Task 9 depends on Task 8. Task 10 is last.

---

## Files Changed Summary

| File | Task | Operation |
|------|------|-----------|
| `database/types.ts` | 1 | Add `WaterEntry` type |
| `database/database.ts` | 1 | Add `water_entries` table |
| `database/waterRepository.ts` | 1 | Create (new) |
| `database/index.ts` | 1, 2 | Add exports |
| `database/foodRepository.ts` | 2 | Add `getDailyCalorieTotals`, `getLoggedDatesInRange` |
| `components/DateStrip.tsx` | 3 | Create (new) |
| `components/MonthDropdown.tsx` | 4 | Create (new) |
| `components/DailySummary.tsx` | 5 | Create (new) |
| `components/WaterQuickAdd.tsx` | 6 | Create (new) |
| `components/EntryList.tsx` | 7 | Create (new) |
| `screens/HomeScreen.tsx` | 8, 9 | Major rewrite (replace stubs, add nav) |
| `screens/SettingsScreen.tsx` | 9 | Create (new, stub) |
| `navigation/types.ts` | 9 | Add `Settings` route |
| `navigation/RootNavigator.tsx` | 9 | Add `Settings` screen |

---

## Execution Order

1. **Phase 1 (parallel)**: Tasks 1, 2, 7 (no dependencies)
2. **Phase 2 (parallel)**: Tasks 3, 4, 5 (all depend on Task 2), Task 6 (depends on Task 1)
3. **Phase 3**: Task 8 (depends on all above)
4. **Phase 4**: Task 9 (depends on Task 8)
5. **Phase 5**: Task 10 (run quality gates after everything)
