# Calories app

## Project Overview

Monorepo (npm workspaces): `apps/mobile`, `packages/` (empty).

**apps/mobile** — React Native 0.85.3 bare workflow, TypeScript strict.
- **Auth:** Firebase Auth — Google + Apple Sign-In. Full flow: sign-in, sign-out, session recovery, network/rate-limit error handling.
- **DB:** `@op-engineering/op-sqlite` — raw SQL, repository pattern. Tables include `User`, food/exercise logs, app settings, water entries, weight entries, saved meals.
- **Navigation:** `@react-navigation/native-stack`. Auth-aware routing: Splash → Login → Onboarding → Home → Weight → Water.
- **UI:** Plain React Native `StyleSheet`, dark mode via `useColorScheme`. No UI library.

No backend, no shared packages, no tests. Home supports food/exercise logging, saved meals/history, and water quick-add. Weight supports local weigh-in logging, summary/history, chart trends, delete undo, and edge states. Water has daily logging for selected date plus a local 7-day trend and grouped history. Other features (backend proxy) exist only as specs in `docs/features/`.

---


## Toolchain & Quality Gate

Run `npm run check` after every code change. Never commit without it passing.

| Check | Command | Enforces |
|---|---|---|
| Type safety | `npm run typecheck` | Strict TS: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitAny`, etc. |
| Lint | `npm run lint` | Complexity (max 15), cognitive complexity (max 18), max-lines (500), max-len (150), max-depth (4), import order, no cycles |
| Dead code | `npm run knip` | Unused exports, deps, files |
| Duplication | `npm run duplication` | Copy-paste detection (JSCPD, threshold 5%) |
| Architecture | `npm run deps` | No cross-feature imports, no app↔package direction violations, no circular deps (Dependency Cruiser) |
| Shared entropy | `npm run shared-check` | Utils folder >25 files = fail |
| Security | `npm run security` | Semgrep community ruleset (injection, weak crypto, secrets) |

Configured tooling files: `tsconfig.json`, `.eslintrc.cjs`, `knip.json`, `.jscpd.json`, `.dependency-cruiser.js`, `tooling/scripts/check-shared.ts`.



---
## Pre-commit Hook

Husky runs `npm run check` on every commit. If it fails, the commit is rejected. Fix all violations before retrying.

---
## Core Principles

### 1. Simplicity First
Make every change as simple as possible. Impact minimal code. When the same outcome can be achieved with less, choose less.

### 2. No Laziness — Senior Standards
- Find root causes. No temporary fixes, no workarounds.
- If a fix feels hacky, stop and ask: *"Knowing everything I know now, what is the elegant solution?"*
- A staff engineer must be able to approve the change without hesitation.

### 3. Minimal Impact
- Changes touch only what is necessary.
- Do not refactor surrounding code unless asked.
- Do not add docstrings, comments, or type annotations to untouched code.
- Do not add error handling for scenarios that cannot happen.

### 4. Self-Improvement Loop
After **any** correction from the user:
1. Open `tasks/lessons.md`.
2. Add the pattern as a new lesson: what went wrong, the root cause, the rule to enforce.
3. Review `tasks/lessons.md` at the start of every session — apply all relevant lessons before writing any code. 
4. IMPORTANT: be honest and specific in the lessons and also be concise, sacrifice grammar for the sake of concision. The more precise you are, the better you will learn. 

### 5. Verification Before Done
- Prove it works before declaring done.
- For behaviour changes: diff what changed and confirm the diff is the minimum required.

### 6. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask *"Is there a more elegant way?"*
- For simple, obvious fixes: skip this — don't over-engineer.

---

## Code Style


---

## Comment Strategy:

* **Minimize Comments:** Do not add comments for self-explanatory code (e.g., standard variable assignments, obvious loops, or boilerplate).
* **Code as Documentation:** Prioritize expressive naming for variables and functions over adding descriptive comments.
* **Exception Rule:** Only provide comments for "Why," not "What." Use them exclusively for non-obvious business logic, complex algorithms ($O(n \log n)$ or higher), or technical debt workarounds.
* **Formatting:** If a comment is necessary, keep it to a single line above the relevant code.

## Plan mode
- Ask any clarifying questions before writing code or proposing a solution.

## Keeping AGENTS.md Current

After **all tasks for a feature are complete**, update `## Project Overview` to reflect any major change introduced — new dependencies, new screens, new database tables, new infrastructure. Reference the actual code when adding to the overview. Keep it concise.

---

## Advisor Behavior

- Never open with affirmations: no "Great question", "Absolutely", "That's a good point", "Sure!", or any variant.
- If a plan has a flaw, state the flaw first — before any positive notes.
- Do not restate what the user just said back to them as if it adds value.
- If I ask "what do you think?", give an actual opinion with a reason — not a list of trade-offs with no conclusion.
- When I present an approach, assume I want it stress-tested, not validated.
- If there is a simpler or better solution than what I proposed, say so directly and explain why mine is worse.
- Never say "it depends" without immediately specifying what it depends on and which case applies here.
- Identify the weakest assumption in my plan and name it explicitly before proceeding.
- If I'm asking a question that suggests I've already decided, call that out.
- Estimate honestly: if something will take significantly more effort than I seem to expect, say so.
