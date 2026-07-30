import { z } from 'zod';
import { isAfter, isBefore, isEqual } from './compare';
import { QuickurrenceError, QuickurrenceErrorCode } from './error';
import { QuickurrenceValidator } from './validator';
import {
  dayOptions,
  isOneOf,
  MAX_NEXT_OCCURENCES,
  monthDayModeOptions,
  monthDayOptions,
  nthWeekdayOfMonthOptions,
  presetOptions,
  recurrenceRulesOptions,
} from './options';

export { recurrenceRulesOptions };

export type RecurrenceRule = (typeof recurrenceRulesOptions)[number];
export const RecurrenceRuleSchema = z.enum(recurrenceRulesOptions);
const PresetSchema = z.enum(presetOptions);
export type Preset = (typeof presetOptions)[number];
export const DateRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
});
export type DateRange = z.infer<typeof DateRangeSchema>;
type Day = (typeof dayOptions)[number];
// `z.custom<T>(predicate)` is the only form that keeps the literal-union type T
// intact; `z.number().min(0).max(6)` would widen the public types to `number`.
// Without a predicate `z.custom` accepts anything, so every schema below must
// pass one.
export const WeekStartsOnSchema = z.custom<Day>(isOneOf(dayOptions));
export type WeekStartsOn = z.infer<typeof WeekStartsOnSchema>; // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
export const WeekDaySchema = z.custom<Day>(isOneOf(dayOptions));
export type WeekDay = z.infer<typeof WeekDaySchema>; // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
export type MonthDay = (typeof monthDayOptions)[number];
export const MonthDaySchema = z.custom<MonthDay>(isOneOf(monthDayOptions));
const MonthDayModeSchema = z.enum(monthDayModeOptions);
export type MonthDayMode = (typeof monthDayModeOptions)[number];

export type NthWeekdayOfMonth = (typeof nthWeekdayOfMonthOptions)[number];
export const NthWeekdayOfMonthSchema = z.custom<NthWeekdayOfMonth>(
  isOneOf(nthWeekdayOfMonthOptions),
);
const _nthWeekdayConfigSchema = z.object({
  weekday: WeekDaySchema,
  nth: NthWeekdayOfMonthSchema,
});
export type NthWeekdayConfig = z.infer<typeof _nthWeekdayConfigSchema>;

const hasUniqueEntries = (values: readonly unknown[]) =>
  new Set(values).size === values.length;
/**
 * Wall-clock fields of an instant, read in the rule's timezone.
 *
 * Every field describes the rule timezone, never the host timezone, so a
 * condition can branch on the calendar the rule is expressed in.
 *
 * When these parts are handed to a {@link Condition}, the instant is always a
 * candidate DAY's midnight in the rule timezone, so `hour`, `minute`, `second`
 * and `ms` are always `0` there — see {@link Condition} for why.
 */
export type ZonedParts = {
  /** Full year. Years before 1 CE are negative (1 BCE is `0`). */
  year: number;
  /** 0-based, matching `Date.prototype.getMonth`: 0 = January, 11 = December. */
  month: number;
  /** Day of the month, 1-31. */
  day: number;
  /** Day of the week, 0 = Sunday through 6 = Saturday. */
  weekday: number;
  /** Hour, 0-23. Always `0` when supplied to a {@link Condition}. */
  hour: number;
  /** Minute, 0-59. Always `0` when supplied to a {@link Condition}. */
  minute: number;
  /** Second, 0-59. Always `0` when supplied to a {@link Condition}. */
  second: number;
  /** Milliseconds, 0-999. Always `0` when supplied to a {@link Condition}. */
  ms: number;
};

/**
 * A rule-level filter: either a constant, or a predicate run against every
 * candidate DAY the rule produces.
 *
 * The predicate receives two arguments, and both describe a day, not an
 * instant within it:
 * - `date` — the start of the candidate day, at 00:00 in the RULE timezone.
 *   It is NOT the occurrence's own time of day. It is a plain `Date`, so its
 *   own accessors (`getHours()`, `getDay()`, …) report the HOST timezone, not
 *   the rule timezone — read `parts` instead.
 * - `parts` — that same midnight instant's wall-clock fields in the RULE
 *   timezone; see {@link ZonedParts}.
 *
 * Granularity, including with `timesOfDay`: the predicate is invoked ONCE PER
 * CANDIDATE DAY, never once per time-of-day slot. Slot expansion happens after
 * this filter runs, so `parts.hour`, `parts.minute`, `parts.second` and
 * `parts.ms` are always `0` and a condition can only keep or drop a whole day —
 * it cannot select among that day's slots. Rejecting a day drops every slot on
 * it. To filter individual times, narrow `timesOfDay` itself.
 */
export type Condition = boolean | ((date: Date, parts: ZonedParts) => boolean);
// Shape only. Calling the predicate to smoke-test its return value would run
// consumer code during validation: a side-effectful predicate would fire on a
// fabricated date, and one that legitimately throws outside its data range
// would sink an otherwise valid rule.
const ConditionSchema = z.custom<Condition>(
  (val) => typeof val === 'function' || typeof val === 'boolean',
  {
    message:
      'Must be a boolean or a function that accepts a Date and returns a boolean',
  },
);
export const CountSchema = z.number().int().min(1);
export const IntervalSchema = z.number().int().min(1);
export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be "HH:MM" in 24-hour format');
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;
export const TimesOfDaySchema = z
  .array(TimeOfDaySchema)
  .min(1)
  .refine(hasUniqueEntries, { message: 'Must not contain duplicate values' });
export type TimesOfDay = z.infer<typeof TimesOfDaySchema>;
const WeekDaysSchema = z
  .array(WeekDaySchema)
  .min(1)
  .refine(hasUniqueEntries, { message: 'Must not contain duplicate values' });
const ExcludeDatesSchema = z.array(z.date()).min(1);
export const QuickurrenceOptionsSchema = z.object({
  startDate: z.date().optional(),
  rule: RecurrenceRuleSchema.optional(),
  timezone: z.string().optional(),
  interval: IntervalSchema.optional(),
  endDate: z.date().optional(),
  count: CountSchema.optional(),
  weekStartsOn: WeekStartsOnSchema.optional(),
  weekDays: WeekDaysSchema.optional(),
  monthDay: MonthDaySchema.optional(),
  monthDayMode: MonthDayModeSchema.optional(),
  nthWeekdayOfMonth: _nthWeekdayConfigSchema.optional(),
  excludeDates: ExcludeDatesSchema.optional(),
  condition: ConditionSchema.optional(),
  preset: PresetSchema.optional(),
  timesOfDay: TimesOfDaySchema.optional(),
});
export type QuickurrenceOptions = z.infer<typeof QuickurrenceOptionsSchema>;

/**
 * Maps a failing option to the same error code the constructor's validator
 * would raise for it, so a schema rejection is as actionable as a validator
 * rejection.
 */
const _optionErrorCodes = {
  startDate: QuickurrenceErrorCode.INVALID_START_DATE,
  endDate: QuickurrenceErrorCode.INVALID_END_DATE,
  timezone: QuickurrenceErrorCode.INVALID_TIMEZONE,
  interval: QuickurrenceErrorCode.INVALID_INTERVAL,
  count: QuickurrenceErrorCode.INVALID_COUNT,
  weekStartsOn: QuickurrenceErrorCode.INVALID_WEEK_STARTS_ON,
  weekDays: QuickurrenceErrorCode.INVALID_WEEKDAYS,
  monthDay: QuickurrenceErrorCode.INVALID_MONTH_DAY,
  monthDayMode: QuickurrenceErrorCode.INVALID_MONTH_DAY_MODE,
  nthWeekdayOfMonth: QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
  excludeDates: QuickurrenceErrorCode.INVALID_EXCLUDE_DATES,
  condition: QuickurrenceErrorCode.INVALID_CONDITION,
  timesOfDay: QuickurrenceErrorCode.INVALID_TIMES_OF_DAY,
  rule: QuickurrenceErrorCode.UNSUPPORTED_RULE,
  preset: QuickurrenceErrorCode.UNSUPPORTED_PRESET,
} as const;

const MAX_COLLECTION_ITERATIONS = 500_000;
const DAY_MS = 86_400_000;
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export {
  QuickurrenceError,
  QuickurrenceErrorCode,
  QuickurrenceErrorType,
  type QuickurrenceErrorContext,
} from './error';
export { QuickurrenceMerge } from './merge';
export { QuickurrenceValidator } from './validator';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * The primitives below run before `QuickurrenceValidator.validateOptions`
 * (normalizing a start date needs a timezone), and the validator only
 * regex-checks the identifier's shape. Without this wrapper a well-formed but
 * unknown zone would surface as a bare `RangeError` from Intl.
 */
const buildFormatter = (timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      era: 'short',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    throw QuickurrenceError.validation(
      'timezone must be a valid timezone identifier',
      QuickurrenceErrorCode.INVALID_TIMEZONE,
      {
        option: 'timezone',
        value: timeZone,
        expected:
          'Valid IANA timezone identifier (e.g., UTC, America/New_York)',
      },
    );
  }
};

const formatterFor = (timeZone: string) => {
  const cached = formatters.get(timeZone);
  if (cached) {
    return cached;
  }
  const formatter = buildFormatter(timeZone);
  formatters.set(timeZone, formatter);
  return formatter;
};

/**
 * `Date.UTC` remaps years 0-99 onto 1900-1999 (the ECMAScript two-digit-year
 * rule), so every wall-clock-to-epoch conversion goes through here. Shifting an
 * affected year by one full 400-year Gregorian cycle dodges the remap while
 * keeping leap years, month lengths and out-of-range component rollover
 * identical to the unshifted calendar.
 */
const utcInstantFromParts = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
) => {
  if (year < 0 || year > 99) {
    return Date.UTC(year, month, day, hour, minute, second, ms);
  }
  const shifted = new Date(
    Date.UTC(year + 400, month, day, hour, minute, second, ms),
  );
  shifted.setUTCFullYear(shifted.getUTCFullYear() - 400);
  return shifted.getTime();
};

/**
 * Wall-clock parts of `instant` as seen in `timeZone`.
 *
 * Only `Intl.DateTimeFormat` with an explicit `timeZone` is used, so the host
 * timezone is never consulted. That matters because the usual timezone
 * libraries route wall-clock construction through the host's wall clock even
 * when an explicit timezone context is supplied, which leaks the host's DST
 * gaps into results computed for an unrelated rule timezone.
 */
const zonedParts = (instant: number, timeZone: string): ZonedParts => {
  const formatter = formatterFor(timeZone);
  // `formatToParts` throws a bare `RangeError: Invalid time value` on a
  // non-finite instant. Garbage inputs (an Invalid Date in the range, a
  // non-numeric weekDays entry) reach here as NaN after arithmetic, and callers
  // expect them to degrade to an invalid date rather than throw, so NaN is
  // propagated through the parts instead: every downstream comparison then
  // fails and collection yields nothing.
  if (!Number.isFinite(instant)) {
    return {
      year: Number.NaN,
      month: Number.NaN,
      day: Number.NaN,
      hour: Number.NaN,
      minute: Number.NaN,
      second: Number.NaN,
      ms: Number.NaN,
      weekday: Number.NaN,
    };
  }
  const parts = formatter.formatToParts(instant);
  const num = (type: string) =>
    Number(parts.find((part) => part.type === type)!.value);
  const era = parts.find((part) => part.type === 'era')!.value;
  const yearRaw = num('year');
  const weekdayName = parts.find((part) => part.type === 'weekday')!.value;

  return {
    year: era.startsWith('B') ? 1 - yearRaw : yearRaw,
    month: num('month') - 1,
    day: num('day'),
    hour: num('hour'),
    minute: num('minute'),
    second: num('second'),
    // formatToParts truncates to whole seconds, so milliseconds come from the epoch.
    ms: ((instant % 1000) + 1000) % 1000,
    weekday: WEEKDAYS.indexOf(weekdayName as (typeof WEEKDAYS)[number]),
  };
};

/** Offset east of UTC, in ms, that `timeZone` was at `instant`. */
const zoneOffsetMsAt = (instant: number, timeZone: string) => {
  const { year, month, day, hour, minute, second, ms } = zonedParts(
    instant,
    timeZone,
  );
  return (
    utcInstantFromParts(year, month, day, hour, minute, second, ms) - instant
  );
};

/**
 * Resolve a wall clock in `timeZone` to an epoch, by guessing and correcting to
 * a fixed point.
 *
 * For wall clocks that exist exactly once the result is the obvious one. For
 * the rest the rule is mechanical rather than semantic: the offset applied is
 * whichever one `timeZone` is in effect at the instant obtained by reading the
 * requested wall clock as if it were UTC. Which side of a transition that
 * lands on depends on the zone and on the transition's UTC time, so neither
 * "gaps move forward" nor "overlaps pick the later occurrence" holds in
 * general. Measured cases:
 * - spring-forward gap maps *backward* (before the gap) for Europe/Warsaw
 *   2026-03-29 02:30 and Australia/Lord_Howe 2026-10-04 02:15, but *forward*
 *   (after the gap) for America/New_York 2026-03-08 02:30 and America/Havana
 *   2026-03-08 00:30;
 * - fall-back overlap picks the *later* (post-transition) occurrence for
 *   Europe/Warsaw 2026-10-25 02:30, but the *earlier* one for America/New_York
 *   2026-11-01 01:30.
 *
 * The guarantee callers can rely on is only this: the result is stable, host
 * timezone independent, and for an existing wall clock it round-trips.
 *
 * Out-of-range components are normalized like `Date.UTC` does, so callers can
 * do naive component arithmetic (`day + n`, `month + n`) and let this handle
 * rollover.
 */
const zonedWallClockToInstant = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
) => {
  const target = utcInstantFromParts(
    year,
    month,
    day,
    hour,
    minute,
    second,
    ms,
  );
  const firstGuess = target - zoneOffsetMsAt(target, timeZone);
  const secondGuess = target - zoneOffsetMsAt(firstGuess, timeZone);
  if (secondGuess === firstGuess) {
    return firstGuess;
  }
  return target - zoneOffsetMsAt(secondGuess, timeZone);
};

const utcDaysInMonth = (year: number, month: number) =>
  new Date(utcInstantFromParts(year, month + 1, 0)).getUTCDate();

const zonedWallClock = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
) =>
  new Date(
    zonedWallClockToInstant(
      year,
      month,
      day,
      hour,
      minute,
      second,
      ms,
      timeZone,
    ),
  );

/**
 * Start of `date`'s day in `timeZone`. Tolerates unparseable input the way
 * date-fns did — an invalid date in, an invalid date out — because this is the
 * boundary that normalizes caller-supplied start dates before validation.
 */
const zonedStartOfDayIn = (date: Date, timeZone: string) => {
  const instant = new Date(date).getTime();
  if (Number.isNaN(instant)) {
    return new Date(Number.NaN);
  }
  const { year, month, day } = zonedParts(instant, timeZone);
  return zonedWallClock(timeZone, year, month, day);
};

/**
 * Reject a public `Date` parameter that is not a `Date`.
 *
 * The internals compare instants by calling `.getTime()` directly, which is
 * what makes them provably host-timezone independent, but it also means a
 * non-Date argument surfaces as a bare `TypeError` from deep inside. A
 * plain-JS caller (for whom the `Date` type annotation is not enforced) gets a
 * coded error here instead.
 *
 * Strings are rejected, never coerced: `new Date('2026-01-15T00:00:00')` is
 * parsed in the HOST timezone, which is precisely the hazard a rule-timezone
 * engine must not reintroduce. Callers must construct the `Date` themselves so
 * the intended instant is unambiguous.
 *
 * An Invalid Date passes this guard on purpose — it is a `Date`, and the
 * documented behaviour for one is to degrade to an empty result rather than
 * throw.
 */
const assertDateArgument = (
  value: unknown,
  option: string,
  operation: string,
  code: QuickurrenceErrorCode = QuickurrenceErrorCode.INVALID_DATE_RANGE,
) => {
  if (value instanceof Date) {
    return;
  }
  throw QuickurrenceError.validation(
    `${option} must be a Date object`,
    code,
    {
      option,
      value,
      expected: 'Date object (strings are not coerced: build the Date yourself)',
      operation,
    },
  );
};

const assertDateRangeArgument = (range: DateRange, operation: string) => {
  if (range === null || typeof range !== 'object') {
    throw QuickurrenceError.validation(
      'range must be an object with Date start and end properties',
      QuickurrenceErrorCode.INVALID_DATE_RANGE,
      {
        option: 'range',
        value: range,
        expected: '{ start: Date, end: Date }',
        operation,
      },
    );
  }
  assertDateArgument(range.start, 'range.start', operation);
  assertDateArgument(range.end, 'range.end', operation);
};

export class Quickurrence {
  private startDate: Date;
  private rule: RecurrenceRule;
  private timezone: string;
  private interval: number;
  private endDate?: Date;
  private count?: number;
  private weekStartsOn: WeekStartsOn;
  private weekDays?: WeekDay[];
  private monthDay?: MonthDay;
  private monthDayMode: MonthDayMode;
  private nthWeekdayOfMonth?: NthWeekdayConfig;
  private excludeDates?: Date[];
  private condition?: Condition;
  private preset?: Preset;
  private timesOfDay?: string[];
  private options: QuickurrenceOptions;
  private excludeDateTimes?: Set<number>;
  private parsedTimesOfDay?: { hh: number; mm: number }[];

  /**
   * Create or update Quickurrence options from state
   */
  static update(
    quickurrenceOptions: QuickurrenceOptions,
    updates: Partial<QuickurrenceOptions>,
  ): QuickurrenceOptions | null {
    let baseUpdates: Partial<QuickurrenceOptions>;
    if (updates.preset) {
      const presetOptions = Quickurrence.presetToOptions(updates.preset);
      // Preset defines the core rule pattern, user can only override compatible options
      baseUpdates = {
        ...updates,
        ...presetOptions, // Preset options override conflicting user updates
      };
    } else {
      baseUpdates = { ...updates };
    }

    const newOptions = { ...quickurrenceOptions, ...baseUpdates };

    if (newOptions.rule === undefined) {
      return null;
    }

    const cleanedOptions = Quickurrence.clean(newOptions);

    // `||`, not `??`: an empty timezone string must fall back to UTC exactly as
    // the constructor does, otherwise update() rejects an input the constructor
    // accepts and the two entry points disagree.
    const timezone = cleanedOptions.timezone || 'UTC';
    // Same reason as in the constructor: normalization runs before the schema
    // and would coerce a string into a valid Date, hiding a host-timezone parse.
    if (cleanedOptions.startDate !== undefined) {
      assertDateArgument(
        cleanedOptions.startDate,
        'startDate',
        'update',
        QuickurrenceErrorCode.INVALID_START_DATE,
      );
    }
    const defaultStartDate = cleanedOptions.startDate || new Date();
    const updatedStartDate = zonedStartOfDayIn(defaultStartDate, timezone);
    const options: QuickurrenceOptions = {
      startDate: updatedStartDate,
      rule: cleanedOptions.rule,
      timezone,
    };

    // Every option is copied on presence alone. Keeping the output minimal is
    // `clean()`'s job — it has already dropped defaults (interval 1), empty
    // arrays and rule-incompatible fields above — so a value that survives
    // `clean()` is one the caller meant to set and must round-trip. Filtering
    // again on the value here is what silently swallowed legal inputs, and it
    // also hid illegal ones (interval 0, count 0) from the schema below.
    if (cleanedOptions.interval !== undefined) {
      options.interval = cleanedOptions.interval;
    }

    if (cleanedOptions.endDate !== undefined) {
      options.endDate = cleanedOptions.endDate;
    }

    if (cleanedOptions.count !== undefined) {
      options.count = cleanedOptions.count;
    }

    if (cleanedOptions.weekStartsOn !== undefined) {
      options.weekStartsOn = cleanedOptions.weekStartsOn;
    }

    if (cleanedOptions.weekDays !== undefined) {
      options.weekDays = cleanedOptions.weekDays;
    }

    if (cleanedOptions.monthDay !== undefined) {
      options.monthDay = cleanedOptions.monthDay;
    }

    // Independent of monthDay: `{rule: 'monthly', monthDayMode: 'skip'}` is
    // accepted by the constructor, so update() must not drop the mode just
    // because no monthDay accompanies it.
    if (cleanedOptions.monthDayMode !== undefined) {
      options.monthDayMode = cleanedOptions.monthDayMode;
    }

    if (cleanedOptions.nthWeekdayOfMonth !== undefined) {
      options.nthWeekdayOfMonth = cleanedOptions.nthWeekdayOfMonth;
    }

    if (cleanedOptions.excludeDates !== undefined) {
      options.excludeDates = cleanedOptions.excludeDates;
    }

    if (cleanedOptions.preset !== undefined) {
      options.preset = cleanedOptions.preset;
    }

    if (cleanedOptions.condition !== undefined) {
      options.condition = cleanedOptions.condition;
    }

    if (cleanedOptions.timesOfDay !== undefined) {
      options.timesOfDay = [...cleanedOptions.timesOfDay];
    }

    const validationResult = QuickurrenceOptionsSchema.safeParse(options);
    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      const option = String(issues[0]?.path[0] ?? '');
      throw QuickurrenceError.validation(
        `Invalid quickurrence options: ${validationResult.error.message}`,
        _optionErrorCodes[option as keyof typeof _optionErrorCodes] ??
          QuickurrenceErrorCode.UNKNOWN,
        {
          operation: 'update',
          option: option || undefined,
          value: option ? options[option as keyof QuickurrenceOptions] : options,
          details: { issues },
        },
      );
    }

    return validationResult.data;
  }

  constructor(options: QuickurrenceOptions = {}) {
    let baseOptions: QuickurrenceOptions;
    if (options.preset) {
      const presetOptions = Quickurrence.presetToOptions(options.preset);
      // Preset defines the core rule pattern, user can only override compatible options
      baseOptions = {
        ...options,
        ...presetOptions, // Preset options override conflicting user options
      };
    } else {
      baseOptions = { ...options };
    }

    const timezone = baseOptions.timezone || 'UTC';
    // Resolve the zone before it is used to build a date. Without this, an
    // unknown zone first surfaces as a NaN instant while normalizing the start
    // date, and the caller is told the startDate is invalid instead of the
    // timezone.
    formatterFor(timezone);
    // Checked before normalization, not by the validator afterwards: a string
    // start date would otherwise be coerced by the normalizer into a real Date
    // and pass validation, having been parsed in the host timezone.
    if (baseOptions.startDate !== undefined) {
      assertDateArgument(
        baseOptions.startDate,
        'startDate',
        'constructor',
        QuickurrenceErrorCode.INVALID_START_DATE,
      );
    }
    const defaultStartDate = baseOptions.startDate || new Date();
    const defaultRule = baseOptions.rule || 'daily';
    const optionsWithDefaults = {
      ...baseOptions,
      startDate: zonedStartOfDayIn(defaultStartDate, timezone),
      rule: defaultRule,
      timezone,
    };

    QuickurrenceValidator.validateOptions(optionsWithDefaults);

    // Deep copy the original options, handling function conditions specially
    this.options = {
      ...optionsWithDefaults,
      startDate: new Date(defaultStartDate),
      endDate: optionsWithDefaults.endDate
        ? new Date(optionsWithDefaults.endDate)
        : undefined,
      excludeDates: optionsWithDefaults.excludeDates
        ? optionsWithDefaults.excludeDates.map((date) => new Date(date))
        : undefined,
      nthWeekdayOfMonth: optionsWithDefaults.nthWeekdayOfMonth
        ? { ...optionsWithDefaults.nthWeekdayOfMonth }
        : undefined,
      weekDays: optionsWithDefaults.weekDays
        ? [...optionsWithDefaults.weekDays]
        : undefined,
      timesOfDay: optionsWithDefaults.timesOfDay
        ? [...optionsWithDefaults.timesOfDay]
        : undefined,
      // condition is kept as-is since functions cannot be cloned
    };
    const {
      startDate,
      rule,
      interval = 1,
      endDate,
      count,
      weekStartsOn = 1, // Default to Monday (1)
      weekDays,
      monthDay,
      monthDayMode = 'last',
      nthWeekdayOfMonth,
      excludeDates,
      condition,
      preset,
      timesOfDay,
    } = optionsWithDefaults;
    // Use the already normalized startDate from optionsWithDefaults
    this.startDate = startDate;
    this.rule = rule;
    this.timezone = timezone;
    this.interval = interval;
    this.count = count;
    this.weekStartsOn = weekStartsOn;
    this.weekDays = weekDays ? [...weekDays].sort() : undefined; // Copy and sort for consistency
    this.monthDay = monthDay;
    this.monthDayMode = monthDayMode;
    this.nthWeekdayOfMonth = nthWeekdayOfMonth
      ? { ...nthWeekdayOfMonth }
      : undefined;
    this.timesOfDay = timesOfDay
      ? [...new Set(timesOfDay)].sort()
      : undefined;
    this.parsedTimesOfDay = this.timesOfDay
      ? this.timesOfDay.map((t) => {
          const [hh, mm] = t.split(':').map(Number);
          return { hh, mm };
        })
      : undefined;
    this.excludeDates = excludeDates
      ? excludeDates.map((date) =>
          this.timesOfDay ? new Date(date) : this.zonedStartOfDay(date),
        )
      : undefined;
    this.excludeDateTimes = this.excludeDates
      ? new Set(this.excludeDates.map((date) => date.getTime()))
      : undefined;
    this.preset = preset;
    this.condition = condition;

    // Day-level rules match days, so the end date collapses to its day. With
    // timesOfDay the rule matches instants, so the exact time is kept and acts
    // as a hard cutoff inside its own day: an endDate at midnight ends the rule
    // before that day's slots. Callers wanting the whole final day pass an
    // end-of-day time.
    if (endDate) {
      this.endDate = this.timesOfDay
        ? new Date(endDate)
        : this.zonedStartOfDay(endDate);
    }
  }

  /**
   * Get the next occurrence strictly after the given date.
   *
   * `endDate` is compared the same way {@link getAllOccurrences} compares it:
   * by day for day-level rules, exactly for `timesOfDay` rules. So a
   * `timesOfDay` rule whose `endDate` sits at midnight is exhausted at the end
   * of the previous day and throws `END_DATE_EXCEEDED` here — to keep that
   * final day's slots, give `endDate` an end-of-day time.
   */
  getNextOccurrence(after: Date = new Date()): Date {
    assertDateArgument(after, 'after', 'getNextOccurrence');
    if (this.timesOfDay) {
      return this.getNextOccurrenceWithTimes(after);
    }
    return this.getNextOccurrenceByDay(after);
  }

  /**
   * Day-level next-occurrence path (no time-of-day expansion).
   */
  private getNextOccurrenceByDay(after: Date = new Date()): Date {
    if (this.rule === 'weekly' && this.weekDays) {
      return this.getNextWeeklyOccurrenceWithWeekDays(after);
    }

    if (this.rule === 'monthly' && this.monthDay !== undefined) {
      return this.getNextMonthlyOccurrenceWithSpecificDay(after);
    }

    if (this.rule === 'monthly' && this.nthWeekdayOfMonth) {
      return this.getNextMonthlyOccurrenceWithNthWeekday(after);
    }

    const afterNormalized = this.zonedStartOfDay(after);

    if (this.count !== undefined) {
      const allOccurrences = this.getAllOccurrences({
        start: this.startDate,
        end: this.zonedAddYears(afterNormalized, 10), // Look ahead enough to find all count occurrences
      });

      for (const occurrence of allOccurrences) {
        if (isAfter(occurrence, afterNormalized)) {
          return occurrence;
        }
      }

      throw QuickurrenceError.runtime(
        'No more occurrences within the specified count limit',
        QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
        {
          operation: 'getNextOccurrence',
          details: { countLimit: this.count },
        },
      );
    }

    if (
      isAfter(this.startDate, afterNormalized) &&
      this.shouldIncludeDate(this.startDate)
    ) {
      return this.startDate;
    }

    // Calculate the next occurrence based on the rule. Fast-forward close to
    // `after` first so far-future queries on infinite rules don't step one
    // interval at a time (and don't spuriously hit the safety cap below).
    let current = this.fastForwardTowardDay(afterNormalized);
    let attempts = 0;
    const maxAttempts = 1000; // Prevent infinite loops when many dates are excluded

    while (
      isBefore(current, afterNormalized) ||
      isEqual(current, afterNormalized) ||
      !this.shouldIncludeDate(current)
    ) {
      current = this.getNextDate(current);
      attempts++;

      // Safety check to prevent infinite loops
      if (attempts > maxAttempts) {
        throw QuickurrenceError.runtime(
          'Could not find next occurrence after maximum attempts',
          QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
          {
            operation: 'getNextOccurrence',
            details: { maxAttempts, attempts },
          },
        );
      }

      if (this.endDate && isAfter(current, this.endDate)) {
        throw QuickurrenceError.runtime(
          'No more occurrences within the specified end date',
          QuickurrenceErrorCode.END_DATE_EXCEEDED,
          {
            operation: 'getNextOccurrence',
            details: { endDate: new Date(this.endDate), currentDate: current },
          },
        );
      }
    }

    if (this.endDate && isAfter(current, this.endDate)) {
      throw QuickurrenceError.runtime(
        'No more occurrences within the specified end date',
        QuickurrenceErrorCode.END_DATE_EXCEEDED,
        {
          operation: 'getNextOccurrence',
          details: { endDate: new Date(this.endDate), currentDate: current },
        },
      );
    }

    return current;
  }

  /**
   * Get all occurrences within the given date range.
   *
   * Both ends of the range are inclusive, but they are compared at different
   * granularities depending on whether the rule expands into times of day:
   *
   * - Without `timesOfDay` the rule matches days, so both ends are compared by
   *   day: the whole day of `range.start` and the whole day of `range.end` are
   *   in range, and each returned date is that day's marker at 00:00 in the
   *   rule timezone.
   * - With `timesOfDay` the rule matches instants, so both ends are compared
   *   exactly: slots before `range.start` or after `range.end` are dropped,
   *   including slots that sit on an in-range day.
   *
   * That means the two forms can return different sets of days for the same
   * range — a day-level rule reports the day itself, a `timesOfDay` rule
   * reports only the slots that actually fall inside the window. Adding
   * `timesOfDay` to a rule and passing a `range.end` at midnight therefore
   * yields nothing for that final day, because every slot is after 00:00.
   *
   * `endDate` follows the same split: see the constructor and
   * {@link getNextOccurrence}.
   *
   * Results are capped at {@link MAX_NEXT_OCCURENCES} as a safety limit.
   */
  getAllOccurrences(range: DateRange): Date[] {
    assertDateRangeArgument(range, 'getAllOccurrences');
    if (this.timesOfDay) {
      return this.getAllOccurrencesWithTimes(range);
    }
    return this.collectDayOccurrences(range);
  }

  /**
   * Internal day-level occurrence collection. Returns one Date per matching day,
   * normalized to startOfDay. Public callers go through getAllOccurrences.
   */
  private collectDayOccurrences(range: DateRange): Date[] {
    if (this.rule === 'weekly' && this.weekDays) {
      return this.getAllWeeklyOccurrencesWithWeekDays(range);
    }

    if (this.rule === 'monthly' && this.monthDay !== undefined) {
      return this.getAllMonthlyOccurrencesWithSpecificDay(range);
    }

    if (this.rule === 'monthly' && this.nthWeekdayOfMonth) {
      return this.getAllMonthlyOccurrencesWithNthWeekday(range);
    }

    const occurrences: Date[] = [];
    const startNormalized = this.zonedStartOfDay(range.start);
    const rangeEndNormalized = this.zonedStartOfDay(range.end);

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    let current = this.startDate;

    if (isBefore(current, startNormalized)) {
      current = this.getNextOccurrenceByDay(
        new Date(startNormalized.getTime() - 1),
      );
    }

    let iterations = 0;
    while (
      isBefore(current, effectiveEndDate) ||
      isEqual(current, effectiveEndDate)
    ) {
      if (
        isAfter(current, startNormalized) ||
        isEqual(current, startNormalized)
      ) {
        if (this.shouldIncludeDate(current)) {
          occurrences.push(new Date(current));

          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }
      current = this.getNextDate(current);

      // Safety check to prevent infinite loops
      iterations++;
      if (
        occurrences.length >= MAX_NEXT_OCCURENCES ||
        iterations > MAX_COLLECTION_ITERATIONS
      ) {
        break;
      }
    }

    return occurrences;
  }

  getStartDate(): Date {
    return new Date(this.startDate);
  }

  private isDateExcluded(date: Date): boolean {
    if (!this.excludeDateTimes || this.excludeDateTimes.size === 0) {
      return false;
    }

    // When timesOfDay is set, exclusions match exact datetime; otherwise match day.
    const target = this.timesOfDay
      ? date
      : this.zonedStartOfDay(date);
    return this.excludeDateTimes.has(target.getTime());
  }

  /**
   * Expand a day-level date into datetimes for each configured time-of-day.
   * Returns the input as-is if timesOfDay is not configured.
   */
  private expandDayWithTimes(day: Date): Date[] {
    if (!this.parsedTimesOfDay || this.parsedTimesOfDay.length === 0) {
      return [day];
    }
    return this.parsedTimesOfDay.map(({ hh, mm }) =>
      this.zonedSetTime(day, hh, mm),
    );
  }

  /**
   * Time-aware variant of getAllOccurrences. Collects days via the existing
   * day-level branches, expands each into datetimes, then filters/caps.
   */
  private getAllOccurrencesWithTimes(range: DateRange): Date[] {
    const dayRange: DateRange = {
      start: this.zonedStartOfDay(range.start),
      end: this.zonedStartOfDay(range.end),
    };
    const days = this.collectDayOccurrences(dayRange);
    let datetimes = days.flatMap((d) => this.expandDayWithTimes(d));
    // Day collection widens the range to whole days, so the expanded slots are
    // re-checked against the caller's exact instants on purpose.
    datetimes = datetimes.filter(
      (d) =>
        !isBefore(d, range.start) &&
        !isAfter(d, range.end) &&
        (!this.endDate || !isAfter(d, this.endDate)) &&
        !this.isDateExcluded(d),
    );
    datetimes.sort((a, b) => a.getTime() - b.getTime());
    const dedup: Date[] = [];
    for (const d of datetimes) {
      if (
        dedup.length === 0 ||
        dedup[dedup.length - 1].getTime() !== d.getTime()
      ) {
        dedup.push(d);
      }
    }
    // Day collection is capped at MAX_NEXT_OCCURENCES days, and each day fans
    // out into one slot per timesOfDay entry, so the cap is re-applied to the
    // expanded list — it bounds returned occurrences, not candidate days.
    const limit =
      this.count === undefined
        ? MAX_NEXT_OCCURENCES
        : Math.min(this.count, MAX_NEXT_OCCURENCES);
    return dedup.slice(0, limit);
  }

  /**
   * Time-aware variant of getNextOccurrence. The non-count path walks matching
   * days lazily through the fast-forwarded getNextOccurrenceByDay, expanding
   * only as many days as needed instead of materializing a multi-year window.
   */
  private getNextOccurrenceWithTimes(after: Date): Date {
    if (this.count !== undefined) {
      return this.getNextOccurrenceWithTimesWindowed(after);
    }

    const afterDay = this.zonedStartOfDay(after);
    let day = this.getNextOccurrenceByDay(new Date(afterDay.getTime() - 1));

    let attempts = 0;
    const maxAttempts = 1000;
    while (attempts <= maxAttempts) {
      if (this.endDate && isAfter(day, this.endDate)) {
        break;
      }

      const times = this.expandDayWithTimes(day).sort(
        (a, b) => a.getTime() - b.getTime(),
      );
      for (const t of times) {
        if (
          isAfter(t, after) &&
          (!this.endDate || !isAfter(t, this.endDate)) &&
          !this.isDateExcluded(t)
        ) {
          return t;
        }
      }

      day = this.getNextOccurrenceByDay(day);
      attempts++;
    }

    throw QuickurrenceError.runtime(
      'No more occurrences within the specified end date',
      QuickurrenceErrorCode.END_DATE_EXCEEDED,
      {
        operation: 'getNextOccurrence',
        details: { endDate: this.endDate, afterDate: after },
      },
    );
  }

  /**
   * Count-bounded time-aware next-occurrence: enumerates from the start so the
   * Nth-occurrence limit is honored, then returns the first datetime after `after`.
   */
  private getNextOccurrenceWithTimesWindowed(after: Date): Date {
    const windowStartReference = isAfter(after, this.startDate)
      ? after
      : this.startDate;
    const range: DateRange = {
      start: this.startDate,
      end: this.zonedAddYears(windowStartReference, 10),
    };
    const all = this.getAllOccurrencesWithTimes(range);
    for (const occ of all) {
      if (isAfter(occ, after)) {
        return occ;
      }
    }
    throw QuickurrenceError.runtime(
      'No more occurrences within the specified count limit',
      QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
      {
        operation: 'getNextOccurrence',
        details: { countLimit: this.count },
      },
    );
  }

  private meetsCondition(date: Date): boolean {
    if (this.condition === undefined) {
      return true;
    }

    if (typeof this.condition === 'boolean') {
      return this.condition;
    }

    // The predicate sees the day's exact start instant in the rule timezone,
    // plus that instant's rule-zone fields — a plain Date's own accessors would
    // report the host timezone and could name a different day.
    const normalizedDate = this.zonedStartOfDay(date);
    return this.condition(normalizedDate, this.zonedPartsOf(normalizedDate));
  }

  /**
   * Check if a date should be included (not excluded and meets condition)
   */
  private shouldIncludeDate(date: Date): boolean {
    return !this.isDateExcluded(date) && this.meetsCondition(date);
  }

  getRule(): RecurrenceRule {
    return this.rule;
  }

  getEndDate(): Date | undefined {
    return this.endDate ? new Date(this.endDate) : undefined;
  }

  /**
   * Get the original options used to create this instance
   */
  getOptions(): QuickurrenceOptions {
    return structuredClone(this.options);
  }

  getWeekStartsOn(): WeekStartsOn {
    return this.weekStartsOn;
  }

  getWeekDays(): WeekDay[] | undefined {
    return this.weekDays ? [...this.weekDays] : undefined;
  }

  getMonthDay(): MonthDay | undefined {
    return this.monthDay;
  }

  getMonthDayMode(): MonthDayMode {
    return this.monthDayMode;
  }

  getNthWeekdayOfMonth(): NthWeekdayConfig | undefined {
    return this.nthWeekdayOfMonth ? { ...this.nthWeekdayOfMonth } : undefined;
  }

  getCount(): number | undefined {
    return this.count;
  }

  getExcludeDates(): Date[] | undefined {
    return this.excludeDates
      ? this.excludeDates.map((date) => new Date(date))
      : undefined;
  }

  getCondition(): Condition | undefined {
    return this.condition;
  }

  getPreset(): Preset | undefined {
    return this.preset;
  }

  getTimesOfDay(): string[] | undefined {
    return this.timesOfDay ? [...this.timesOfDay] : undefined;
  }

  /**
   * Sort weekdays for display with Saturday before Sunday
   */
  public static sortWeekDaysForDisplay(weekDays: WeekDay[]): WeekDay[] {
    return weekDays.toSorted((a, b) => {
      // Map Saturday (6) to come before Sunday (0) by treating 6 as -1
      const aMapped = a === 6 ? -1 : a;
      const bMapped = b === 6 ? -1 : b;
      return aMapped - bMapped;
    });
  }

  /**
   * Convert a preset to its corresponding Quickurrence options
   */
  public static presetToOptions(preset: Preset): Partial<QuickurrenceOptions> {
    switch (preset) {
      case 'businessDays':
        return {
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5] as WeekDay[], // Monday to Friday
        };
      case 'weekends':
        return {
          rule: 'weekly',
          weekDays: [0, 6] as WeekDay[], // Sunday and Saturday
        };
      default:
        // Unreachable for a well-typed caller, but plain-JS callers reach it —
        // and this runs before any validation, so it is the only place the bad
        // preset is seen. It must be as actionable as the validator's own
        // UNSUPPORTED_PRESET rejection.
        throw QuickurrenceError.configuration(
          `Unsupported preset: ${String(preset)}`,
          QuickurrenceErrorCode.UNSUPPORTED_PRESET,
          {
            option: 'preset',
            value: preset,
            expected: `One of: ${presetOptions.join(', ')}`,
            operation: 'presetToOptions',
          },
        );
    }
  }

  /**
   * Clean Quickurrence options by removing incompatible field combinations
   * This method ensures the options are valid by removing conflicting properties
   */
  public static clean(options: QuickurrenceOptions): QuickurrenceOptions {
    const cleaned: QuickurrenceOptions = { ...options };

    // If no rule specified, we can't validate rule-specific options, so return as-is
    if (!cleaned.rule) {
      return cleaned;
    }

    if (cleaned.rule !== 'weekly') {
      delete cleaned.weekDays;
    }

    if (cleaned.rule !== 'monthly') {
      delete cleaned.monthDay;
      delete cleaned.monthDayMode;
      delete cleaned.nthWeekdayOfMonth;
    }

    // Handle conflicting options by keeping the first one and removing conflicts
    if (cleaned.count !== undefined && cleaned.endDate !== undefined) {
      // Keep count, remove endDate (count is more explicit)
      delete cleaned.endDate;
    }

    if (cleaned.preset !== undefined && cleaned.condition !== undefined) {
      // Keep preset, remove condition (preset is more user-friendly)
      delete cleaned.condition;
    }

    if (
      cleaned.monthDay !== undefined &&
      cleaned.nthWeekdayOfMonth !== undefined
    ) {
      // Keep monthDay, remove nthWeekdayOfMonth (monthDay is simpler)
      delete cleaned.nthWeekdayOfMonth;
    }

    if (cleaned.weekDays && cleaned.weekDays.length === 0) {
      delete cleaned.weekDays;
    }

    if (cleaned.excludeDates && cleaned.excludeDates.length === 0) {
      delete cleaned.excludeDates;
    }

    if (cleaned.timesOfDay && cleaned.timesOfDay.length === 0) {
      delete cleaned.timesOfDay;
    }

    if (cleaned.interval === 1) {
      delete cleaned.interval;
    }

    return cleaned;
  }

  /**
   * Check if current configuration matches a preset pattern
   */
  public static getMatchingPreset(
    options: QuickurrenceOptions,
  ): Preset | undefined {
    if (options.rule === 'weekly' && options.weekDays) {
      const weekDays = [...options.weekDays].sort();

      const businessDays = [1, 2, 3, 4, 5];
      if (this.areArraysEqual(weekDays, businessDays)) {
        return 'businessDays';
      }

      const weekendDays = [0, 6];
      if (this.areArraysEqual(weekDays, weekendDays)) {
        return 'weekends';
      }
    }

    return undefined;
  }

  /**
   * Advance the start date by `k` rule intervals in one arithmetic step.
   * Only sound for rules with associative period arithmetic (daily/weekly),
   * which is where fast-forwarding is applied.
   */
  private advanceGrid(k: number): Date {
    const steps = k * this.interval;
    switch (this.rule) {
      case 'weekly':
        return this.zonedStartOfDay(this.zonedAddWeeks(this.startDate, steps));
      default:
        return this.zonedStartOfDay(this.zonedAddDays(this.startDate, steps));
    }
  }

  /**
   * Jump from the start date to the last grid occurrence at or before
   * `afterNormalized`, so the caller only needs a few steps to reach the
   * first occurrence after it. Returns the start date when no safe jump
   * applies (monthly/yearly, where day/leap clamping makes multiplication
   * differ from iteration).
   */
  private fastForwardTowardDay(afterNormalized: Date): Date {
    const startMs = this.startDate.getTime();
    const afterMs = afterNormalized.getTime();
    if (afterMs <= startMs) {
      return new Date(this.startDate);
    }
    if (this.rule !== 'daily' && this.rule !== 'weekly') {
      return new Date(this.startDate);
    }

    const periodDays = this.rule === 'weekly' ? 7 : 1;
    let k = Math.floor((afterMs - startMs) / (this.interval * periodDays * DAY_MS));
    if (k <= 0) {
      return new Date(this.startDate);
    }

    let candidate = this.advanceGrid(k);
    while (k > 0 && isAfter(candidate, afterNormalized)) {
      k--;
      candidate = this.advanceGrid(k);
    }
    return candidate;
  }

  private getNextDate(current: Date): Date {
    let nextDate: Date;
    switch (this.rule) {
      case 'daily':
        nextDate = this.getNextDaily(current);
        break;
      case 'weekly':
        nextDate = this.getNextWeekly(current);
        break;
      case 'monthly':
        nextDate = this.getNextMonthly(current);
        break;
      case 'yearly':
        nextDate = this.getNextYearly(current);
        break;
      default:
        // This should never happen due to validation in constructor
        nextDate = current;
        break;
    }

    // Normalize to start of day in the specified timezone
    return this.zonedStartOfDay(nextDate);
  }

  private getNextDaily(current: Date): Date {
    return this.zonedAddDays(current, this.interval);
  }

  private getDay(date: Date): Day {
    return this.zonedPartsOf(date).weekday as Day;
  }

  /**
   * Build the instant matching a wall clock in the rule timezone. The result is
   * a plain `Date`, so only its epoch carries meaning: its own accessors report
   * the host timezone, and rule-zone fields must come from
   * {@link Quickurrence.zonedPartsOf}.
   */
  private wallClock(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
    ms = 0,
  ): Date {
    return zonedWallClock(
      this.timezone,
      year,
      month,
      day,
      hour,
      minute,
      second,
      ms,
    );
  }

  private zonedPartsOf(date: Date) {
    return zonedParts(date.getTime(), this.timezone);
  }

  private zonedDayStart(year: number, month: number, day: number): Date {
    return this.wallClock(year, month, day);
  }

  private zonedStartOfDay(date: Date): Date {
    const { year, month, day } = this.zonedPartsOf(date);
    return this.wallClock(year, month, day);
  }

  private zonedSetTime(date: Date, hour: number, minute: number): Date {
    const { year, month, day } = this.zonedPartsOf(date);
    return this.wallClock(year, month, day, hour, minute, 0, 0);
  }

  private zonedAddDays(date: Date, amount: number): Date {
    const { year, month, day, hour, minute, second, ms } =
      this.zonedPartsOf(date);
    return this.wallClock(year, month, day + amount, hour, minute, second, ms);
  }

  private zonedAddWeeks(date: Date, amount: number): Date {
    return this.zonedAddDays(date, amount * 7);
  }

  private zonedAddMonths(date: Date, amount: number): Date {
    const { year, month, day, hour, minute, second, ms } =
      this.zonedPartsOf(date);
    const total = month + amount;
    const targetYear = year + Math.floor(total / 12);
    const targetMonth = ((total % 12) + 12) % 12;
    // Month arithmetic clamps rather than rolls over: Jan 31 + 1 month is Feb 28.
    const targetDay = Math.min(day, utcDaysInMonth(targetYear, targetMonth));
    return this.wallClock(
      targetYear,
      targetMonth,
      targetDay,
      hour,
      minute,
      second,
      ms,
    );
  }

  private zonedAddYears(date: Date, amount: number): Date {
    return this.zonedAddMonths(date, amount * 12);
  }

  private zonedLastDayOfMonth(date: Date): Date {
    const { year, month, hour, minute, second, ms } = this.zonedPartsOf(date);
    return this.wallClock(
      year,
      month,
      utcDaysInMonth(year, month),
      hour,
      minute,
      second,
      ms,
    );
  }

  private zonedDaysInMonth(date: Date): number {
    const { year, month } = this.zonedPartsOf(date);
    return utcDaysInMonth(year, month);
  }

  private zonedStartOfWeek(date: Date): Date {
    const { year, month, day, weekday } = this.zonedPartsOf(date);
    const back = (weekday - this.weekStartsOn + 7) % 7;
    return this.wallClock(year, month, day - back);
  }

  private zonedNextDay(date: Date, target: Day): Date {
    const { year, month, day, weekday } = this.zonedPartsOf(date);
    const forward = ((target - weekday + 7) % 7) || 7;
    return this.wallClock(year, month, day + forward);
  }

  private static areArraysEqual<T>(array1: T[], array2: T[]): boolean {
    return (
      array1.every((item) => array2.includes(item)) &&
      array1.length === array2.length
    );
  }

  private getNextWeekly(current: Date): Date {
    if (!this.weekDays) {
      return this.zonedAddWeeks(current, this.interval);
    }

    const currentWeekday = this.getDay(current);
    const currentWeekdayIndex = this.weekDays.indexOf(currentWeekday);

    // Check if there's a later weekday in the same week
    if (
      currentWeekdayIndex >= 0 &&
      currentWeekdayIndex < this.weekDays.length - 1
    ) {
      const nextWeekday = this.weekDays[currentWeekdayIndex + 1];
      QuickurrenceValidator.validateWeekdayValue(nextWeekday);
      return this.getNextWeekdayOccurrence(
        this.zonedAddDays(current, 1),
        nextWeekday,
      );
    }

    const nextWeekStart = this.zonedAddWeeks(current, this.interval);
    const firstWeekday = this.weekDays[0];
    QuickurrenceValidator.validateWeekdayValue(firstWeekday);
    return this.getNextWeekdayOccurrence(nextWeekStart, firstWeekday);
  }

  private getNextMonthly(current: Date): Date {
    if (this.monthDay !== undefined) {
      return this.getNextMonthlyWithSpecificDay(current);
    }
    if (this.nthWeekdayOfMonth) {
      return this.getNextMonthlyWithNthWeekday(current);
    }
    return this.zonedAddMonths(current, this.interval);
  }

  private getNextYearly(current: Date): Date {
    return this.zonedAddYears(current, this.interval);
  }

  private getNextMonthlyWithSpecificDay(current: Date): Date {
    const targetDay = this.monthDay!; // Direct use of 1-31
    const { year, month } = this.zonedPartsOf(current);
    const normalizedCurrent = this.zonedStartOfDay(current);

    const normalizedTargetThisMonth = this.zonedDayStart(
      year,
      month,
      targetDay,
    );

    // If the target day exists in the current month and is STRICTLY after the current date, use it
    if (
      targetDay <= this.zonedDaysInMonth(current) &&
      isAfter(normalizedTargetThisMonth, normalizedCurrent)
    ) {
      return normalizedTargetThisMonth;
    }

    // Otherwise, find next month with target day (always move forward)
    let nextMonth = this.zonedAddMonths(current, this.interval);
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops

    while (attempts < maxAttempts) {
      const daysInTargetMonth = this.zonedDaysInMonth(nextMonth);

      if (targetDay <= daysInTargetMonth) {
        const nextParts = this.zonedPartsOf(nextMonth);
        return this.zonedDayStart(nextParts.year, nextParts.month, targetDay);
      }

      if (this.monthDayMode === 'last') {
        const lastDay = this.zonedLastDayOfMonth(nextMonth);
        return this.zonedStartOfDay(lastDay);
      }

      nextMonth = this.zonedAddMonths(nextMonth, this.interval);
      attempts++;
    }

    throw QuickurrenceError.runtime(
      'Could not find next monthly occurrence within reasonable attempts',
      QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
      {
        operation: 'getNextMonthlyWithSpecificDay',
        details: { maxAttempts, attempts: maxAttempts },
      },
    );
  }

  private getAllMonthlyOccurrencesWithSpecificDay(
    range: DateRange,
    stopAfter?: Date,
  ): Date[] {
    if (this.monthDay === undefined) {
      throw QuickurrenceError.unsupportedOperation(
        'monthDay must be specified for this method',
        QuickurrenceErrorCode.MISSING_REQUIRED_OPTION,
        {
          operation: 'getAllMonthlyOccurrencesWithSpecificDay',
          option: 'monthDay',
          expected: 'MonthDay value (1-31)',
        },
      );
    }

    const occurrences: Date[] = [];
    const startNormalized = this.zonedStartOfDay(range.start);
    const rangeEndNormalized = this.zonedStartOfDay(range.end);

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    let monthCounter = 0;
    let currentMonthStart: Date = this.startDate;

    while (currentMonthStart <= effectiveEndDate) {
      const monthOccurrence = this.getMonthDayOccurrence(currentMonthStart);

      if (monthOccurrence) {
        const shouldInclude =
          (isAfter(monthOccurrence, startNormalized) ||
            isEqual(monthOccurrence, startNormalized)) &&
          (isBefore(monthOccurrence, effectiveEndDate) ||
            isEqual(monthOccurrence, effectiveEndDate)) &&
          (isAfter(monthOccurrence, this.startDate) ||
            isEqual(monthOccurrence, this.startDate));

        if (shouldInclude && this.shouldIncludeDate(monthOccurrence)) {
          occurrences.push(new Date(monthOccurrence));

          // Short-circuit once we've passed the caller's target
          if (stopAfter && isAfter(monthOccurrence, stopAfter)) {
            break;
          }

          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }

      monthCounter++;
      currentMonthStart = this.zonedAddMonths(this.startDate, monthCounter * this.interval);

      // Safety check to prevent infinite loops
      if (occurrences.length >= MAX_NEXT_OCCURENCES || monthCounter > 120) {
        break;
      }
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get the target day occurrence in a specific month (or null if skipped)
   */
  private getMonthDayOccurrence(monthDate: Date): Date | null {
    const targetDay = this.monthDay!; // Direct use of 1-31
    const { year, month } = this.zonedPartsOf(monthDate);
    const daysInMonth = utcDaysInMonth(year, month);

    if (targetDay <= daysInMonth) {
      return this.wallClock(year, month, targetDay);
    }

    if (this.monthDayMode === 'last') {
      return this.zonedStartOfDay(this.zonedLastDayOfMonth(monthDate));
    }

    return null;
  }

  private getNextMonthlyOccurrenceWithSpecificDay(after: Date): Date {
    if (this.monthDay === undefined) {
      throw QuickurrenceError.unsupportedOperation(
        'monthDay must be specified for this method',
        QuickurrenceErrorCode.MISSING_REQUIRED_OPTION,
        {
          operation: 'getNextMonthlyOccurrenceWithSpecificDay',
          option: 'monthDay',
          expected: 'MonthDay value (1-31)',
        },
      );
    }

    const afterNormalized = this.zonedStartOfDay(after);

    if (this.count !== undefined) {
      const allOccurrences = this.getAllMonthlyOccurrencesWithSpecificDay(
        {
          start: this.startDate,
          end: this.zonedAddMonths(afterNormalized, 200), // Look ahead enough to find all count occurrences
        },
        afterNormalized,
      );

      for (const occurrence of allOccurrences) {
        if (isAfter(occurrence, afterNormalized)) {
          return occurrence;
        }
      }

      throw QuickurrenceError.runtime(
        'No more occurrences within the specified count limit',
        QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
        {
          operation: 'getNextMonthlyOccurrenceWithSpecificDay',
          details: { countLimit: this.count },
        },
      );
    }

    if (isAfter(this.startDate, afterNormalized)) {
      const startOccurrence = this.getMonthDayOccurrence(this.startDate);
      if (
        startOccurrence &&
        isAfter(startOccurrence, afterNormalized)
      ) {
        return startOccurrence;
      }
    }

    const range = {
      start: afterNormalized,
      end: this.zonedAddMonths(afterNormalized, 100), // Look ahead 100 months to find next occurrence
    };

    const allOccurrences = this.getAllMonthlyOccurrencesWithSpecificDay(
      range,
      afterNormalized,
    );

    for (const occurrence of allOccurrences) {
      if (isAfter(occurrence, afterNormalized)) {
        return occurrence;
      }
    }

    throw QuickurrenceError.runtime(
      'No more occurrences within the specified end date',
      QuickurrenceErrorCode.END_DATE_EXCEEDED,
      {
        operation: 'getNextMonthlyOccurrenceWithSpecificDay',
        details: { afterDate: afterNormalized },
      },
    );
  }

  /**
   * Get the next occurrence of a specific weekday on or after the given date
   */
  private getNextWeekdayOccurrence(date: Date, targetWeekday: WeekDay): Date {
    const currentWeekday = this.getDay(date);

    if (currentWeekday === targetWeekday) {
      return date;
    }

    return this.zonedNextDay(date, targetWeekday);
  }

  /**
   * Get all occurrences of specified weekdays in the week containing the given date
   */
  private getWeekdaysInWeek(weekStartDate: Date, weekdays: WeekDay[]): Date[] {
    const occurrences: Date[] = [];

    for (const targetWeekday of weekdays) {
      const weekStartDay = this.getDay(weekStartDate);
      let daysToAdd = targetWeekday - weekStartDay;

      // Adjust if the target day is in the previous week
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }

      const targetDate = this.zonedAddDays(weekStartDate, daysToAdd);
      occurrences.push(this.zonedStartOfDay(targetDate));
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  private getAllWeeklyOccurrencesWithWeekDays(
    range: DateRange,
    stopAfter?: Date,
  ): Date[] {
    if (!this.weekDays) {
      throw QuickurrenceError.unsupportedOperation(
        'weekDays must be specified for this method',
        QuickurrenceErrorCode.MISSING_REQUIRED_OPTION,
        {
          operation: 'getAllWeeklyOccurrencesWithWeekDays',
          option: 'weekDays',
          expected: 'Array of WeekDay values (0-6)',
        },
      );
    }

    const occurrences: Date[] = [];
    const startNormalized = this.zonedStartOfDay(range.start);
    const rangeEndNormalized = this.zonedStartOfDay(range.end);

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    // Start from the aligned week that contains the rule's start date
    const baseWeekStart = this.zonedStartOfWeek(this.startDate);
    let weekCounter = 0;
    let currentWeekStart = baseWeekStart;

    while (currentWeekStart <= effectiveEndDate) {
      const weekOccurrences = this.getWeekdaysInWeek(
        currentWeekStart,
        this.weekDays,
      );

      for (const occurrence of weekOccurrences) {
        const shouldInclude =
          (isAfter(occurrence, startNormalized) ||
            isEqual(occurrence, startNormalized)) &&
          (isBefore(occurrence, effectiveEndDate) ||
            isEqual(occurrence, effectiveEndDate)) &&
          (isAfter(occurrence, this.startDate) ||
            isEqual(occurrence, this.startDate));

        if (shouldInclude && this.shouldIncludeDate(occurrence)) {
          occurrences.push(new Date(occurrence));

          // Short-circuit once we've passed the caller's target
          if (stopAfter && isAfter(occurrence, stopAfter)) {
            break;
          }

          if (this.count && occurrences.length >= this.count) {
            break;
          }

          // A week contributes up to one occurrence per weekday, so the cap has
          // to hold inside the week too, not only between weeks.
          if (occurrences.length >= MAX_NEXT_OCCURENCES) {
            break;
          }
        }
      }

      // Short-circuit once we've passed the caller's target (outer loop)
      if (
        stopAfter &&
        occurrences.length > 0 &&
        isAfter(occurrences[occurrences.length - 1], stopAfter)
      ) {
        break;
      }

      if (this.count && occurrences.length >= this.count) {
        break;
      }

      weekCounter++;
      currentWeekStart = this.zonedAddWeeks(baseWeekStart, weekCounter * this.interval);

      // Safety check to prevent infinite loops
      if (occurrences.length >= MAX_NEXT_OCCURENCES) {
        break;
      }
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  private getNextWeeklyOccurrenceWithWeekDays(after: Date): Date {
    if (!this.weekDays) {
      throw QuickurrenceError.unsupportedOperation(
        'weekDays must be specified for this method',
        QuickurrenceErrorCode.MISSING_REQUIRED_OPTION,
        {
          operation: 'getNextWeeklyOccurrenceWithWeekDays',
          option: 'weekDays',
          expected: 'Array of WeekDay values (0-6)',
        },
      );
    }

    const afterNormalized = this.zonedStartOfDay(after);
    if (this.count !== undefined) {
      const allOccurrences = this.getAllWeeklyOccurrencesWithWeekDays(
        {
          start: this.startDate,
          end: this.zonedAddWeeks(afterNormalized, 200), // Look ahead enough to find all count occurrences
        },
        afterNormalized,
      );
      for (const occurrence of allOccurrences) {
        if (isAfter(occurrence, afterNormalized)) {
          return occurrence;
        }
      }

      throw QuickurrenceError.runtime(
        'No more occurrences within the specified count limit',
        QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
        {
          operation: 'getNextWeeklyOccurrenceWithWeekDays',
          details: { countLimit: this.count },
        },
      );
    }

    if (isAfter(this.startDate, afterNormalized)) {
      const startWeekday = this.getDay(this.startDate);
      if (this.weekDays.includes(startWeekday)) {
        return this.startDate;
      }
    }
    const range = {
      start: afterNormalized,
      end: this.zonedAddWeeks(afterNormalized, 100), // Look ahead 100 weeks to find next occurrence
    };
    const allOccurrences = this.getAllWeeklyOccurrencesWithWeekDays(
      range,
      afterNormalized,
    );
    for (const occurrence of allOccurrences) {
      if (isAfter(occurrence, afterNormalized)) {
        return occurrence;
      }
    }

    throw QuickurrenceError.runtime(
      'No more occurrences within the specified end date',
      QuickurrenceErrorCode.END_DATE_EXCEEDED,
      {
        operation: 'getNextWeeklyOccurrenceWithWeekDays',
        details: { afterDate: afterNormalized },
      },
    );
  }

  private getNthWeekdayInMonth(
    monthDate: Date,
    weekday: WeekDay,
    nth: NthWeekdayOfMonth,
  ): Date | null {
    // A Date's own getFullYear/getMonth report the host timezone; the month this
    // walks must be the one the rule timezone is in.
    const { year, month } = this.zonedPartsOf(monthDate);
    const daysInMonth = this.zonedDaysInMonth(monthDate);
    const dayInMonth = (day: number) => this.zonedDayStart(year, month, day);

    // Handle 'last' case: step back from the last matching weekday of the month
    if (nth === 'last') {
      const lastWeekday = this.getDay(dayInMonth(daysInMonth));
      const targetDay = daysInMonth - ((lastWeekday - weekday + 7) % 7);
      return dayInMonth(targetDay);
    }

    // Handle 1st, 2nd, 3rd, 4th cases via arithmetic from the first day
    const firstWeekday = this.getDay(dayInMonth(1));
    const firstOccurrenceDay = 1 + ((weekday - firstWeekday + 7) % 7);
    const targetDay = firstOccurrenceDay + 7 * (nth - 1);
    if (targetDay > daysInMonth) {
      return null; // nth occurrence doesn't exist in this month
    }
    return dayInMonth(targetDay);
  }

  private getAllMonthlyOccurrencesWithNthWeekday(
    range: DateRange,
    stopAfter?: Date,
  ): Date[] {
    if (!this.nthWeekdayOfMonth) {
      throw QuickurrenceError.unsupportedOperation(
        'nthWeekdayOfMonth must be specified for this method',
        QuickurrenceErrorCode.MISSING_REQUIRED_OPTION,
        {
          operation: 'getAllMonthlyOccurrencesWithNthWeekday',
          option: 'nthWeekdayOfMonth',
          expected: 'NthWeekdayConfig object',
        },
      );
    }

    const occurrences: Date[] = [];
    const startNormalized = this.zonedStartOfDay(range.start);
    const rangeEndNormalized = this.zonedStartOfDay(range.end);

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    let monthCounter = 0;
    let currentMonthStart: Date = this.startDate;

    while (currentMonthStart <= effectiveEndDate) {
      const monthOccurrence = this.getNthWeekdayInMonth(
        currentMonthStart,
        this.nthWeekdayOfMonth.weekday,
        this.nthWeekdayOfMonth.nth,
      );

      if (monthOccurrence) {
        const shouldInclude =
          (isAfter(monthOccurrence, startNormalized) ||
            isEqual(monthOccurrence, startNormalized)) &&
          (isBefore(monthOccurrence, effectiveEndDate) ||
            isEqual(monthOccurrence, effectiveEndDate)) &&
          (isAfter(monthOccurrence, this.startDate) ||
            isEqual(monthOccurrence, this.startDate));

        if (shouldInclude && this.shouldIncludeDate(monthOccurrence)) {
          occurrences.push(new Date(monthOccurrence));

          // Short-circuit once we've passed the caller's target
          if (stopAfter && isAfter(monthOccurrence, stopAfter)) {
            break;
          }

          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }

      monthCounter++;
      currentMonthStart = this.zonedAddMonths(this.startDate, monthCounter * this.interval);

      // Safety check to prevent infinite loops
      if (occurrences.length >= MAX_NEXT_OCCURENCES || monthCounter > 120) {
        break;
      }
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  private getNextMonthlyOccurrenceWithNthWeekday(after: Date): Date {
    if (!this.nthWeekdayOfMonth) {
      throw QuickurrenceError.unsupportedOperation(
        'nthWeekdayOfMonth must be specified for this method',
        QuickurrenceErrorCode.MISSING_REQUIRED_OPTION,
        {
          operation: 'getNextMonthlyOccurrenceWithNthWeekday',
          option: 'nthWeekdayOfMonth',
          expected: 'NthWeekdayConfig object',
        },
      );
    }

    const afterNormalized = this.zonedStartOfDay(after);

    if (this.count !== undefined) {
      const allOccurrences = this.getAllMonthlyOccurrencesWithNthWeekday(
        {
          start: this.startDate,
          end: this.zonedAddMonths(afterNormalized, 200), // Look ahead enough to find all count occurrences
        },
        afterNormalized,
      );

      for (const occurrence of allOccurrences) {
        if (isAfter(occurrence, afterNormalized)) {
          return occurrence;
        }
      }

      throw QuickurrenceError.runtime(
        'No more occurrences within the specified count limit',
        QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
        {
          operation: 'getNextMonthlyOccurrenceWithNthWeekday',
          details: { countLimit: this.count },
        },
      );
    }

    if (isAfter(this.startDate, afterNormalized)) {
      const startOccurrence = this.getNthWeekdayInMonth(
        this.startDate,
        this.nthWeekdayOfMonth.weekday,
        this.nthWeekdayOfMonth.nth,
      );
      if (
        startOccurrence &&
        isAfter(startOccurrence, afterNormalized)
      ) {
        return startOccurrence;
      }
    }

    const range = {
      start: afterNormalized,
      end: this.zonedAddMonths(afterNormalized, 100), // Look ahead 100 months to find next occurrence
    };

    const allOccurrences = this.getAllMonthlyOccurrencesWithNthWeekday(
      range,
      afterNormalized,
    );

    for (const occurrence of allOccurrences) {
      if (isAfter(occurrence, afterNormalized)) {
        return occurrence;
      }
    }

    throw QuickurrenceError.runtime(
      'No more occurrences within the specified end date',
      QuickurrenceErrorCode.END_DATE_EXCEEDED,
      {
        operation: 'getNextMonthlyOccurrenceWithNthWeekday',
        details: { afterDate: afterNormalized },
      },
    );
  }

  /**
   * Get the next monthly occurrence with nth weekday (internal method for getNextDate)
   */
  private getNextMonthlyWithNthWeekday(current: Date): Date {
    const { weekday, nth } = this.nthWeekdayOfMonth!;
    const normalizedCurrent = this.zonedStartOfDay(current);

    const targetThisMonth = this.getNthWeekdayInMonth(current, weekday, nth);

    // If the target exists in the current month and is STRICTLY after the current date, use it
    if (targetThisMonth && isAfter(targetThisMonth, normalizedCurrent)) {
      return targetThisMonth;
    }

    // Otherwise, find next month with nth weekday (always move forward)
    let nextMonth = this.zonedAddMonths(current, this.interval);
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops

    while (attempts < maxAttempts) {
      const targetNextMonth = this.getNthWeekdayInMonth(
        nextMonth,
        weekday,
        nth,
      );

      if (targetNextMonth) {
        return targetNextMonth;
      }

      nextMonth = this.zonedAddMonths(nextMonth, this.interval);
      attempts++;
    }

    throw QuickurrenceError.runtime(
      'Could not find next monthly nth weekday occurrence within reasonable attempts',
      QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
      {
        operation: 'getNextMonthlyWithNthWeekday',
        details: { maxAttempts, attempts: maxAttempts },
      },
    );
  }

  /**
   * Generate human-readable text describing this recurrence rule
   */
  toHumanText(): string {
    try {
      let text = '';

      if (this.interval === 1) {
        text = Quickurrence.capitalize(this.rule);
      } else {
        text = `Every ${this.interval} ${this.rule === 'daily' ? 'days' : this.rule === 'weekly' ? 'weeks' : this.rule === 'monthly' ? 'months' : 'years'}`;
      }

      if (this.rule === 'weekly' && this.weekDays && this.weekDays.length > 0) {
        const sortedWeekDays = Quickurrence.sortWeekDaysForDisplay(
          this.weekDays,
        );
        const dayLabels = sortedWeekDays.map((day) => DAY_NAMES[day]).join(', ');
        text += ` on ${dayLabels}`;
      }

      if (this.rule === 'monthly' && this.monthDay) {
        text += ` on the ${Quickurrence.getOrdinalDay(this.monthDay)}`;
      }

      if (this.rule === 'monthly' && this.nthWeekdayOfMonth) {
        const nthText =
          this.nthWeekdayOfMonth.nth === 'last'
            ? 'last'
            : Quickurrence.getOrdinalNumber(
                this.nthWeekdayOfMonth.nth as number,
              );
        text += ` on the ${nthText} ${DAY_NAMES[this.nthWeekdayOfMonth.weekday]}`;
      }

      if (this.timesOfDay && this.timesOfDay.length > 0) {
        text += ` at ${this.timesOfDay.join(', ')}`;
      }

      if (this.preset === 'businessDays') {
        text += ' (business days only)';
      } else if (this.preset === 'weekends') {
        text += ' (weekends only)';
      }

      if (this.count) {
        text += `, ${this.count} times`;
      } else if (this.endDate) {
        text += ` until ${this.endDate.toLocaleDateString(undefined, { timeZone: this.timezone })}`;
      }

      return text;
    } catch (error) {
      console.error(
        'Failed to generate human readable text for Quickurrence',
        error,
      );
      return 'Invalid recurrence rule';
    }
  }

  /**
   * Generate human-readable text describing this recurrence rule
   */
  static toHumanText(quickurrenceOptions: QuickurrenceOptions): string {
    const cleanedOptions = Quickurrence.clean(quickurrenceOptions);
    return new Quickurrence(cleanedOptions).toHumanText();
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get ordinal representation of a day (1st, 2nd, 3rd, etc.)
   */
  private static getOrdinalDay(day: number): string {
    const suffix = Quickurrence.getOrdinalSuffix(day);
    return `${day}${suffix}`;
  }

  /**
   * Get ordinal representation of a number (1st, 2nd, 3rd, etc.)
   */
  private static getOrdinalNumber(num: number): string {
    const suffix = Quickurrence.getOrdinalSuffix(num);
    return `${num}${suffix}`;
  }

  /**
   * Get the ordinal suffix for a number (st, nd, rd, th)
   */
  private static getOrdinalSuffix(num: number): string {
    if (num >= 11 && num <= 13) return 'th';
    switch (num % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }
}
