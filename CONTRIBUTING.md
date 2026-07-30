# Contributing to Quickurrence

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run tests:
   ```bash
   pnpm test
   ```
4. Start development mode:
   ```bash
   pnpm dev
   ```

## Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Add or update tests as needed — if the number of tests changed, run `pnpm test:tz:manifest` and commit the regenerated `scripts/expected-tests.json` alongside them, or every tz job fails
4. Ensure all tests pass: `pnpm test`
5. Ensure the project builds: `pnpm build`
6. Ensure types are correct: `pnpm type-check`
7. Ensure the suite is host-timezone independent: `pnpm test:tz` (and `pnpm test:tz:danger` if you touched date arithmetic) — see [Timezone testing](#timezone-testing)
8. Ensure no shipped source or built artifact pulled in a date library — see [Rules for date arithmetic](#rules-for-date-arithmetic)
9. Ensure every shipped source is tracked in git — see [Committing every shipped source](#committing-every-shipped-source)

## Timezone testing

Every result this library produces must depend only on the rule's `timezone`, never on the machine's `TZ`. That is easy to break and invisible on a UTC machine, so there are **three sweep tiers** on top of the plain `pnpm test` you run while iterating. The first row below is that plain run — it is not a sweep tier; it is the baseline the three tiers exist to supplement:

| Command | Covers | When |
| --- | --- | --- |
| `pnpm test` (baseline, not a sweep tier) | your host zone only | while iterating |
| `pnpm test:tz` | UTC, Pacific/Auckland, America/Los_Angeles | **required before every PR**; runs in CI on pushes to `main` and on PRs targeting `main` |
| `pnpm test:tz:danger` | the zones that have historically broken this library: America/Havana, Atlantic/Azores, Asia/Beirut, Africa/Cairo, America/Scoresbysund, America/Nuuk, America/Santiago, America/Asuncion, Pacific/Chatham, Australia/Lord_Howe, Asia/Kathmandu, Pacific/Kiritimati (plus the `test:tz` three) | required when you touch date arithmetic; runs in CI on pushes to `main` and on PRs targeting `main` |
| `pnpm test:tz:all` | one representative per distinct 2024-2026 DST schedule — **68 classes**, re-measured for this revision with `pnpm test:tz:offsets` on Node v22.14.0 / ICU 76.1 / tzdata 2024b | weekly in CI (sharded 4 ways) and on demand. Runs the whole suite once per class, so it costs 69 full vitest runs (68 classes plus the UTC reference) and its wall-clock cost scales with the suite size. **No wall-clock figure is quoted here on purpose:** every one previously written down went stale the next time the suite grew. Measure it when you need it — `/usr/bin/time -p pnpm test:tz:all` — and note the machine, the load and the test count from `scripts/expected-tests.json` alongside it. CI runners are slower than a dev laptop and have not been measured, which is why the CI job shards 4 ways |

`pnpm test:tz:offsets` dumps the equivalence classes as JSON, including the Node/ICU/tzdata versions they were computed from, the class count (`classCount`, 68 on the runtime above) and `legacyClassCount` — what the pre-fingerprint 5-instant sampling would produce on the same runtime (60). Both numbers come out of that command; neither is a remembered figure.

Every **sweep** tier — `test:tz`, `test:tz:danger`, `test:tz:all` — delegates to `scripts/tz-sweep.ts`, so **every zone runs even when an earlier one fails** and all failures are reported together. `scripts/` therefore has to be **committed** — an untracked `scripts/tz-sweep.ts` or `scripts/expected-tests.json` fails every tz job in CI, and the workflow checks for both files explicitly so the error names that cause instead of looking like a dependency problem.

The same trap applies to **shipped sources**, and it has already bitten twice over: `src/compare.ts` (imported by `src/index.ts` and `src/validator.ts`) and `src/options.ts` (imported by `src/index.ts`, `src/merge.ts` and `src/validator.ts`) both sit untracked — `?? src/compare.ts`, `?? src/options.ts` — while every local build passes. CI now guards that too — see [Committing every shipped source](#committing-every-shipped-source).

### Sweep options

- `TZ_SWEEP_CONCURRENCY` — integer >= 1, validated (anything else is a hard error). Defaults to `min(4, cpus)`.
- `--zones a,b,c` — run exactly these zones instead of the enumerated classes. A set whose members all share one DST schedule (`--zones UTC`, say) prints a warning: such a run shows the suite passes under one schedule and says nothing about host-timezone independence.
- `--shard i/n` — stable modulo over the sorted class list, for splitting the exhaustive run.
- `--write-manifest` — regenerate `scripts/expected-tests.json` from a UTC reference run and exit. This is what `pnpm test:tz:manifest` does; there is no other supported way to change that file.
- `--base-config path` — the vitest config the per-zone configs extend, default `vitest.config.ts`. It exists so the worker-timezone guard can be tested against a config that deliberately tampers with the worker's `TZ`; normal runs never need it.

Per-zone JSON reports land in a fresh `quickurrence-tz-*` directory under the OS temp dir; the path is printed on the first line. The generated per-zone vitest config and setup file go to `node_modules/.cache/quickurrence-tz-*` instead — they have to sit inside the project or their `vitest` / `vitest/config` imports do not resolve.

`tsconfig.json` only includes `src/**`, so `pnpm type-check` does **not** cover the sweep. Type-check it explicitly after editing it:

```bash
pnpm exec tsc --noEmit --strict --target es2022 --module esnext \
  --moduleResolution bundler --lib es2023 --types node scripts/*.ts
```

A failure looks like this — the zone, its schedule fingerprint, and the named tests:

```
TZ SWEEP FAILURE  zone=Atlantic/Azores  offsets=<a46dfcf4a59cb0a2 jan-01:00 jul+00:00>  failed=6
  - monthly > clamps monthDay 31 (src/index.test.ts:1234)
```

A green sweep over zero work is the failure mode this script exists to prevent, so the run also fails, rather than passing quietly, when:

- **the UTC reference run does not match the test manifest exactly.** `scripts/expected-tests.json` is a committed per-file manifest — a `total` plus a per-file `byFile` breakdown — generated by `pnpm test:tz:manifest` and never hand-edited. **That file is the single source of truth for the expected test counts; do not restate them here or anywhere else, because a copy goes stale the moment anyone adds a test.** Both directions are hard failures — fewer tests than the manifest *and* more:
  - a shortfall means a file failed to load or was deleted, and since the reference run is what every other zone is compared against, it would vanish from the whole sweep silently;
  - a surplus was previously only a warning, and that is exactly how the manifest once came to sit at 554 tests against a 563-test suite (a historical incident — those are **not** current counts; for those, read `scripts/expected-tests.json`): every green run printed the warning, nobody acted on it, and nine tests could have been deleted from `src/index.test.ts` with the sweep still printing `PASSED`. Exact equality is the only shape in which a stale manifest fails the run instead of licensing deletions.
  - So: **change the tests, run `pnpm test:tz:manifest`, commit the regenerated file in the same commit.** A missing or unparseable manifest is also a hard failure — it is required, not optional.
  - A loose numeric floor cannot do this job either: whatever floor you pick, an entire test file smaller than the slack between the floor and the real total — `src/times-of-day.test.ts`, say — could vanish and still clear it. Only per-file exact equality catches that, which is why the manifest is per-file.
- **any zone collects a different set of tests than the reference zone**, compared per file rather than only in total, so a file that fails to load in one zone cannot be masked by another file's count.
- **any test is skipped or todo.** `numPendingTests` is counted inside `numTotalTests`, so `it.skip` on a red timezone test would otherwise keep the sweep green. Skipping is not passing.
- **the run is broken while reporting no failed tests.** A module-level throw reports `numFailedTests: 0` with `numFailedTestSuites: 1`, `success: false` and exit 1, so the sweep reads `success`, the failed-suite count and the child's exit code, not just the failed-test count.
- **the vitest worker did not resolve the timezone it was given.** The sweep generates a per-zone vitest config that extends the project's own and appends a setup file which records `Intl.DateTimeFormat().resolvedOptions().timeZone` from inside the worker — twice, at setup time and again in a `beforeAll`, i.e. after every other setup file has run. Any recorded zone that is not the requested one is red, and so is an empty record (the probe did not run, so nothing was established).

  Asking a sibling `node -p` child instead — what this replaced — is defeated by construction. Measured: a `setupFiles` entry containing `env.TZ = 'UTC'` makes every zone's run execute as UTC; the sibling child still reports the requested zone, vitest reports a full green run — every test collected, `0` failures, `success: true` — and the old sweep printed `PASSED`. With the worker probe the same config fails with exit 1 and names both phases. That is also why the generated config *extends* the project config rather than passing `--setupFiles`, which would replace the project's list and hide the tampering.

  This subsumes the older `TZ=Bogus/Zone` case (which runs at GMT+0000 while `Intl` still enumerates every zone); a cheap sibling-child pre-flight is still done first, only so an unresolvable name is rejected before a whole suite run is spent on it.
- **no JSON report is produced, or the enumerated class count falls below its floor.**

When a zone is red the sweep prints **every** failing test for it, not a sample — the GitHub *annotation* is capped at three names by GitHub's own limits and says how many more are in the job log.

### Rules for date arithmetic

- All wall-clock construction and date arithmetic must go through the private zoned helpers in `src/index.ts` — the module-level `zonedParts`, `zonedWallClock`, `zonedWallClockToInstant`, `zonedStartOfDayIn`, `zoneOffsetMsAt`, `utcInstantFromParts`, and the `Quickurrence` private methods `wallClock`, `zonedPartsOf`, `zonedStartOfDay`, `zonedAddDays`, `zonedAddWeeks`, `zonedAddMonths`, `zonedAddYears`, `zonedSetTime`, `zonedStartOfWeek`, `zonedNextDay`, … As of `0.4.0` this is strictly true for the first time: there is no other path. They read no host timezone state, and **every one of them that returns a date returns a plain `Date`** (the rest return numbers or a `ZonedParts`), so no subclass can leak out through a return value. There is no `anchor()` helper: read wall-clock fields with `zonedPartsOf` (or the module-level `zonedParts`), which hands back a `ZonedParts`.
- **Enumerated option values live in `src/options.ts`, and only there.** It exports `recurrenceRulesOptions`, `presetOptions`, `dayOptions`, `monthDayOptions`, `monthDayModeOptions`, `nthWeekdayOfMonthOptions`, the `isOneOf` type-guard factory, and the `MAX_NEXT_OCCURENCES` cap.

  **Why it exists.** Both validation layers import it — the zod schemas in `src/index.ts` (import at `src/index.ts:5-14`) and the imperative checks in `src/validator.ts` (`src/validator.ts:7-15`) — so the two read the same arrays instead of restating them. (`src/merge.ts:1` imports it too, but only for `MAX_NEXT_OCCURENCES`; the option arrays are the two validation layers' concern.) Restating the lists in two places is precisely what let the layers drift, leaving values one layer accepted and the other rejected. Widening or narrowing an option therefore means editing **exactly one array here** and nothing else: never inline a `['daily', 'weekly', …]` literal at a call site, and never make `validator.ts` import the arrays from `./index` to share them. `src/validator.ts` keeps its only edge to `./index` **type-only** for that reason (see the comment at `src/validator.ts:2-6`), so there is no runtime import cycle; sourcing the values from `./options` is what makes that possible.

  **It is internal, with one deliberate exception.** The module is never re-exported wholesale — do not add `export * from './options'`, or every array above becomes semver-locked. `src/index.ts:16` re-exports exactly one binding by name, `export { recurrenceRulesOptions };`, and that one *is* public: it appears in the emitted `dist/index.d.ts` export list. Treat it as part of the published contract and everything else in the module as free to change.

  It is also one of the two shipped sources currently untracked in git — see [Committing every shipped source](#committing-every-shipped-source).
- **Every public return value must be a plain `Date`.** This is a documented `0.4.0` guarantee (see [Reading returned dates](README.md#reading-returned-dates)), so regressing it is a breaking change, not a detail. Assert it with `Object.getPrototypeOf(value) === Date.prototype`, not with `instanceof Date` — a subclass passes `instanceof`. It holds today for `getNextOccurrence`, `getAllOccurrences`, `getCommonOccurrences`, the `QuickurrenceMerge` equivalents and the `getStartDate` / `getEndDate` / `getExcludeDates` clones, verified across every rule shape (with and without `timesOfDay`) under five host zones.
- **No shipped file may import from `date-fns` or `@date-fns/tz` at all.** Not `{ in: ... }`, not `tz(...)`, not `TZDate`, not a type-only import — the dependency is gone and must stay gone, because some published `@date-fns/tz` versions leak the host's DST gap into the result even when the rule timezone is UTC, and because both packages are devDependencies now, so a shipped import would be a missing runtime dependency for consumers. The review check is:

  ```bash
  grep -rnE "(from|import|require)[[:space:]]*\(?[[:space:]]*['\"]@?date-fns" src \
    --include='*.ts' --include='*.cts' --include='*.mts' \
    --include='*.js' --include='*.cjs' --include='*.mjs' \
    --exclude='*.test.*'
  ```

  which must stay **empty**. It is empty on this tree (verified: no output, exit 1). CI runs the identical command in the *Check no shipped source imports a date library* step.

  It replaces two weaker checks, both measured to be blind:

  - `grep -rn "{ in:" src/*.ts | grep -v '\.test\.ts'` only ever saw one *usage* form and never the import. Measured against `v0.3.2`: **two** shipped files imported a date library — `src/index.ts` (from `@date-fns/tz` **and** `date-fns`) and `src/validator.ts` (from `date-fns`). `src/merge.ts` imported neither; `git show HEAD:src/merge.ts | grep date-fns` prints nothing. `{ in:` occurrence counts at that revision were `src/index.ts` **55**, `src/merge.ts` **0**, `src/validator.ts` **0** — so **one half** of the violation (`src/validator.ts`) was invisible to that grep, not two thirds.
  - `grep -rn "from 'date-fns'\|from '@date-fns" src/*.ts | grep -v '\.test\.ts'` missed six of the eight violation forms constructed to test it. It caught only the single-quoted static import and the single-quoted type-only import. It missed: a double-quoted specifier (`from "@date-fns/tz"`); a dynamic `await import('date-fns')`; a `require('date-fns')` in a `.cts` file; **any file in a subdirectory** — the shell expands `src/*.ts` to top-level files only, which makes the `-r` inert; an indented side-effect `  import '@date-fns/utc';`; and a real violation on a line that merely *contains the text* `.test.ts` in a trailing comment, because `grep -v '\.test\.ts'` filters on **line content**, not on filename. The replacement above excludes tests with `--exclude='*.test.*'`, which is a filename glob, and was verified to print all eight violations.

  ### The build and artifact gates

  The old second gate — after `pnpm build`, `grep -n "^import" dist/index.js` must print exactly one line — **could not fail for the violation it gated.** Measured: injecting a real `import { isSameDay } from 'date-fns'` plus a use of it into `src/index.ts` and running `pnpm exec tsup` produced a bundle where `grep -c '^import' dist/index.js` was still `1`, because `date-fns` is a devDependency and `tsup.config.ts` had no `external` list, so tsup **inlined** it — `Symbol.for("constructDateFrom")` at `dist/index.js:11`, `function isSameDay(...)` at line 44. The library shipped inside the package and the gate saw nothing. (The `^` anchor is separately defeated by an indented import.)

  Three gates now, earliest first:

  1. **`pnpm build` fails outright.** `tsup.config.ts` externalises everything in `devDependencies` *except* the date libraries, and an esbuild `onResolve` plugin turns any `date-fns` / `@date-fns/*` specifier into a build error. The date libraries are deliberately left **out** of `external` because esbuild applies `external` before it runs plugins — listing them there makes the plugin unreachable, which was measured (the build succeeded and merely emitted a bare `import ... from "date-fns"`). Re-running the injection above against the fixed config exits **1** with `ERROR: [plugin: no-date-libs-in-shipped-code] Shipped code must not import 'date-fns'`, pointing at `src/index.ts:1:26`.
  2. **No date library in the artifacts.** A *type-only* import is erased before esbuild resolves it, so the build cannot catch that one. This must be empty:

     ```bash
     grep -nE "['\"]@?date-fns|constructDateFrom" \
       dist/index.js dist/index.cjs dist/index.d.ts dist/index.d.cts
     ```

     Verified to fire on both failure shapes: against a silently **inlined** bundle it prints `dist/index.js:11:` and `dist/index.cjs:65:` (`Symbol.for("constructDateFrom")`); against an **externalised but still imported** build it prints `import { isSameDay } from "date-fns"` and `require("date-fns")`. It is empty on this tree. Note the deliberate omission of `dist/*.map`: source maps embed `sourcesContent`, so a prose comment in `src/` that merely mentions date-fns matches there — measured, one such hit on this clean tree.
  3. **The full specifier census** — not "how many `^import` lines", but the complete set of module specifiers in both bundles:

     ```bash
     grep -ohE 'from "[^"]+"|require\("[^"]+"\)' dist/index.js dist/index.cjs | sort -u
     ```

     must print exactly two lines, `from "zod"` and `require("zod")`. Measured on this tree: exactly that. An indented import, an extra bare specifier, or a `require` — which the old `^import` grep never looked at, since it only read the ESM bundle — all change this output.

  Gates 2 and 3 run in CI in the *Check no date library reached the package* step.

  **Test files are explicitly carved out.** `src/*.test.ts` may keep using `date-fns`, `@date-fns/tz` and `@date-fns/utc` to build fixtures and format expected values — an independent implementation is what makes those expectations worth anything. That carve-out is precisely why those packages are `devDependencies` and not `dependencies`.
- `TZDate` no longer appears in shipped code at all, so the old "instant form only" rule applies to **test files only**: in a test, construct it as `new TZDate(epochOrDate, zone)`, never with the component constructor.
- The same standards apply to what the docs *recommend*, not just to `src/`. `startOfDay`/`endOfDay` with `{ in: tz(...) }` looks host-independent and is not: re-measured on this working tree, `startOfDay(new TZDate('2026-03-29T12:00:00.000+02:00', 'Europe/Warsaw'), { in: tz('Europe/Warsaw') }).getTime()` returns `1774738800000` on a `UTC`, `Pacific/Auckland` or `America/Los_Angeles` host, `1774735200000` on `America/Godthab` and `1774742400000` on `Asia/Beirut`. Examples must build boundaries as `new Date('…±HH:MM')` — a plain `Date` from an ISO string with an **explicit offset**, which pins the instant before anything else sees it and is host-stable by construction.

  **On `new TZDate(...)` in the README.** The rule is not "never"; the previous wording forbade something the README deliberately does, and that contradiction is resolved in favour of the README. `new TZDate(...)` is allowed in a README passage that is **explicitly labelled** as either (a) requiring `@date-fns/tz` — the "if you already have `date-fns` / `@date-fns/tz` in your project" escape hatches and the migration notes — or (b) a **counter-example**, i.e. code shown in order to say *do not do this*. Those are legitimate precisely because the label tells the reader that the snippet involves a package quickurrence does not depend on; that is the whole point of an escape hatch, and a counter-example that cannot name the broken construct cannot warn about it. Everywhere else — any snippet presented as the ordinary way to use this library — build boundaries with `new Date('…±HH:MM')` and do not mention a date library. Inside a labelled passage, still use the instant form (`new TZDate(epochOrDate, zone)`) rather than the component constructor, and never present `startOfDay`/`endOfDay` with `{ in: tz(...) }` as a *recommendation*, for the reason measured just above.

## Packaging

### Committing every shipped source

A shipped module that was never `git add`ed builds fine on the author's machine and is simply absent everywhere else, so the published package is unbuildable. This is not hypothetical, and it is **not one file**: `git status` reports both `?? src/compare.ts` and `?? src/options.ts` — untracked and not gitignored. `src/compare.ts` is imported by `src/index.ts:2` and `src/validator.ts:1`; `src/options.ts` is imported by **three** shipped modules — `src/index.ts:14`, `src/merge.ts:1` and `src/validator.ts:15` — and holds every enumerated option value, `isOneOf` and the `MAX_NEXT_OCCURENCES` cap.

Run this before you push; it must print nothing:

```bash
comm -23 \
  <(find src -type f \( -name '*.ts' -o -name '*.cts' -o -name '*.mts' \) ! -name '*.test.ts' | sort) \
  <(git ls-files src | sort)
```

Re-run on this working tree, it prints **two** lines:

```
src/compare.ts
src/options.ts
```

Commit **both**, not just the one this document used to name — `git add src/compare.ts src/options.ts`. Missing either leaves the package unbuildable in exactly the same way.

CI runs the same command in the *Check every shipped source is committed* step — but note that in a CI checkout only tracked files exist, so that diff is always empty there. What actually catches the omission in CI is the build: with `src/compare.ts` removed, `pnpm build` exits **1** with `src/index.ts:2:43: ERROR: Could not resolve "./compare"` and `src/validator.ts:1:25: ERROR: Could not resolve "./compare"`. Removing `src/options.ts` instead exits **1** with three, one per importer: `src/index.ts:14:7`, `src/merge.ts:1:36` and `src/validator.ts:15:7`, all `ERROR: Could not resolve "./options"`. Both were measured by building a copy of `src/` with the file withheld. The CI build step wraps that failure with a message naming the real cause, because "Could not resolve" otherwise reads like a dependency problem.

### The `exports` map

`exports["."]` must carry a `types` condition **per format**, not one at the top:

```jsonc
".": {
  "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
}
```

The package is `"type": "module"`, so a single top-level `"types": "./dist/index.d.ts"` hands a CommonJS consumer the ESM-flavoured declaration file. Measured with a CJS consumer (`"type": "commonjs"`, `module`/`moduleResolution` `node16`) importing `Quickurrence`:

- before: `error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module and cannot be imported with 'require'.`
- after: `tsc` exits **0**, and `--traceResolution` confirms `Module name 'quickurrence' was successfully resolved to '.../dist/index.d.cts'`.

tsup already emits `dist/index.d.cts`; before this change nothing referenced it.

### The zod peer range

`peerDependencies.zod` is `>=4.0.0`. It is **not** a runtime floor — the runtime works on zod 3 — it is a *type* floor, and the type surface is part of the published contract. Measured by type-checking the emitted `dist/index.d.ts` with `skipLibCheck: false`:

| zod | `tsc` errors |
| --- | --- |
| 3.25.76 | **26** — 14 × TS2724 (no exported member `ZodCustom`), 6 × TS2694 (namespace has no exported member `core`), 6 × TS2344 (zod-4 object-form `z.ZodEnum` does not satisfy zod 3's `[string, ...string[]]`) |
| 4.3.6 | **0** |

Re-measure with the version you care about rather than trusting this table; the counts move with both the zod patch release and the shape of `src/validator.ts`.

zod is also a **devDependency**, pinned exactly (`"zod": "4.3.6"`, the installed version per `pnpm ls zod`). It used to be absent from `devDependencies` entirely and resolved only through pnpm's `autoInstallPeers` — the same trap that would have broken the suite when `date-fns` moved out of `dependencies`. The repo's own build and tests must not depend on that setting. If you change the peer range, change the pinned devDependency to a version inside it and re-run the table above.

## Pull Request Process

1. Update the README.md if your change affects the public API
2. Write a clear PR description explaining what changed and why
3. Ensure all CI checks pass
4. Request a review

## Code Style

- TypeScript strict mode
- Use `type` instead of `interface`
- Prefer type inference over explicit type annotations
- Use `as const` for constant definitions
- Write tests for all new functionality

## Reporting Issues

- Use the GitHub issue templates
- Include a minimal reproduction if reporting a bug
- Check existing issues before creating a new one

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
