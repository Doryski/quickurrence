# Quickurrence

[![npm version](https://img.shields.io/npm/v/quickurrence.svg)](https://www.npmjs.com/package/quickurrence)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

A powerful, type-safe recurrence rule engine for TypeScript. Generate recurring dates with full timezone support, built on [date-fns](https://date-fns.org/) and [Zod](https://zod.dev/).

## Why Quickurrence?

- **Type-safe**: Full TypeScript support with exported types and Zod schemas for runtime validation
- **Timezone-aware**: Built-in timezone handling via `@date-fns/tz`
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

## Quick Start

```typescript
import { Quickurrence } from 'quickurrence';

// Every day starting from a date
const daily = new Quickurrence({
  rule: 'daily',
  startDate: new Date('2026-01-01'),
  timezone: 'America/New_York',
});

const next5Days = daily.getNextOccurrences(5);

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
| `rule` | `'daily' \| 'weekly' \| 'monthly' \| 'yearly'` | Yes | Recurrence frequency |
| `startDate` | `Date` | Yes | Start date for the recurrence |
| `timezone` | `string` | No | IANA timezone identifier |
| `interval` | `number` | No | Interval between occurrences (e.g., every 2 weeks) |
| `endDate` | `Date` | No | End date for the recurrence |
| `count` | `number` | No | Maximum number of occurrences |
| `weekStartsOn` | `Day` (0-6) | No | First day of the week (0 = Sunday) |
| `weekDays` | `Day[]` | No | Days of the week for weekly rules |
| `monthDay` | `MonthDay` (1-31) | No | Day of the month for monthly rules |
| `monthDayMode` | `'skip' \| 'last'` | No | How to handle months without the specified day |
| `nthWeekdayOfMonth` | `NthWeekdayConfig` | No | Nth weekday of month (e.g., 2nd Tuesday) |
| `excludeDates` | `Date[]` | No | Dates to exclude from the recurrence |
| `condition` | `boolean \| ((date: Date) => boolean)` | No | Custom filter condition |
| `preset` | `'businessDays' \| 'weekends'` | No | Predefined day-of-week filters |
| `timesOfDay` | `string[]` (`"HH:MM"`) | No | Times of day to fire on each matching day (24-hour format, e.g. `['09:00', '14:30']`) |

#### Methods

- **`getNextOccurrences(count: number): Date[]`** - Get the next N occurrences
- **`getOccurrencesInRange(range: DateRange): Date[]`** - Get occurrences within a date range
- **`getNextOccurrence(): Date | null`** - Get the next single occurrence
- **`isOccurrence(date: Date): boolean`** - Check if a date matches the recurrence rule

### `QuickurrenceMerge`

Merge multiple recurrence rules into a single sorted sequence.

```typescript
import { Quickurrence, QuickurrenceMerge } from 'quickurrence';

const rule1 = new Quickurrence({ rule: 'weekly', startDate: new Date(), weekDays: [1] });
const rule2 = new Quickurrence({ rule: 'weekly', startDate: new Date(), weekDays: [4] });

const merged = new QuickurrenceMerge([rule1, rule2]);
const dates = merged.getNextOccurrences(10); // Combined Monday + Thursday dates
```

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
  QuickurrenceOptions,
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
// when `timesOfDay` is set. Wall-clock time is preserved across DST.
```

### Custom Conditions

```typescript
// Every day, but only if it's not a holiday
const holidays = [new Date('2026-12-25'), new Date('2026-01-01')];

const rule = new Quickurrence({
  rule: 'daily',
  startDate: new Date('2026-01-01'),
  timezone: 'America/New_York',
  condition: (date) => !holidays.some(h => h.getTime() === date.getTime()),
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

const dates = rule.getOccurrencesInRange({
  start: new Date('2026-02-01'),
  end: new Date('2026-02-28'),
});
```

## Error Handling

Quickurrence provides structured errors with error codes for programmatic handling:

```typescript
import { QuickurrenceError, QuickurrenceErrorCode } from 'quickurrence';

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

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE)
