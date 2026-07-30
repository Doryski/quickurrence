# Quickurrence

[![npm version](https://img.shields.io/npm/v/quickurrence.svg)](https://www.npmjs.com/package/quickurrence)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

A powerful, type-safe recurrence rule engine for TypeScript. Generate recurring dates with full timezone support, built on [Zod](https://zod.dev/) and nothing else — there is no date-library dependency, and all timezone math goes through the platform's own `Intl` APIs.

## Why Quickurrence?

- **Type-safe**: Full TypeScript support with exported types and Zod schemas for runtime validation
- **Timezone-aware**: IANA timezone handling built on `Intl`, with no date-library dependency
- **Flexible**: Daily, weekly, monthly, yearly rules with presets, nth weekday, custom conditions, and more
- **Composable**: Merge multiple recurrence rules into unified date sequences
- **Validated**: Built-in validator with detailed, actionable error messages

## Installation

```bash
pnpm add quickurrence
# or
npm install quickurrence
# or
yarn add quickurrence
```

The **only** peer dependency is [`zod`](https://zod.dev/) (`>=4.0.0`). Nothing else has to be installed.

The range was `>=3.0.0` up to and including `0.3.2`, and that was wrong for TypeScript consumers: the emitted `dist/index.d.ts` has never compiled against zod 3. It is a **type** floor, not a runtime floor — the shipped JavaScript does run on zod 3, which is why the mismatch went unnoticed. Measured on this build with `tsc 5.8.3`, `--strict`, `--skipLibCheck false`: **0 errors on `zod@4.3.6`**, and on `zod@3.25.76` a fatal set of them — `ZodCustom` and the `z.core` namespace simply do not exist there (`TS2724` / `TS2694`), and zod 4's object-form `z.ZodEnum` does not satisfy zod 3's `[string, ...string[]]` (`TS2344`). The exact count moves with the zod patch release and the shape of `src/validator.ts`, so re-measure rather than quote a number; see [CONTRIBUTING.md](CONTRIBUTING.md#the-zod-peer-range). `0.4.0` corrects the declared range rather than the types.

`date-fns` and `@date-fns/tz` were peer dependencies up to and including `0.3.2`. As of `0.4.0` they are gone: the shipped bundle imports `zod` and nothing else (`dist/index.js` contains exactly one import statement, `import { z } from "zod"`). Both packages are still devDependencies here, because the test suite uses them to build fixtures and format expected values — but consumers who installed them only for Quickurrence can remove them. See [Migration to 0.4.0](#migration-to-040).

## Quick Start

```typescript
import { Quickurrence } from 'quickurrence';

// Every day starting from a date
const daily = new Quickurrence({
  rule: 'daily',
  startDate: new Date('2026-01-01'),
  timezone: 'America/New_York',
});

// All occurrences within a date range (capped at 1000 results)
const januaryDays = daily.getAllOccurrences({
  start: new Date('2026-01-01'),
  end: new Date('2026-01-31'),
});

// Or just the next single occurrence after a given date
const next = daily.getNextOccurrence(new Date('2026-01-01'));

// Every Monday and Wednesday
const weekdays = new Quickurrence({
  rule: 'weekly',
  startDate: new Date('2026-01-01'),
  timezone: 'Europe/London',
  weekDays: [1, 3], // Monday, Wednesday
});

// First business day of each month
const monthly = new Quickurrence({
  rule: 'monthly',
  startDate: new Date('2026-01-01'),
  timezone: 'Asia/Tokyo',
  monthDay: 1,
});

// Business days only (preset)
const businessDays = new Quickurrence({
  rule: 'daily',
  startDate: new Date('2026-01-01'),
  timezone: 'America/Chicago',
  preset: 'businessDays',
});
```

## API Reference

### `Quickurrence`

The main class for defining and generating recurrence rules.

#### Constructor Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `rule` | `'daily' \| 'weekly' \| 'monthly' \| 'yearly'` | No | Recurrence frequency (defaults to `'daily'`) |
| `startDate` | `Date` | No | Start date for the recurrence (defaults to now, normalized to start of day in `timezone`) |
| `timezone` | `string` | No | IANA timezone identifier (defaults to `'UTC'`) |
| `interval` | `number` (≥ 1) | No | Interval between occurrences (e.g., every 2 weeks; defaults to `1`) |
| `endDate` | `Date` | No | End date for the recurrence (normalized to its day, or kept as an exact instant when `timesOfDay` is set - see [Range & end-date boundaries](#range--end-date-boundaries)) |
| `count` | `number` (≥ 1) | No | Maximum number of occurrences |
| `weekStartsOn` | `WeekStartsOn` (0-6) | No | First day of the week (0 = Sunday; defaults to `1` = Monday) |
| `weekDays` | `WeekDay[]` (0-6) | No | Days of the week for weekly rules (0 = Sunday) |
| `monthDay` | `MonthDay` (1-31) | No | Day of the month for monthly rules |
| `monthDayMode` | `'skip' \| 'last'` | No | How to handle months without the specified day (defaults to `'last'`) |
| `nthWeekdayOfMonth` | `NthWeekdayConfig` | No | Nth weekday of month (e.g., 2nd Tuesday) |
| `excludeDates` | `Date[]` | No | Dates to exclude from the recurrence |
| `condition` | `Condition` = `boolean \| ((date: Date, parts: ZonedParts) => boolean)` | No | Custom **day** filter, invoked once per candidate day. `date` is that day's `00:00` in the **rule** timezone as a plain `Date`, so **its own getters read the HOST timezone**; `parts` carries the same midnight's wall-clock fields in the **rule** timezone (`{ year, month, day, weekday, hour, minute, second, ms }`, with `hour`/`minute`/`second`/`ms` always `0`). Branch on `parts` - see [Custom Conditions](#custom-conditions) |
| `preset` | `'businessDays' \| 'weekends'` | No | Predefined day-of-week filters |
| `timesOfDay` | `string[]` (`"HH:MM"`) | No | Times of day to fire on each matching day (24-hour format, e.g. `['09:00', '14:30']`); switches range and `endDate` comparisons to exact instants - see [Range & end-date boundaries](#range--end-date-boundaries) |

#### Methods

- **`getNextOccurrence(after?: Date): Date`** - Get the next single occurrence strictly after `after` (defaults to `new Date()`). Throws a `QuickurrenceError` when no further occurrence exists (`count`/`endDate` limit reached) **and also when the search window runs out** — see [Limits and caps](#limits-and-caps), because a rule with no `endDate` and no `count` can still throw.
- **`getAllOccurrences(range: DateRange): Date[]`** - Get every occurrence within the given `{ start, end }` range. Both ends are inclusive, but the comparison granularity depends on `timesOfDay` - see [Range & end-date boundaries](#range--end-date-boundaries). Results are capped at 1000 - see [Limits and caps](#limits-and-caps). To test whether a specific date is an occurrence, generate the occurrences for that day's range and check membership.
- **`getStartDate(): Date`** / **`getEndDate(): Date | undefined`** - Get the normalized start / end date.
- **`getRule(): RecurrenceRule`** - Get the recurrence rule.
- **`getOptions(): QuickurrenceOptions`** - Get a clone of the options used to build the instance. **Throws a `DataCloneError` when `condition` is a function** - see [Limits and caps](#limits-and-caps).
- **`toHumanText(): string`** - Human-readable description (also available as the static `Quickurrence.toHumanText(options)`).
- Config getters: **`getWeekStartsOn`**, **`getWeekDays`**, **`getMonthDay`**, **`getMonthDayMode`**, **`getNthWeekdayOfMonth`**, **`getCount`**, **`getExcludeDates`**, **`getCondition`**, **`getPreset`**, **`getTimesOfDay`**.
- Static helpers: **`Quickurrence.clean(options)`**, **`Quickurrence.presetToOptions(preset)`**, **`Quickurrence.update(options, updates)`**, **`Quickurrence.getMatchingPreset(options)`**, **`Quickurrence.sortWeekDaysForDisplay(weekDays)`**.

#### Range & end-date boundaries

Both ends of a `DateRange` are **inclusive**. What differs is the granularity of the comparison, because a rule without `timesOfDay` matches **days** while a rule with `timesOfDay` matches **instants**:

| Boundary | Without `timesOfDay` | With `timesOfDay` |
| --- | --- | --- |
| `range.start` | whole day is in range | exact instant; earlier slots on that day are dropped |
| `range.end` | whole day is in range | exact instant; later slots on that day are dropped |
| `endDate` | collapsed to its day, so that whole day recurs | exact instant; acts as a hard cutoff inside its own day |

A day-level rule returns one date per matching day, always the day's marker at `00:00` in the rule timezone. A `timesOfDay` rule returns the individual slots. So the two forms can legitimately report **different sets of days** for the same input:

> **Note — build boundaries from an explicit offset, and nothing else.** This is advice for *your* code: Quickurrence only ever receives the instant you hand it, so how you construct that instant decides whether your call is reproducible.
>
> A bare ISO string with no offset is parsed in the **host** timezone, so the instant it denotes changes from machine to machine. Measured, `new Date('2026-01-15T00:00:00').getTime()` is `1768435200000` on a `UTC` host, `1768388400000` on a `Pacific/Auckland` host (13 hours earlier), `1768464000000` on `America/Los_Angeles`, `1768414500000` on `Asia/Kathmandu` and `1768384800000` on `Pacific/Kiritimati`. Compare `getTime()`, never a formatted string.
>
> If you use `date-fns`, `startOfDay`/`endOfDay` with `{ in: tz(...) }` is **not** a fix for this, even though it names the zone explicitly. Measured, `startOfDay(new TZDate('2026-03-29T12:00:00.000+02:00', 'Europe/Warsaw'), { in: tz('Europe/Warsaw') }).getTime()` is `1774738800000` on a `UTC`, `Pacific/Auckland` or `America/Los_Angeles` host, `1774735200000` on an `America/Godthab` host and `1774742400000` on an `Asia/Beirut` host — three different instants for one expression, because that path routes the day boundary through the host's own wall clock and so inherits the host's DST transitions. Days without a transition in the rule zone happen to agree; DST days do not.
>
> There is one host-stable way to write a boundary: an **explicit offset in the string**, which pins the instant before anything else sees it. Look the rule zone's offset up for that date (`+01:00` for Warsaw in January, `+02:00` in July) and write it out. A plain `new Date('2026-01-14T00:00:00.000+01:00')` is enough — measured, it yields epoch `1768345200000` on every one of the five hosts above, and is byte-for-byte the same instant a `TZDate` built from the same string would carry.

```typescript
const range = {
  start: new Date('2026-01-14T00:00:00.000+01:00'),
  // Start of Jan 15 in Warsaw, written as an instant: no host state involved.
  end: new Date('2026-01-15T00:00:00.000+01:00'),
};

// Day-level: Jan 15's marker IS 00:00, so it is inside the range.
dayRule.getAllOccurrences(range); // => Jan 14, Jan 15

// timesOfDay: every slot on Jan 15 (08:00, 20:00) is after 00:00, so none qualify.
slotRule.getAllOccurrences(range); // => Jan 14 08:00, Jan 14 20:00
```

The same applies to `endDate`: a `timesOfDay` rule with `endDate` at start-of-day stops **before** that day's slots, and `getNextOccurrence` throws `END_DATE_EXCEEDED` accordingly. To include the final day, give `endDate` an end-of-day instant — again with the offset written out:

```typescript
// Recur through the end of Jan 15 in Warsaw, slots included
endDate: new Date('2026-01-15T23:59:59.999+01:00');
```

#### Limits and caps

Three separate bounds can truncate a result. Only the first is a design decision you can plan around; the other two are known limitations.

**1. 1000 returned values per call.** The cap is on the length of the array you get back, *after* `timesOfDay` slot expansion and *after* a `QuickurrenceMerge` union — not on the number of candidate days collected. Measured on `0.4.0` over a 50-year range (`2000-01-01` → `2050-01-01`, UTC), every one of these returns exactly **1000**: a day-level `daily` rule, a day-level `weekly` rule, `daily` with 1, 2 or 3 `timesOfDay` slots, `weekly` + `weekDays` with 3 slots, `daily` with `count: 5000`, a 2-rule merge union, a 3-rule merge union, and `getCommonOccurrences` on two identical rules with or without slots.

> This was **broken before `0.4.0`**, and if you relied on the old numbers your pagination is off by more than one. The same calls on `0.3.2` returned `1001` for the day-level and 1-slot shapes, `2002` for two slots, `3003` for three slots, `3006` for `weekly` + `weekDays` with three slots, `1859` for a `daily`+`weekly` merge union, and `3003` for `getCommonOccurrences` over three slots.

**2. Monthly rules stop after 121 iterations of their own interval.** A `monthly` rule that names a day — `monthDay` *or* `nthWeekdayOfMonth` — walks month by month and gives up once its internal counter passes 120, so it returns at most **121 occurrences** no matter how wide the range or how large the `count`. Measured over the same 50-year range: `monthly` + `monthDay: 1` returns 121 values ending `2010-01-01`; `monthly` + `nthWeekdayOfMonth: { weekday: 1, nth: 1 }` returns 121 ending `2010-01-04`; adding `count: 500` does not raise it. The bound counts *intervals*, not months, so `interval: 2` still returns 121 values but reaches `2020-01-01` and `interval: 3` reaches `2030-01-01`. A bare `monthly` rule with neither option takes a different path and is **not** affected: re-measured over that same `2000-01-01` → `2050-01-01` UTC range it returns **601** values, and **600** with `timesOfDay: ['09:00']`. The one-value difference is the boundary rule, not the cap — the range end is `2050-01-01T00:00:00Z`, the day-level form matches that whole day so its `2050-01-01` marker is in range, and the slot form compares exact instants so `2050-01-01T09:00:00Z` falls past the end and the last value is `2049-12-01T09:00:00Z`. With `timesOfDay: ['00:00']` the slot *is* the boundary instant and the count is 601 again. See [Range & end-date boundaries](#range--end-date-boundaries). (The figure **720** belongs to a 2000 → 2060 range, not this one; over 2000 → 2060 it is 721 day-level and 720 with a `['09:00']` slot.) This limitation predates `0.4.0` — `0.3.2` returns the same 121 — and is unchanged.

**3. `getNextOccurrence` has a bounded look-ahead and can throw with no `endDate` and no `count`.** The error is `END_DATE_EXCEEDED` even though no end date exists. Two measured shapes:

```typescript
// weekly + weekDays, startDate 2026-01-01, no endDate, no count
rule.getNextOccurrence(new Date('2025-12-25')); // => 2026-01-05
rule.getNextOccurrence(new Date('2020-01-01')); // => throws END_DATE_EXCEEDED

// monthly + monthDay: 1, startDate 2000-01-01, no endDate, no count
rule.getNextOccurrence(new Date('2009-06-01')); // => 2009-07-01
rule.getNextOccurrence(new Date('2011-01-01')); // => throws END_DATE_EXCEEDED  (past the 121-month bound above)
```

Measured on the same inputs, `daily`, bare `weekly`, `daily` + `timesOfDay`, and both `monthly` shapes with an `after` inside the window all return normally. Treat `getNextOccurrence` as answering "what is next from roughly here", not "what is next from an arbitrary point in history".

**Not a cap, but a hard failure in the same spirit: `getOptions()` throws when `condition` is a function.** The clone goes through `structuredClone`, which cannot clone functions, so the call throws a `DOMException` named `DataCloneError` — *not* a `QuickurrenceError`, so it has no `code`, no `type` and no `context`, and `error instanceof QuickurrenceError` is `false`. Measured on `{ rule: 'daily', timezone: 'UTC', condition: () => true }`: `getOptions()` throws `DataCloneError: ()=>true could not be cloned.`, while `getCondition()`, `toHumanText()`, `Quickurrence.clean(options)` and `Quickurrence.update(options, …)` all succeed on the very same rule. A `boolean` `condition` clones fine. This is **not** a `0.4.0` regression — `0.3.2` throws identically on the same input — but nothing else in the API behaves this way, so guard the call or read `getCondition()` instead when the predicate might be a function.

### Reading returned dates

**Every value Quickurrence hands back is a plain `Date` at an exact instant.** That is the contract as of `0.4.0`, and it holds for every rule shape and every method — `Quickurrence`'s `getNextOccurrence` / `getAllOccurrences`, `QuickurrenceMerge`'s `getNextOccurrence` / `getAllOccurrences` / `getCommonOccurrences` (that last one exists **only** on `QuickurrenceMerge`, never on `Quickurrence`), the `Quickurrence.update()` static, and the `getStartDate()` / `getEndDate()` / `getExcludeDates()` clones. There is no subclass involved anywhere.

Concretely:

- `Object.getPrototypeOf(occurrence) === Date.prototype` and `occurrence.constructor.name === 'Date'`;
- `occurrence.toISOString()` always ends in `Z`, for every rule timezone including UTC;
- `getTime()` **is** the value. Two occurrences are the same occurrence exactly when their epochs match.

The consequence to internalize: **calendar fields read off a returned value are the HOST's, never the rule's.** `occurrence.getHours()` on a Warsaw 09:00 slot reads `8` on a `UTC` host, `21` on `Pacific/Auckland`, `0` on `America/Los_Angeles`, `6` on `America/Godthab` and `10` on `Asia/Beirut` — all for the same instant, epoch `1767600000000`. To read the rule zone you must name the rule zone. `Intl.DateTimeFormat` does that with no dependencies:

```typescript
const [occurrence] = rule.getAllOccurrences(range);

// Whole formatted value in the rule timezone
new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  dateStyle: 'full',
  timeStyle: 'short',
}).format(occurrence);

// Individual fields in the rule timezone
const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(occurrence)
    .filter((p) => p.type !== 'literal')
    .map((p) => [p.type, p.value]),
);
// => { weekday: 'Mon', year: '2026', month: '01', day: '05', hour: '09', minute: '00' }
```

> **If you already have `date-fns` / `@date-fns/tz` in your project**, their zone-aware forms still work unchanged — a returned plain `Date` is just an instant, and wrapping it reproduces exactly the object earlier versions handed you (`new TZDate(new Date(epoch), 'Europe/Warsaw')` has the same `getTime()` and the same `toISOString()` as the `TZDate` `0.3.2` returned). Quickurrence simply no longer requires either package:
>
> ```typescript
> import { tz, TZDate } from '@date-fns/tz';
> import { getDay } from 'date-fns';
>
> new TZDate(occurrence, 'Europe/Warsaw').getDate(); // day of month in the rule timezone
> getDay(occurrence, { in: tz('Europe/Warsaw') }); // weekday in the rule timezone
> ```

### Host timezone independence

Results depend only on the rule's `timezone`, never on the machine's `TZ`. All wall-clock construction goes through an internal `Intl`-based primitive that reads no host timezone state, so a rule produces byte-identical instants on every host. Nothing in the shipped code routes wall-clock arithmetic through a third-party date library, so no version of one can perturb the result — the historical failure this replaced was exactly that: some published `@date-fns/tz` versions leak the *host's* DST gap into UTC arithmetic.

#### Wall clocks that do not exist, or exist twice

Twice a year a `timesOfDay` slot can name a wall clock that its zone skips (spring-forward gap) or repeats (fall-back overlap). What Quickurrence guarantees there is **not** a semantic policy such as "always the earlier occurrence". It is one mechanical rule:

> The offset applied to the requested wall clock is whichever offset the rule zone is in effect at the instant you get by reading that wall clock **as if it were UTC**.

Everything the rule gives you follows from that, and only these things are promised:

- the result is **stable** and **host-timezone independent** — the same input yields the same epoch on every machine;
- for a wall clock that exists exactly once it is the obvious instant, and it round-trips.

The honest consequence: **which side of the transition you land on is zone-dependent**, because it depends on where the transition sits in UTC relative to the wall clock you asked for. Neither "gaps move forward" nor "overlaps pick the later occurrence" holds in general. Measured on ICU 76.1 / tzdata 2024b:

| Case | Rule zone | Requested slot | Resolved wall clock | Which occurrence |
| --- | --- | --- | --- | --- |
| gap | `Europe/Warsaw` | 2026-03-29 02:30 | 01:30 +01:00 | **before** the gap |
| gap | `Australia/Lord_Howe` | 2026-10-04 02:15 | 01:45 +10:30 | **before** the gap |
| gap | `America/New_York` | 2026-03-08 02:30 | 03:30 −04:00 | **after** the gap |
| gap | `America/Havana` | 2026-03-08 00:30 | 01:30 −04:00 | **after** the gap |
| overlap | `Europe/Warsaw` | 2026-10-25 02:30 | 02:30 +01:00 | the **later** one |
| overlap | `America/New_York` | 2026-11-01 01:30 | 01:30 −04:00 | the **earlier** one |

So this is neither RFC 5545's nor Temporal's `disambiguation: 'compatible'` behaviour (both always take the earlier occurrence in an overlap): for `Europe/Warsaw` it disagrees with them, for `America/New_York` it agrees. If your schedule needs a defined side of a transition, do not put a slot in the affected hour — pick a time that exists once every day of the year.

All six rows were re-measured on `0.4.0` under five host zones (`UTC`, `Pacific/Auckland`, `America/Los_Angeles`, `Asia/Kathmandu`, `Pacific/Kiritimati`). Every epoch is identical on every host: Warsaw gap `1774744200000`, Lord Howe gap `1791040500000`, New York gap `1772955000000`, Havana gap `1772947800000`, Warsaw overlap `1792891800000`, New York overlap `1793511000000`.

`0.3.2` does **not** reproduce this table. Re-measured on the same five hosts, `0.3.2` agrees with the `0.4.0` value in these cases and only these:

| Row | `0.3.2` agrees on | `0.3.2` differs on |
| --- | --- | --- |
| gap `Europe/Warsaw` 02:30 | UTC, Los Angeles | Auckland, Kathmandu, Kiritimati (`03:30 +02:00`, *after* the gap) |
| gap `Australia/Lord_Howe` 02:15 | — none — | UTC, Los Angeles, Kathmandu (`01:15 +10:30`, collapsed onto the 01:15 slot); Auckland, Kiritimati (`02:45 +11:00`) |
| gap `America/New_York` 02:30 | all five | — |
| gap `America/Havana` 00:30 | UTC, Auckland, Kathmandu, Kiritimati | Los Angeles (emitted no slot on that local day at all) |
| overlap `Europe/Warsaw` 02:30 | UTC, Los Angeles | Auckland, Kathmandu, Kiritimati (`02:30 +02:00`, the *earlier* one) |
| overlap `America/New_York` 01:30 | UTC, Auckland, Kathmandu, Kiritimati | Los Angeles (`01:30 −05:00`, the *later* one) |

So the mechanical rule is what `0.3.2` did **on a UTC host, for five of these six rows** — and that is the whole basis for keeping it rather than choosing a policy. On any other host `0.3.2` produced a different side of the transition for some of them, which is a bug, not a behaviour worth preserving. The `Australia/Lord_Howe` row is a fix on every host: `0.3.2` never produced `01:45 +10:30`, and on three of the five hosts it resolved the `02:15` slot onto the *same instant* as the `01:15` slot, so deduplication silently dropped one of the day's two occurrences.

DST slots are not the only place `0.4.0` moves an instant relative to `0.3.2` — see [Instants that moved](#instants-that-moved) for the full, measured list.

### Testing across host timezones

Three tiers, all driven by `scripts/tz-sweep.ts` (which must be committed for CI to run them):

| Command | Covers |
| --- | --- |
| `pnpm test:tz` | UTC, Pacific/Auckland, America/Los_Angeles — the PR gate |
| `pnpm test:tz:danger` | plus the 12 zones that have historically broken this library (spring-forward at local midnight, sub-hour offsets, southern-hemisphere and non-Sunday transitions) |
| `pnpm test:tz:all` | one representative per distinct 2024-2026 DST schedule — **68 classes**, re-measured for this revision with `pnpm test:tz:offsets` on Node v22.14.0 / ICU 76.1 / tzdata 2024b (that command also reports `legacyClassCount`, 60). Costs 69 full vitest runs (68 classes plus the UTC reference). No wall-clock figure is quoted on purpose — every one previously written down went stale the next time the suite grew; measure it when you need it and record the machine alongside it |

The sweep refuses to report a pass over work it did not do: it requires the UTC reference run to match `scripts/expected-tests.json` **exactly**, per file and in total, in both directions (regenerate it with `pnpm test:tz:manifest`); it compares every other zone's collected tests against that reference run; it fails on skipped tests and on a run that exits non-zero while reporting no failures; and it makes each vitest **worker** report the timezone it actually resolved, so a run that executes under the wrong zone cannot be counted. See [CONTRIBUTING.md](CONTRIBUTING.md#timezone-testing).

### `QuickurrenceMerge`

Merge multiple recurrence rules into a single sorted sequence.

```typescript
import { Quickurrence, QuickurrenceMerge } from 'quickurrence';

const rule1 = new Quickurrence({ rule: 'weekly', startDate: new Date(), weekDays: [1] });
const rule2 = new Quickurrence({ rule: 'weekly', startDate: new Date(), weekDays: [4] });

const merged = new QuickurrenceMerge([rule1, rule2]);

// Union: all Monday + Thursday dates within a range (deduplicated, sorted,
// then capped at 1000 for the merged result as a whole - not 1000 per rule)
const union = merged.getAllOccurrences({
  start: new Date('2026-01-01'),
  end: new Date('2026-03-31'),
});

// Intersection: dates common to ALL merged rules within the range
const common = merged.getCommonOccurrences({
  start: new Date('2026-01-01'),
  end: new Date('2026-03-31'),
});

// The single earliest next occurrence across all merged rules
const nextMerged = merged.getNextOccurrence(new Date('2026-01-01'));
```

`QuickurrenceMerge` also mirrors several accessors (`getStartDate`, `getEndDate`, `getCount`, `getExcludeDates`, `getRuleCount`, `getRules`), alongside `getNextOccurrence`, `getAllOccurrences` and `getCommonOccurrences`.

Rule-specific accessors have no single meaning across merged rules, and **they fail in two different ways** — do not write one `catch` for both. Measured on a two-rule merge, the full inventory:

| Accessor | On `QuickurrenceMerge` |
| --- | --- |
| `getRule`, `getOptions`, `getWeekStartsOn`, `getWeekDays`, `getMonthDay`, `getMonthDayMode`, `getNthWeekdayOfMonth`, `getCondition`, `getPreset` | **defined, and throw** a `QuickurrenceError` with code `UNSUPPORTED_FOR_MERGED_RULES` (9 of them) |
| `getTimesOfDay`, `toHumanText` | **not defined at all** — `typeof merged.getTimesOfDay === 'undefined'`, so calling one throws a raw `TypeError` (`… is not a function`), with no `code`, no `type` and no `context`, and `error instanceof QuickurrenceError` is `false` |

So `catch (e) { if (e instanceof QuickurrenceError) … }` handles the first nine and lets a bare `TypeError` fall straight through for the last two. TypeScript does catch this ahead of time — `getTimesOfDay` and `toHumanText` are absent from the declared `QuickurrenceMerge` in `dist/index.d.ts`, so a typed call is a compile error — but plain-JS consumers, and anything reaching the instance through `any`, get only the runtime `TypeError`. Call the accessor on a member of `merged.getRules()` instead.

### `QuickurrenceValidator`

Validates `QuickurrenceOptions` and provides detailed error messages.

```typescript
import { QuickurrenceValidator } from 'quickurrence';

QuickurrenceValidator.validateOptions({
  rule: 'weekly',
  startDate: new Date(),
  weekDays: [1, 3, 5],
});
```

### Exported Types

```typescript
import type {
  RecurrenceRule,
  Preset,
  DateRange,
  WeekStartsOn,
  WeekDay,
  MonthDay,
  MonthDayMode,
  NthWeekdayOfMonth,
  NthWeekdayConfig,
  Condition,
  ZonedParts,
  TimeOfDay,
  TimesOfDay,
  QuickurrenceOptions,
  QuickurrenceErrorContext,
} from 'quickurrence';
```

### Exported Zod Schemas

```typescript
import {
  RecurrenceRuleSchema,
  DateRangeSchema,
  WeekStartsOnSchema,
  WeekDaySchema,
  MonthDaySchema,
  NthWeekdayOfMonthSchema,
  CountSchema,
  IntervalSchema,
  TimeOfDaySchema,
  TimesOfDaySchema,
  QuickurrenceOptionsSchema,
} from 'quickurrence';
```

Two things about `QuickurrenceOptionsSchema` that will bite you if you assume otherwise.

**It strips, it does not reject.** The object schema is in zod's default `strip` mode, so unknown keys are silently dropped rather than flagged. Measured: `QuickurrenceOptionsSchema.parse({ rule: 'daily', timezone: 'UTC', bogusKey: 42, anotherTypo: 'x' })` succeeds and returns `{ rule: 'daily', timezone: 'UTC' }`. A misspelled option therefore round-trips as *no* option. This matters most when you store rules as JSON and re-parse them: `parse()` is not a safe integrity check on stored data. If you need one, call `.strict()` on the schema yourself before parsing.

**It is a shape check, not an admissibility check.** "The schema accepted it" does **not** mean "the constructor will accept it". Every row below passes `QuickurrenceOptionsSchema.safeParse` and then throws from `new Quickurrence(...)`:

| Options | Constructor error code |
| --- | --- |
| `{ timezone: 'Not/AZone' }` (any unknown IANA name) | `INVALID_TIMEZONE` |
| `endDate` earlier than `startDate` | `DATE_BEFORE_START` |
| `count` together with `endDate` | `CONFLICTING_OPTIONS` |
| `monthDay` together with `nthWeekdayOfMonth` | `CONFLICTING_OPTIONS` |
| `preset` together with `condition` | `CONFLICTING_OPTIONS` |
| `weekDays` on a non-`weekly` rule | `INCOMPATIBLE_OPTIONS` |
| `monthDay` on a non-`monthly` rule | `INCOMPATIBLE_OPTIONS` |

Per-field range violations *are* caught by the schema — `interval: 0`, for instance, fails `safeParse` and never reaches the constructor. It is the cross-field rules and the timezone identifier that the schema cannot see. Use `QuickurrenceValidator.validateOptions(...)` or the constructor itself when you need the real answer.

## Advanced Examples

### Nth Weekday of Month

```typescript
// Second Tuesday of every month
const rule = new Quickurrence({
  rule: 'monthly',
  startDate: new Date('2026-01-01'),
  timezone: 'America/New_York',
  nthWeekdayOfMonth: { weekday: 2, nth: 2 },
});

// Last Friday of every month
const lastFriday = new Quickurrence({
  rule: 'monthly',
  startDate: new Date('2026-01-01'),
  timezone: 'America/New_York',
  nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
});
```

### Multiple Times Per Day

```typescript
// Every Monday and Wednesday at 09:00 and 14:30 (Warsaw wall-clock)
const rule = new Quickurrence({
  rule: 'weekly',
  weekDays: [1, 3],
  startDate: new Date('2026-01-05'),
  timezone: 'Europe/Warsaw',
  timesOfDay: ['09:00', '14:30'],
});

// Each datetime counts as one occurrence — `count: 5` returns 5 datetimes,
// not 5 days. `endDate` and `excludeDates` are matched as exact datetimes
// when `timesOfDay` is set. Wall-clock time is preserved across DST for any
// slot that exists on the day in question — measured, a Warsaw 09:00 slot is
// 09:00 +01:00 on Mar 28 2026 and 09:00 +02:00 on Mar 29. A slot that names a
// wall clock the zone skips or repeats is a different matter: see
// "Wall clocks that do not exist, or exist twice".

// Because `endDate` is an exact instant here, a start-of-day `endDate` would
// cut the rule off before that day's slots. Reach the end of Jan 15 with an
// explicit-offset instant (never startOfDay/endOfDay — those read the host):
//   endDate: new Date('2026-01-15T23:59:59.999+01:00')
// See "Range & end-date boundaries" for the full comparison table.
```

### Custom Conditions

A `condition` predicate is called as `(date: Date, parts: ZonedParts) => boolean`, and it is a **day** filter:

- **`date`** — the candidate **day's `00:00` in the RULE timezone**, as a plain `Date`. It is *not* the occurrence's own time of day. Its own accessors (`getDate()`, `getDay()`, `getHours()`, …) report the **HOST** timezone, not the rule timezone. Use it for epoch comparisons.
- **`parts`** — that same midnight's wall-clock fields in the **RULE** timezone: `{ year, month, day, weekday, hour, minute, second, ms }`. `month` is 0-based (0 = January) and `weekday` is 0-based from Sunday, matching `Date`'s own getters. Because the instant is always a day boundary, `hour`, `minute`, `second` and `ms` are always `0`. Use it for anything calendar-shaped.

**Granularity with `timesOfDay`: the predicate runs once per candidate day, never once per slot.** Slot expansion happens *after* filtering. Measured on a Warsaw `daily` rule with `timesOfDay: ['09:00', '14:30', '23:15']` over Jan 5-7 2026: the predicate is invoked **3 times** (once per day, each with `date` at Warsaw `00:00:00` and `parts.hour === 0`) and 9 occurrences come back. Two consequences:

- rejecting a day drops **all** of its slots — `condition: (_d, parts) => parts.day !== 6` over that range returns Jan 5 09:00, Jan 5 14:30, Jan 7 09:00, Jan 7 14:30 and nothing on Jan 6;
- you **cannot** select among a day's slots from the condition. `condition: (_d, parts) => parts.hour === 9` returns **zero** occurrences, because `parts.hour` is `0` on every invocation. To fire on some times and not others, narrow `timesOfDay` itself, or build one rule per slot and merge them.

> ⚠️ **Do not branch on `date.getDay()` / `date.getDate()` / `date.getHours()` inside a condition.** They are host-relative, so the rule's behaviour follows the machine's `TZ`. Measured on an `Asia/Tokyo` daily rule with `condition: (date) => date.getDay() !== 0` over Jan 1 → Feb 1 2026 (Tokyo): on a `Pacific/Auckland` host it excludes Tokyo Sundays (Jan 4, 11, 18, 25 and Feb 1) and returns 27 dates, but on a `UTC` or `America/Los_Angeles` host it excludes Tokyo **Mondays** (Jan 5, 12, 19, 26) and returns 28. Use `parts.weekday` and the rule zone is guaranteed on every host.

The library **never calls your predicate in order to validate it.** `QuickurrenceOptionsSchema` in `0.3.2` used to invoke it once on a fabricated `2025-01-01` date to check that it returned a boolean; measured, that rejected a legitimate predicate with a bounded domain (one that throws outside the years it knows about) and fired any side effect the predicate had. As of `0.4.0` the schema is a shape check only — measured, `safeParse` invokes the predicate **0** times, accepts the bounded-domain predicate, and fires no side effects. The constructor and `QuickurrenceValidator.validateOptions` never invoked it in either version.

```typescript
// Recommended: branch on `parts`, which always describes the rule timezone
const rule = new Quickurrence({
  rule: 'daily',
  startDate: new Date('2026-01-01T00:00:00.000-05:00'),
  timezone: 'America/New_York',
  // Skip the 1st and the 15th of each month, New York calendar
  condition: (_date, parts) => parts.day !== 1 && parts.day !== 15,
});

// Epoch comparisons are safe on `date` — an instant is an instant
const holidays = [
  new Date('2026-12-25T00:00:00.000-05:00'),
  new Date('2026-01-01T00:00:00.000-05:00'),
];

const withoutHolidays = new Quickurrence({
  rule: 'daily',
  startDate: new Date('2026-01-01T00:00:00.000-05:00'),
  timezone: 'America/New_York',
  condition: (date) => !holidays.some((h) => h.getTime() === date.getTime()),
});
```

### With Date Range

```typescript
const rule = new Quickurrence({
  rule: 'weekly',
  startDate: new Date('2026-01-01'),
  timezone: 'Europe/Berlin',
  weekDays: [1, 3, 5],
});

const dates = rule.getAllOccurrences({
  start: new Date('2026-02-01'),
  end: new Date('2026-02-28'),
});
```

## Error Handling

Quickurrence provides structured errors with error codes for programmatic handling:

```typescript
import {
  QuickurrenceError,
  QuickurrenceErrorCode,
  QuickurrenceErrorType,
} from 'quickurrence';

try {
  new Quickurrence({ rule: 'weekly', startDate: new Date(), weekDays: [] });
} catch (error) {
  if (error instanceof QuickurrenceError) {
    console.log(error.code);    // QuickurrenceErrorCode.EMPTY_REQUIRED_ARRAY
    console.log(error.type);    // QuickurrenceErrorType.VALIDATION
    console.log(error.context); // { option: 'weekDays', ... }
  }
}
```

## Migration to 0.4.0

`0.4.0` is a **breaking** release, in two independent ways. It changes the **class** of the returned value for every rule — that part affects everyone. It also **corrects the instants** for some rule families, because `0.3.2` computed them through the host's wall clock and got host-dependent, wrong answers. Read [Instants that moved](#instants-that-moved) and check your stored data against it; do not assume a re-run will reproduce what you have on file.

### What changed

1. **Every public value is now a plain `Date`.** Measured against `0.3.2` (`Europe/Warsaw` rule, UTC host), a `@date-fns/tz` `TZDate` came out of:
   - `getNextOccurrence` on its **normal** path, for `daily` rules, `weekly` rules without `weekDays`, `monthly` rules without `monthDay`/`nthWeekdayOfMonth`, and `yearly` rules — in each case **only when `count` is unset**. Setting `count` made the result a plain `Date` for **all four** families, not just `yearly`; that is measured for `daily`, `weekly`, `monthly` and `yearly` alike.
   - the `after < startDate` **early-return** path, for **every** shape measured — all seven of `daily`, bare `weekly`, `weekly` + `weekDays`, bare `monthly`, `monthly` + `monthDay`, `monthly` + `nthWeekdayOfMonth`, `yearly`. That includes shapes whose normal path already returned a plain `Date`, so `weekly` + `weekDays` and the two named `monthly` shapes could hand back **different classes from two calls on the same instance**.
   - **both** occurrence methods, for *any* rule with `timesOfDay`.
   - `QuickurrenceMerge.getNextOccurrence`, which passed it straight through.
   - `QuickurrenceMerge.getCommonOccurrences` on a **single-rule** merge with `timesOfDay` — measured, every one of the 14 such shapes leaked (7 rule shapes × 2 slot sets), while the same rules in a two-rule merge returned plain `Date`s. So the class depended on how many rules you merged.
   - `Quickurrence.update()`, whose returned `startDate` was a `TZDate` in **70 of 70** measured shapes. This is public API — it is listed among the static helpers — and it serialised as `"2026-01-01T00:00:00.000+00:00"` rather than `"…Z"`, so anything that persisted an updated options object stored a different string.

   All of those now return plain `Date`s — measured, 0 leaks across every shape above. `getAllOccurrences` on a rule without `timesOfDay`, and `getStartDate()` / `getEndDate()` / `getExcludeDates()`, already returned plain `Date`s in `0.3.2` and are unchanged. See [Reading returned dates](#reading-returned-dates).
2. **`condition` is now `(date: Date, parts: ZonedParts) => boolean`.** `ZonedParts` is newly exported. `date` is now the candidate day's midnight in the rule zone — see [The `condition` change](#the-condition-change--read-this-one-carefully).
3. **`date-fns` and `@date-fns/tz` are no longer peer dependencies.** `zod` is the only one left, and its range is now `>=4.0.0` (see [Installation](#installation) for why `>=3.0.0` was wrong).
4. **Some rules now produce different instants.** See below.
5. **Several inputs that used to be coerced or waved through are now coded errors.** See [Stricter inputs](#stricter-inputs).

### Instants that moved

`0.3.2` routed part of its wall-clock arithmetic through the host machine's own calendar, so for some rule shapes the answer depended on the `TZ` of the machine that ran it. `0.4.0` computes every boundary through `Intl` in the rule's zone and is host-independent.

The sweep: 3402 cases (rule shape × rule timezone × `startDate` × range, over 9 rule zones including `UTC`, `America/Havana`, `Europe/Warsaw`, `Australia/Lord_Howe`, `Pacific/Chatham` and `America/Santiago`), each replayed on 5 host zones (`UTC`, `America/Los_Angeles`, `Pacific/Auckland`, `Asia/Kathmandu`, `Pacific/Kiritimati`).

- **`0.4.0` produced the same epochs on all 5 hosts in 3402 of 3402 cases.** `0.3.2` produced host-dependent epochs in **1225**.
- `0.3.2` and `0.4.0` disagree on at least one host in exactly those same 1225 cases — the sets are identical. Every divergence is a case where `0.3.2` was host-dependent, which means at most one host was ever getting the right answer.
- At the level of individual returned instants: on a `UTC` host **2,792 of 73,327** differ, on `America/Los_Angeles` **10,578 of 78,637**, on `Pacific/Auckland` **6,338 of 76,004**.

Where the changes are, by rule family (cases that differ / cases tested):

| Family | Diverges | Family | Diverges |
| --- | --- | --- | --- |
| `monthly` + `monthDay` | 392 / 648 | `monthly` + `nthWeekdayOfMonth` | 390 / 972 |
| `monthly` + `monthDay` + `timesOfDay` | 147 / 243 | `monthly` + `nthWeekdayOfMonth` + `timesOfDay` | 147 / 243 |
| `daily` + `timesOfDay` | 105 / 243 | `daily` (day-level) | 16 / 162 |
| `weekly` (day-level) | 16 / 243 | `preset` (`businessDays`/`weekends`) | 12 / 162 |
| `monthly` (bare) | **0** † / 81 | `yearly` | **0** † / 162 |
| `weekly` + `weekDays` + `timesOfDay` | **0** † / 243 | | |

> † **A zero in this table does not mean "this family is safe."** It means the sweep's own inputs did not move it, and the sweep's `startDate` values never land in a DST gap. There is one input class that moves the series in **every** family, all three zeros above included: a **`startDate` whose local midnight does not exist in the rule zone**. `startDate` is normalised to the start of its day in the rule zone, and `0.3.2` computed that boundary through the host calendar, so on the wrong host it normalised to the *previous* day — after which every occurrence the rule ever emits is shifted, whatever the family.
>
> Re-measured for this release with `{ rule, timezone: 'America/Havana', startDate: new Date('2026-03-08T05:30:00Z') }` — Havana skips its local midnight on 2026-03-08, so `00:00` does not exist that day. `0.4.0` gives the same epochs on all five hosts; `0.3.2` agrees on four of them and diverges on `America/Los_Angeles`:
>
> | Family | `0.3.2`, `America/Los_Angeles` host | `0.4.0`, all five hosts |
> | --- | --- | --- |
> | `yearly` | start `2026-03-08T04:00:00Z`; **all 11** occurrences shift with it | start `2026-03-08T05:00:00Z` |
> | `monthly` (bare) | start `2026-03-08T04:00:00Z`; **all 123** occurrences shift | start `2026-03-08T05:00:00Z` |
> | `weekly` + `weekDays: [0, 3]` + `timesOfDay: ['09:00', '14:30']` | **12** occurrences — Mar 8's two slots are missing outright | **14** occurrences |
>
> (Occurrence counts over `2026-01-01T00:00:00Z` → `2036-06-01T00:00:00Z` for the first two rows and over March 2026 for the third.)
>
> This is the same start-date normalisation the **third worked example** below describes. That example is written with a `daily` rule, and the sweep's own inputs only ever tripped the class in its day-level `daily`, `weekly` and `preset` rows — but the cause sits in `startDate` normalisation, which every family shares, so the class is **cross-cutting** rather than tied to those rows. It needs the rule zone's *midnight* to fall inside the gap, so it fires in zones such as `America/Havana` and `America/Santiago` and not in zones whose transition is at 02:00: measured, the same probe on `Europe/Warsaw` (`2026-03-29T01:30:00Z`) and `America/New_York` (`2026-03-08T07:30:00Z`) gives identical epochs in both versions on every host.

The day-level `daily`/`weekly`/`preset` divergences are not spread out: every one of them is in `America/Havana` or `America/Santiago`. Those are the two zones in the sweep whose DST transition falls at local midnight, so the day marker itself is the thing that has no unambiguous value — see the third worked example below.

An independent check that `0.4.0` is the correct side of these, using `Intl.DateTimeFormat` and never consulting the library:

- **`monthDay`:** across 9 rule zones × `monthDay` ∈ {1, 10, 15, 28} over 2026, `0.4.0` landed on the requested day-of-month in **420 of 420** occurrences, on every host. `0.3.2` was wrong in **132 of 400** on a `UTC` host and **320 of 412** on a `Pacific/Auckland` host (and, by coincidence of offset, 0 of 400 on `America/Los_Angeles`).
- **`nthWeekdayOfMonth`:** 740 occurrences across 7 rule zones × `nth` ∈ {1, 2, `last`} × 3 weekdays over 2026. All 740 fall on the right weekday and the right nth-of-month. 738 are at `00:00` local; the 2 exceptions are at `01:00` local, on `America/Havana` 2026-03-08 and `America/Santiago` 2026-09-06 — days whose local midnight does not exist, so `01:00` is the first instant of the day and is correct.

Three concrete cases to check your own data against:

```typescript
// 1. Last Saturday of the month, Havana. Jan 31 2026 IS the last Saturday.
new Quickurrence({
  rule: 'monthly',
  nthWeekdayOfMonth: { weekday: 6, nth: 'last' },
  timezone: 'America/Havana',
  startDate: new Date('2025-12-31T23:30:00Z'),
}).getAllOccurrences({
  start: new Date('2026-01-01T00:00:00Z'),
  end: new Date('2026-04-20T00:00:00Z'),
});
// 0.3.2: Sat Jan 24 on UTC / Auckland / Kathmandu / Kiritimati hosts,
//        Sat Jan 31 on an America/Los_Angeles host.  (and Feb 21 vs Feb 28)
// 0.4.0: Sat Jan 31, Sat Feb 28, Sat Mar 28 — epochs 1769835600000,
//        1772254800000, 1774670400000 — identical on all five hosts.
```

```typescript
// 2. A 30-minute DST shift: Australia/Lord_Howe, 2026-10-04.
new Quickurrence({
  rule: 'daily',
  timezone: 'Australia/Lord_Howe',
  timesOfDay: ['01:15', '02:15'],
  startDate: new Date('2026-10-01T00:00:00Z'),
});
// 0.3.2, UTC / LA / Kathmandu hosts: the 02:15 slot resolved onto the SAME
//        instant as 01:15 (1791038700000), so Oct 4 emitted ONE occurrence
//        instead of two — a silently lost occurrence, not a shifted one.
// 0.3.2, Auckland / Kiritimati hosts: 02:45 +11:00 (1791042300000).
// 0.4.0, every host: 01:15 +10:30 and 01:45 +10:30 — two distinct occurrences.
```

```typescript
// 3. A startDate that falls in a DST gap.
new Quickurrence({
  rule: 'daily',
  timezone: 'America/Havana',
  startDate: new Date('2026-03-08T05:30:00Z'),
}).getStartDate();
// 0.3.2 on an America/Los_Angeles host: 2026-03-07 23:00 −05:00 (1772942400000)
//        — the previous day. On the other four hosts it agreed with 0.4.0.
// 0.4.0 on every host: 2026-03-08 01:00 −04:00 (1772946000000), the first
//        instant of Mar 8 that exists in Havana.
//
// `rule: 'daily'` here is incidental. Re-measured, the same startDate produces
// the same 1772942400000 / 1772946000000 split for 'yearly', bare 'monthly',
// 'weekly' + weekDays + timesOfDay and the rest — see the † note above.
```

If you have persisted occurrence lists generated by `0.3.2` for a `monthly` rule with `monthDay` or `nthWeekdayOfMonth` in a non-UTC zone, for any rule in a midnight-transition zone such as `America/Havana` or `America/Santiago`, or for `timesOfDay` slots inside a DST transition, regenerate them and diff.

The remaining three families — `yearly`, bare `monthly`, and `weekly` + `weekDays` + `timesOfDay` — did not move in any of the 3402 × 5 measurements, **but that is a statement about the sweep's inputs, not a clean bill of health**. Regenerate and diff those too if your `startDate` sits in a DST gap in a midnight-transition zone: as the † note under the table above records, all three of them move under `{ timezone: 'America/Havana', startDate: new Date('2026-03-08T05:30:00Z') }` on an `America/Los_Angeles` host. The safe reading of a zero is "no sweep input moved it", and the reliable rule is the one in the third worked example: if `0.3.2` could not name the first instant of your `startDate`'s day, nothing downstream of it is trustworthy.

### Stricter inputs

Measured `0.3.2` → `0.4.0`, on the constructor:

| Input | `0.3.2` | `0.4.0` |
| --- | --- | --- |
| `startDate` given as a string (`'2026-01-15T00:00:00'`) | silently coerced via `new Date(...)` | throws `QuickurrenceError` / `INVALID_START_DATE` |
| `startDate` given as a number (epoch ms) | silently coerced | throws `QuickurrenceError` / `INVALID_START_DATE` |
| unknown `preset` (e.g. `'holidays'`) | bare `Error` (`Unknown preset: holidays`), no `code`, no `type`, no `context` | `QuickurrenceError` / `UNSUPPORTED_PRESET` |
| `weekDays: ['1']` (strings) | accepted | `QuickurrenceError` / `INVALID_WEEKDAYS` |
| `weekDays: [1.5]` | accepted | `QuickurrenceError` / `INVALID_WEEKDAYS` |
| `nthWeekdayOfMonth: { nth: 'last' }` with no `weekday` | accepted | `QuickurrenceError` / `INVALID_NTH_WEEKDAY` |

The coercion is **not** coming back. `new Date('2026-01-15T00:00:00')` is parsed in the host timezone, so accepting a string would have made the rule's own `startDate` host-dependent — the exact class of bug the rest of this release removes. Construct the `Date` yourself, with an explicit offset: `new Date('2026-01-15T00:00:00.000+01:00')`. This is a real break for plain-JS consumers, who had no type error telling them the field was a `Date`.

Already strict in `0.3.2` and unchanged: `endDate` as a string (`INVALID_END_DATE`), `excludeDates` as strings (`INVALID_EXCLUDE_DATES`), `weekDays: [7]` and out-of-range `nthWeekdayOfMonth` (`INVALID_WEEKDAYS` / `INVALID_NTH_WEEKDAY`).

**`Quickurrence.update()` now round-trips `weekStartsOn`.** Measured, `0.3.2` dropped it: updating `{ rule: 'weekly', weekStartsOn: 0, weekDays: [1] }` returned an object with no `weekStartsOn` key at all, so feeding the result back into `new Quickurrence(...)` silently reverted to the default (`1` = Monday). `0.4.0` preserves it. (`monthDayMode` round-tripped correctly in both versions — no change there.)

### Are you affected?

**Epoch-only code is unaffected by the class change**, though see [Instants that moved](#instants-that-moved) for whether the epoch itself is the same one:

- `getTime()`, `valueOf()`, `<` / `>` / `-` between returned dates, `Math.min`/`Math.max`, sorting;
- storing the value as a number, or passing it straight back into another Quickurrence call;
- in tests, `expect(...).toEqual(...)` — vitest compares `Date`s by epoch and ignores the class. Verified with vitest 3.2.4: `expect(new Date(e)).toEqual(new TZDate(e, 'Europe/Warsaw'))` passes in both directions, and so does `expect([new Date(e)]).toEqual([new TZDate(e, 'Europe/Warsaw')])`.

**You are affected by the class change** if any of these appear against a Quickurrence return value. Grep for them:

```bash
# 1. calendar getters and every rendering that goes through the object's own zone
grep -rnE '\.(toISOString|toJSON|toString|toDateString|toTimeString|toLocaleString|toLocaleDateString|toLocaleTimeString)\(|\.get(Day|Date|Month|FullYear|Hours|Minutes|Seconds|Milliseconds|TimezoneOffset)\(' src/

# 2. implicit stringification: template interpolation and JSON.stringify
grep -rnE 'JSON\.stringify\(|\$\{[^}]*\}' src/

# 3. class identity and class-sensitive assertions
grep -rnE 'instanceof[[:space:]]+TZDate|\.constructor\.name|toStrictEqual' src/

# 4. condition callbacks (matches `condition:` and `condition :` alike)
grep -rnE 'condition[[:space:]]*:' src/
```

Verified against a file containing only the affected forms: pattern 1 matches all of `toString()`, `toJSON()`, `toLocaleString()`, `toLocaleDateString()`, `toLocaleTimeString()`, `toDateString()`, `toTimeString()`, `getSeconds()`, `getMilliseconds()`, `getTimezoneOffset()` as well as the seven the previous version of this list already caught; pattern 4 matches `condition : (date) => …` as well as `condition:` and `condition:false`. Pattern 2 is deliberately broad — every template literal — because implicit `toString()` leaves no textual marker; expect to skim its hits.

- **`toISOString()` / `toString()` / `toJSON()` / `toLocaleString()` / template interpolation.** A `TZDate` rendered in the rule zone (`2026-01-15T00:00:00.000+01:00`, and even `…+00:00` for a UTC rule); a plain `Date` renders the same instant as `2026-01-14T23:00:00.000Z`. Stored strings, snapshots and API payloads change shape.
- **Calendar getters** (`getDay`, `getDate`, `getHours`, `getSeconds`, `getTimezoneOffset`, …). On a `TZDate` these read the **rule** zone; on a plain `Date` they read the **host** zone. This is a silent behaviour change on any host that is not the rule zone.
- **`instanceof TZDate` / `constructor.name` checks** — now always `Date`. Measured on this build, `occurrence.constructor.name` is `'Date'`.

  > ⚠️ **`.constructor.name` is only trustworthy on the *dates*, not on the *errors*.** If pattern 3 above turns up a `.constructor.name` check against a `QuickurrenceError`, do not "fix" it — replace it. Measured on both shipped bundles (`dist/index.js` and `dist/index.cjs`), a thrown error reports `err.constructor.name === '_QuickurrenceError'`, with the leading underscore: esbuild renames a class that references its own binding, and `src/error.ts` does (`Object.setPrototypeOf(this, QuickurrenceError.prototype)`). `err.name` is the correct `'QuickurrenceError'` and `err instanceof QuickurrenceError` is `true`, so use one of those. This is **pre-existing, not a `0.4.0` change** — `src/error.ts` is byte-identical to `0.3.2` (`diff <(git show v0.3.2:src/error.ts) src/error.ts` is empty), so the same mangled name came out of the `0.3.2` bundles.
- **`toStrictEqual` in tests** — it *does* compare the class, so a fixture built with `new TZDate(...)` now fails. Switch it to `toEqual`, or build the fixture with `new Date(...)`.
- **`condition` callbacks that use calendar getters** — see below; this one TypeScript will not catch.

### Reading a returned value in the rule zone

```typescript
const [occurrence] = rule.getAllOccurrences(range);

// 0.3.2 — worked only because the value happened to be a TZDate
occurrence.getHours(); // 9 for a Warsaw 09:00 slot

// 0.4.0 — name the zone
new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  hour: '2-digit',
  hourCycle: 'h23',
}).format(occurrence); // '09'

// …or keep using @date-fns/tz if you already depend on it — this still works,
// and reproduces exactly the object 0.3.2 handed you
new TZDate(occurrence, 'Europe/Warsaw').getHours(); // 9
```

### The `condition` change — read this one carefully

⚠️ **`(date: Date) => boolean` is still assignable to the new signature, so existing consumer code compiles unchanged while `date.getDay()` silently switches from the rule timezone to the host timezone.** TypeScript will not flag it, no test that only checks counts on a UTC CI runner will flag it, and the symptom is occurrences filtered on the wrong calendar day. This is the most dangerous item in the release: it type-checks, it usually returns a plausible-looking list, and the list is wrong.

**Do not use the count as your check — it often does not move.** Measured on an `Asia/Tokyo` daily rule, `condition: (date) => date.getDay() !== 0`:

| Range (Tokyo) | `UTC` host | `Pacific/Auckland` host | `America/Los_Angeles` host |
| --- | --- | --- | --- |
| Jan 1 → **Jan 31** | 27 dates, drops Jan **5, 12, 19, 26** | 27 dates, drops Jan **4, 11, 18, 25** | 27 dates, drops Jan **5, 12, 19, 26** |
| Jan 1 → **Feb 1** | 28 dates, drops Jan **5, 12, 19, 26** | 27 dates, drops Jan **4, 11, 18, 25** and Feb 1 | 28 dates, drops Jan **5, 12, 19, 26** |

Over a literal January the counts are **identical on every host** and the bug is invisible to a count assertion — yet `UTC` and `Los_Angeles` are dropping Tokyo *Mondays* while `Auckland` drops Tokyo *Sundays*. Only when the range runs through Feb 1 (a Sunday) does the count split 28 / 27. The correct predicate, `(_d, parts) => parts.weekday !== 0`, returns 27 dates dropping Jan 4, 11, 18, 25 over the literal January range, and 27 dropping those plus Feb 1 over the longer one — identically on all three hosts.

A blunter illustration of the same failure, where the counts *never* move: an unchanged `condition: (date) => date.getDate() % 2 === 1` on a `Europe/Warsaw` daily rule over 2024 keeps **187** days on every host — but on a `UTC` or `America/Los_Angeles` host **179 of those 187 are different days** from the ones `(_d, parts) => parts.day % 2 === 1` emits. (On a `Pacific/Auckland` host, whose offset happens to put Warsaw midnight on the same host date, the two agree exactly — which is how this survives a green CI run on the wrong runner.)

What did **not** change is the granularity or the instant `date` denotes. Measured on `0.3.2`, the predicate was already invoked once per candidate day (3 invocations for a 3-day, 3-slot `timesOfDay` range that yields 9 occurrences), and `date` was already that day's midnight in the rule zone. The single difference is that it arrived as a `TZDate`, whose getters read the rule zone, and now arrives as a plain `Date`, whose getters read the host.

```typescript
// BEFORE (0.3.2) — read the rule timezone, because `date` was a TZDate
condition: (date) => date.getDay() !== 0 && date.getDate() !== 1;

// AFTER (0.4.0) — read the rule timezone explicitly, from `parts`
condition: (_date, parts) => parts.weekday !== 0 && parts.day !== 1;
```

Epoch-only conditions need no change:

```typescript
// Unaffected in both versions
condition: (date) => !holidays.some((h) => h.getTime() === date.getTime());
```

### Dependencies

If you installed `date-fns` and/or `@date-fns/tz` **only** because Quickurrence required them, you can drop both. `dist/index.js` now contains exactly one import statement, `import { z } from "zod"`. If your own code uses them, nothing changes — they work on Quickurrence's return values as described above.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE)
