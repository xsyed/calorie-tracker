# Task 6.10: Run quality gates

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on:** All tasks 6.1–6.9 must be complete
**Blocks:** Nothing (final task)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| Quality gate command | `npm run check` — defined in root `package.json` scripts |
| Checks included | typecheck, lint, knip (dead code), duplication (JSCPD), deps (dependency cruiser), shared-check, security (Semgrep) |
| Pre-commit hook | Husky runs `npm run check` on every commit |
| All checks must pass | Or commit is rejected |

---

## Steps

### 1. Run full quality gate

```bash
npm run check
```

This runs all of:
- `npm run typecheck` — TypeScript strict mode (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters)
- `npm run lint` — ESLint (complexity max 15, cognitive complexity max 18, max-lines 500, max-len 150, max-depth 4, import order, no cycles)
- `npm run knip` — unused exports, dependencies, files
- `npm run duplication` — JSCPD copy-paste detection (threshold 5%)
- `npm run deps` — Dependency Cruiser (no cross-feature imports, no circular deps)
- `npm run shared-check` — shared utils folder >25 files check
- `npm run security` — Semgrep community ruleset

### 2. Fix all violations

Common issues to look for:

| Check | Likely issues |
|-------|---------------|
| typecheck | Missing exports, wrong type imports, `noUncheckedIndexedAccess` on array access, `exactOptionalPropertyTypes` on optional props |
| lint | Import order (react → react-native → internal), line length >150, function complexity >15, function cognitive >18 |
| knip | Unused exports (e.g., helper functions not re-exported from index.ts), unused dependencies |
| duplication | Similar progress bar code across DailySummary and WaterQuickAdd — may trigger JSCPD. If so, extract shared `ProgressBar` component. |
| deps | No cross-feature imports expected (no `features/` dirs exist). Circular deps possible between components and screens if imports are wrong. |
| shared-check | No shared utils currently exist — unlikely to fail |
| security | Unlikely to trigger from new UI code — Semgrep targets injection/crypto/secrets |

### 3. Manual smoke test checklist

- [ ] Full auth flow: launch app → Splash → Login → Onboarding → Home
- [ ] Home renders: MonthDropdown, DateStrip, DailySummary, WaterQuickAdd, EntryList
- [ ] Date navigation: tap date in DateStrip → data reloads
- [ ] Month navigation: open MonthDropdown → select different date → data reloads
- [ ] Submit entry: type text → Send → entry appears in EntryList
- [ ] Submit for past date: change date via DateStrip → submit → entry appears for that date
- [ ] Submit for rate-limited date: trigger rate limit → entry saves as pending, shown in EntryList
- [ ] Water quick-add: tap +200ml → bar updates → tap +500ml → bar updates
- [ ] Custom water: tap +Custom → enter amount → submit → bar updates
- [ ] Gear icon: tap ⚙ → Settings screen renders → back button → returns to Home
- [ ] Settings → Home: data refreshes (user targets updated)
- [ ] Empty state: navigate to date with no entries → see empty state messages
- [ ] Dark mode: all components render correctly in dark mode
- [ ] Voice input: mic button works (if available on device)
- [ ] Error state: simulate DB error → see error banner with retry
- [ ] Pending entries in list: shown dimmed with "Pending" badge
- [ ] Failed entries in list: shown dimmed with "Failed" badge

### 4. Verify changed files

Run `git diff --stat` to confirm only expected files were modified/created:

| File | Expected operation |
|------|-------------------|
| `database/types.ts` | Modified (Task 6.1) |
| `database/database.ts` | Modified (Task 6.1) |
| `database/waterRepository.ts` | Created (Task 6.1) |
| `database/index.ts` | Modified (Task 6.1, 6.2) |
| `database/foodRepository.ts` | Modified (Task 6.2) |
| `components/DateStrip.tsx` | Created (Task 6.3) |
| `components/MonthDropdown.tsx` | Created (Task 6.4) |
| `components/DailySummary.tsx` | Created (Task 6.5) |
| `components/WaterQuickAdd.tsx` | Created (Task 6.6) |
| `components/EntryList.tsx` | Created (Task 6.7) |
| `screens/HomeScreen.tsx` | Modified (Task 6.8, 6.9) |
| `screens/SettingsScreen.tsx` | Created (Task 6.9) |
| `navigation/types.ts` | Modified (Task 6.9) |
| `navigation/RootNavigator.tsx` | Modified (Task 6.9) |

Total: 14 files (8 new, 6 modified).

---

## Acceptance criteria

- [ ] `npm run check` exits with code 0 (all checks pass)
- [ ] No type errors
- [ ] No lint violations
- [ ] No dead code (knip)
- [ ] No code duplication above threshold (JSCPD)
- [ ] No architecture violations (dependency cruiser)
- [ ] No security issues (Semgrep)
- [ ] Manual smoke test passes (all checklist items)
- [ ] Only expected files modified (git diff matches planned file list)
