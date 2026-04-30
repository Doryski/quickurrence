import { tz, TZDate } from '@date-fns/tz';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  type Day,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  isEqual,
  lastDayOfMonth,
  nextDay,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { z } from 'zod';
import { QuickurrenceError, QuickurrenceErrorCode } from './error';
import { QuickurrenceValidator } from './validator';

export const recurrenceRulesOptions = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;
export type RecurrenceRule = (typeof recurrenceRulesOptions)[number];
export const RecurrenceRuleSchema = z.enum(recurrenceRulesOptions);
const _presetOptions = ['businessDays', 'weekends'] as const;
const PresetSchema = z.enum(_presetOptions);
export type Preset = (typeof _presetOptions)[number];
export const DateRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
});
export type DateRange = z.infer<typeof DateRangeSchema>;
export const WeekStartsOnSchema = z.custom<Day>();
export type WeekStartsOn = z.infer<typeof WeekStartsOnSchema>; // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
export const WeekDaySchema = z.custom<Day>();
export type WeekDay = z.infer<typeof WeekDaySchema>; // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
const _monthDayOptions = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31,
] as const;
export type MonthDay = (typeof _monthDayOptions)[number];
export const MonthDaySchema = z.custom<MonthDay>();
const _monthDayModeOptions = ['skip', 'last'] as const;
const MonthDayModeSchema = z.enum(_monthDayModeOptions);
export type MonthDayMode = (typeof _monthDayModeOptions)[number];

const _nthWeekdayOfMonthOptions = [1, 2, 3, 4, 'last'] as const;
export type NthWeekdayOfMonth = (typeof _nthWeekdayOfMonthOptions)[number];
export const NthWeekdayOfMonthSchema = z.custom<NthWeekdayOfMonth>();
const _nthWeekdayConfigSchema = z.object({
  weekday: WeekDaySchema,
  nth: NthWeekdayOfMonthSchema,
});
const NthWeekdayConfigSchema = z.custom<NthWeekdayConfig>();
export type NthWeekdayConfig = z.infer<typeof _nthWeekdayConfigSchema>;
export type Condition = boolean | ((date: Date) => boolean);
const ConditionSchema = z.custom<Condition>().refine(
  (val): val is Condition => {
    // Allow boolean values
    if (typeof val === 'boolean') {
      return true;
    }

    // Check if it's a function
    if (typeof val !== 'function') {
      return false;
    }

    try {
      // Test the function with a sample date to ensure it accepts Date and returns boolean
      const testDate = new Date('2025-01-01T00:00:00.000Z');
      const result = val(testDate);
      return typeof result === 'boolean';
    } catch {
      // If the function throws or doesn't work properly, it's invalid
      return false;
    }
  },
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
export const TimesOfDaySchema = z.array(TimeOfDaySchema).min(1);
export type TimesOfDay = z.infer<typeof TimesOfDaySchema>;
export const QuickurrenceOptionsSchema = z.object({
  startDate: z.date().optional(),
  rule: RecurrenceRuleSchema.optional(),
  timezone: z.string().optional(),
  interval: IntervalSchema.optional(),
  endDate: z.date().optional(),
  count: CountSchema.optional(),
  weekStartsOn: WeekStartsOnSchema.optional(),
  weekDays: z.array(WeekDaySchema).optional(),
  monthDay: MonthDaySchema.optional(),
  monthDayMode: MonthDayModeSchema.optional(),
  nthWeekdayOfMonth: NthWeekdayConfigSchema.optional(),
  excludeDates: z.array(z.date()).optional(),
  condition: ConditionSchema.optional(),
  preset: PresetSchema.optional(),
  timesOfDay: TimesOfDaySchema.optional(),
});
export type QuickurrenceOptions = z.infer<typeof QuickurrenceOptionsSchema>;

const MAX_NEXT_OCCURENCES = 1000;

export {
  QuickurrenceError,
  QuickurrenceErrorCode,
  QuickurrenceErrorType,
  type QuickurrenceErrorContext,
} from './error';
export { QuickurrenceMerge } from './merge';
export { QuickurrenceValidator } from './validator';

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

  /**
   * Create or update Quickurrence options from state
   */
  static update(
    quickurrenceOptions: QuickurrenceOptions,
    updates: Partial<QuickurrenceOptions>,
  ): QuickurrenceOptions | null {
    // Apply preset configuration if specified in updates
    let baseUpdates: Partial<QuickurrenceOptions>;
    if (updates.preset) {
      const presetOptions = Quickurrence.presetToOptions(updates.preset);
      // Preset defines the core rule pattern, user can only override compatible options
      baseUpdates = {
        ...updates, // Start with user updates
        ...presetOptions, // Preset options override conflicting user updates
      };
    } else {
      baseUpdates = { ...updates };
    }

    const newOptions = { ...quickurrenceOptions, ...baseUpdates };

    if (newOptions.rule === undefined) {
      return null;
    }

    // Clean the options to remove incompatible combinations
    const cleanedOptions = Quickurrence.clean(newOptions);

    const timezone = cleanedOptions.timezone ?? 'UTC';
    const defaultStartDate =
      cleanedOptions.startDate || new TZDate(new Date(), timezone);
    const updatedStartDate = startOfDay(defaultStartDate, { in: tz(timezone) });
    const options: QuickurrenceOptions = {
      startDate: updatedStartDate,
      rule: cleanedOptions.rule,
      timezone,
    };

    if (cleanedOptions.interval !== undefined && cleanedOptions.interval > 1) {
      options.interval = cleanedOptions.interval;
    }

    if (cleanedOptions.endDate) {
      options.endDate = cleanedOptions.endDate;
    }

    if (cleanedOptions.count !== undefined && cleanedOptions.count > 0) {
      options.count = cleanedOptions.count;
    }

    if (cleanedOptions.weekDays && cleanedOptions.weekDays.length > 0) {
      options.weekDays = cleanedOptions.weekDays;
    }

    if (cleanedOptions.monthDay !== undefined) {
      options.monthDay = cleanedOptions.monthDay;
      if (cleanedOptions.monthDayMode) {
        options.monthDayMode = cleanedOptions.monthDayMode;
      }
    }

    if (cleanedOptions.nthWeekdayOfMonth) {
      options.nthWeekdayOfMonth = cleanedOptions.nthWeekdayOfMonth;
    }

    if (cleanedOptions.excludeDates && cleanedOptions.excludeDates.length > 0) {
      options.excludeDates = cleanedOptions.excludeDates;
    }

    if (cleanedOptions.preset) {
      options.preset = cleanedOptions.preset;
    }

    if (cleanedOptions.condition !== undefined) {
      options.condition = cleanedOptions.condition;
    }

    if (cleanedOptions.timesOfDay && cleanedOptions.timesOfDay.length > 0) {
      options.timesOfDay = [...cleanedOptions.timesOfDay];
    }

    // Validate the options against the schema
    const validationResult = QuickurrenceOptionsSchema.safeParse(options);
    if (!validationResult.success) {
      console.error(
        'Invalid QuickurrenceOptions created:',
        validationResult.error,
      );
      throw new Error(
        `Invalid quickurrence options: ${validationResult.error.message}`,
      );
    }

    return validationResult.data;
  }

  constructor(options: QuickurrenceOptions = {}) {
    // Apply preset configuration if specified
    let baseOptions: QuickurrenceOptions;
    if (options.preset) {
      const presetOptions = Quickurrence.presetToOptions(options.preset);
      // Preset defines the core rule pattern, user can only override compatible options
      baseOptions = {
        ...options, // Start with user options
        ...presetOptions, // Preset options override conflicting user options
      };
    } else {
      baseOptions = { ...options };
    }

    // Set defaults for optional fields
    const timezone = baseOptions.timezone || 'UTC';
    const defaultStartDate =
      baseOptions.startDate || new TZDate(new Date(), timezone);
    const defaultRule = baseOptions.rule || 'daily';
    // Create options with defaults
    const optionsWithDefaults = {
      ...baseOptions,
      startDate: startOfDay(defaultStartDate, { in: tz(timezone) }),
      rule: defaultRule,
      timezone,
    };

    // Validate all options (including defaults)
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
      monthDayMode = 'last', // Default to last
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
      : undefined; // Copy the config
    this.timesOfDay = timesOfDay
      ? [...new Set(timesOfDay)].sort()
      : undefined;
    this.excludeDates = excludeDates
      ? excludeDates.map((date) =>
          this.timesOfDay
            ? new Date(date)
            : startOfDay(date, { in: tz(timezone) }),
        )
      : undefined;
    this.preset = preset;
    this.condition = condition;

    // Normalize end date to start of day if provided (preserve exact time when timesOfDay is set)
    if (endDate) {
      this.endDate = this.timesOfDay
        ? new Date(endDate)
        : startOfDay(endDate, { in: tz(timezone) });
    }
  }

  /**
   * Get the next occurrence after the given date
   */
  getNextOccurrence(after: Date = new Date()): Date {
    if (this.timesOfDay) {
      return this.getNextOccurrenceWithTimes(after);
    }
    return this.getNextOccurrenceByDay(after);
  }

  /**
   * Day-level next-occurrence path (no time-of-day expansion).
   */
  private getNextOccurrenceByDay(after: Date = new Date()): Date {
    // Special handling for weekly recurrence with weekDays
    if (this.rule === 'weekly' && this.weekDays) {
      return this.getNextWeeklyOccurrenceWithWeekDays(after);
    }

    // Special handling for monthly recurrence with monthDay
    if (this.rule === 'monthly' && this.monthDay !== undefined) {
      return this.getNextMonthlyOccurrenceWithSpecificDay(after);
    }

    // Special handling for monthly recurrence with nthWeekdayOfMonth
    if (this.rule === 'monthly' && this.nthWeekdayOfMonth) {
      return this.getNextMonthlyOccurrenceWithNthWeekday(after);
    }

    const afterNormalized = startOfDay(after, { in: tz(this.timezone) });

    // Check count limit by generating all occurrences up to the after date
    if (this.count !== undefined) {
      const allOccurrences = this.getAllOccurrences({
        start: this.startDate,
        end: addYears(afterNormalized, 10, { in: tz(this.timezone) }), // Look ahead enough to find all count occurrences
      });

      // Find the next occurrence after the given date
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

    // If the start date is after the 'after' date and should be included, return the start date
    if (
      isAfter(this.startDate, afterNormalized) &&
      this.shouldIncludeDate(this.startDate)
    ) {
      return this.startDate;
    }

    // Calculate the next occurrence based on the rule
    let current = new Date(this.startDate);
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

      // If we've exceeded the end date, throw error
      if (this.endDate && isAfter(current, this.endDate)) {
        throw QuickurrenceError.runtime(
          'No more occurrences within the specified end date',
          QuickurrenceErrorCode.END_DATE_EXCEEDED,
          {
            operation: 'getNextOccurrence',
            details: { endDate: this.endDate, currentDate: current },
          },
        );
      }
    }

    // Final check: ensure current doesn't exceed end date
    if (this.endDate && isAfter(current, this.endDate)) {
      throw QuickurrenceError.runtime(
        'No more occurrences within the specified end date',
        QuickurrenceErrorCode.END_DATE_EXCEEDED,
        {
          operation: 'getNextOccurrence',
          details: { endDate: this.endDate, currentDate: current },
        },
      );
    }

    return current;
  }

  /**
   * Get all occurrences within the given date range
   */
  getAllOccurrences(range: DateRange): Date[] {
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
    // Special handling for weekly recurrence with weekDays
    if (this.rule === 'weekly' && this.weekDays) {
      return this.getAllWeeklyOccurrencesWithWeekDays(range);
    }

    // Special handling for monthly recurrence with monthDay
    if (this.rule === 'monthly' && this.monthDay !== undefined) {
      return this.getAllMonthlyOccurrencesWithSpecificDay(range);
    }

    // Special handling for monthly recurrence with nthWeekdayOfMonth
    if (this.rule === 'monthly' && this.nthWeekdayOfMonth) {
      return this.getAllMonthlyOccurrencesWithNthWeekday(range);
    }

    const occurrences: Date[] = [];
    const startNormalized = startOfDay(range.start, { in: tz(this.timezone) });
    const rangeEndNormalized = startOfDay(range.end, { in: tz(this.timezone) });

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    // Start from the first occurrence that's not before the range start
    let current = this.startDate;

    // If start date is before the range, find the first occurrence in range
    if (isBefore(current, startNormalized)) {
      current = this.getNextOccurrenceByDay(
        new Date(startNormalized.getTime() - 1),
      );
    }

    // Collect all occurrences within the range
    while (
      isBefore(current, effectiveEndDate) ||
      isEqual(current, effectiveEndDate)
    ) {
      if (
        isAfter(current, startNormalized) ||
        isEqual(current, startNormalized)
      ) {
        // Check if the occurrence should be included
        if (this.shouldIncludeDate(current)) {
          occurrences.push(new Date(current));

          // Stop if we've reached the count limit
          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }
      current = this.getNextDate(current);

      // Safety check to prevent infinite loops
      if (occurrences.length > MAX_NEXT_OCCURENCES) {
        break;
      }
    }

    return occurrences;
  }

  /**
   * Get the start date of this rule
   */
  getStartDate(): Date {
    return new Date(this.startDate);
  }

  /**
   * Check if a date is excluded
   */
  private isDateExcluded(date: Date): boolean {
    if (!this.excludeDates || this.excludeDates.length === 0) {
      return false;
    }

    // When timesOfDay is set, exclusions match exact datetime; otherwise match day.
    const target = this.timesOfDay
      ? date
      : startOfDay(date, { in: tz(this.timezone) });
    return this.excludeDates.some((excludeDate) =>
      isEqual(excludeDate, target),
    );
  }

  /**
   * Expand a day-level date into datetimes for each configured time-of-day.
   * Returns the input as-is if timesOfDay is not configured.
   */
  private expandDayWithTimes(day: Date): Date[] {
    if (!this.timesOfDay || this.timesOfDay.length === 0) {
      return [day];
    }
    const dayStart = startOfDay(day, { in: tz(this.timezone) });
    const opts = { in: tz(this.timezone) } as const;
    return this.timesOfDay
      .map((t) => {
        const [hh, mm] = t.split(':').map(Number);
        let d = setHours(dayStart, hh, opts);
        d = setMinutes(d, mm, opts);
        d = setSeconds(d, 0, opts);
        d = setMilliseconds(d, 0, opts);
        return d;
      })
      .sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Time-aware variant of getAllOccurrences. Collects days via the existing
   * day-level branches, expands each into datetimes, then filters/caps.
   */
  private getAllOccurrencesWithTimes(range: DateRange): Date[] {
    const dayRange: DateRange = {
      start: startOfDay(range.start, { in: tz(this.timezone) }),
      end: startOfDay(range.end, { in: tz(this.timezone) }),
    };
    const days = this.collectDayOccurrences(dayRange);
    let datetimes = days.flatMap((d) => this.expandDayWithTimes(d));
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
    return this.count !== undefined ? dedup.slice(0, this.count) : dedup;
  }

  /**
   * Time-aware variant of getNextOccurrence.
   */
  private getNextOccurrenceWithTimes(after: Date): Date {
    const windowStartReference = isAfter(after, this.startDate)
      ? after
      : this.startDate;
    const range: DateRange = {
      start: this.startDate,
      end: addYears(windowStartReference, 10, { in: tz(this.timezone) }),
    };
    const all = this.getAllOccurrencesWithTimes(range);
    for (const occ of all) {
      if (isAfter(occ, after)) {
        return occ;
      }
    }
    if (this.count !== undefined) {
      throw QuickurrenceError.runtime(
        'No more occurrences within the specified count limit',
        QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
        {
          operation: 'getNextOccurrence',
          details: { countLimit: this.count },
        },
      );
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
   * Check if a date meets the condition
   */
  private meetsCondition(date: Date): boolean {
    if (this.condition === undefined) {
      return true;
    }

    if (typeof this.condition === 'boolean') {
      return this.condition;
    }

    // Normalize the date to start of day in the specified timezone before passing to condition function
    const normalizedDate = startOfDay(date, { in: tz(this.timezone) });
    return this.condition(normalizedDate);
  }

  /**
   * Check if a date should be included (not excluded and meets condition)
   */
  private shouldIncludeDate(date: Date): boolean {
    return !this.isDateExcluded(date) && this.meetsCondition(date);
  }

  /**
   * Get the recurrence rule
   */
  getRule(): RecurrenceRule {
    return this.rule;
  }

  /**
   * Get the end date of this rule (if set)
   */
  getEndDate(): Date | undefined {
    return this.endDate ? new Date(this.endDate) : undefined;
  }

  /**
   * Get the original options used to create this instance
   */
  getOptions(): QuickurrenceOptions {
    return structuredClone(this.options);
  }

  /**
   * Get the week starts on setting
   */
  getWeekStartsOn(): WeekStartsOn {
    return this.weekStartsOn;
  }

  /**
   * Get the weekDays setting for weekly recurrence
   */
  getWeekDays(): WeekDay[] | undefined {
    return this.weekDays ? [...this.weekDays] : undefined;
  }

  /**
   * Get the monthDay setting for monthly recurrence
   */
  getMonthDay(): MonthDay | undefined {
    return this.monthDay;
  }

  /**
   * Get the monthDayMode setting for monthly recurrence
   */
  getMonthDayMode(): MonthDayMode {
    return this.monthDayMode;
  }

  /**
   * Get the nthWeekdayOfMonth setting for monthly recurrence
   */
  getNthWeekdayOfMonth(): NthWeekdayConfig | undefined {
    return this.nthWeekdayOfMonth ? { ...this.nthWeekdayOfMonth } : undefined;
  }

  /**
   * Get the count setting for recurrence
   */
  getCount(): number | undefined {
    return this.count;
  }

  /**
   * Get the excludeDates setting for recurrence
   */
  getExcludeDates(): Date[] | undefined {
    return this.excludeDates
      ? this.excludeDates.map((date) => new Date(date))
      : undefined;
  }

  /**
   * Get the condition setting for recurrence
   */
  getCondition(): boolean | ((date: Date) => boolean) | undefined {
    return this.condition;
  }

  /**
   * Get the preset setting for recurrence
   */
  getPreset(): Preset | undefined {
    return this.preset;
  }

  /**
   * Get the timesOfDay setting for recurrence
   */
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
        throw new Error(`Unknown preset: ${preset}`);
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

    // Clean weekly-only options for non-weekly rules
    if (cleaned.rule !== 'weekly') {
      delete cleaned.weekDays;
    }

    // Clean monthly-only options for non-monthly rules
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

    // Clean empty arrays
    if (cleaned.weekDays && cleaned.weekDays.length === 0) {
      delete cleaned.weekDays;
    }

    if (cleaned.excludeDates && cleaned.excludeDates.length === 0) {
      delete cleaned.excludeDates;
    }

    if (cleaned.timesOfDay && cleaned.timesOfDay.length === 0) {
      delete cleaned.timesOfDay;
    }

    // Remove default values to keep options clean
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

      // Check if it matches business days (Monday-Friday)
      const businessDays = [1, 2, 3, 4, 5];
      if (this.areArraysEqual(weekDays, businessDays)) {
        return 'businessDays';
      }

      // Check if it matches weekends (Saturday-Sunday)
      const weekendDays = [0, 6];
      if (this.areArraysEqual(weekDays, weekendDays)) {
        return 'weekends';
      }
    }

    return undefined;
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
    return startOfDay(nextDate, { in: tz(this.timezone) });
  }

  private getNextDaily(current: Date): Date {
    return addDays(current, this.interval, { in: tz(this.timezone) });
  }

  private getDay(date: Date): Day {
    return getDay(date, { in: tz(this.timezone) }) as Day;
  }

  private static areArraysEqual<T>(array1: T[], array2: T[]): boolean {
    return (
      array1.every((item) => array2.includes(item)) &&
      array1.length === array2.length
    );
  }

  private getNextWeekly(current: Date): Date {
    if (!this.weekDays) {
      // Traditional weekly recurrence: simply add weeks to the current date
      return addWeeks(current, this.interval, { in: tz(this.timezone) });
    }

    // When weekDays is specified, find the next occurrence on any of the specified days
    const currentWeekday = this.getDay(current);
    const currentWeekdayIndex = this.weekDays.indexOf(currentWeekday);

    // Check if there's a later weekday in the same week
    if (
      currentWeekdayIndex >= 0 &&
      currentWeekdayIndex < this.weekDays.length - 1
    ) {
      // Find the next weekday in the same week
      const nextWeekday = this.weekDays[currentWeekdayIndex + 1];
      QuickurrenceValidator.validateWeekdayValue(nextWeekday);
      return this.getNextWeekdayOccurrence(
        addDays(current, 1, { in: tz(this.timezone) }),
        nextWeekday,
      );
    }

    // Move to the next interval week and find the first specified weekday
    const nextWeekStart = addWeeks(current, this.interval, {
      in: tz(this.timezone),
    });
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
    return addMonths(current, this.interval, { in: tz(this.timezone) });
  }

  private getNextYearly(current: Date): Date {
    return addYears(current, this.interval, { in: tz(this.timezone) });
  }

  /**
   * Get the next monthly occurrence with a specific day of the month
   */
  private getNextMonthlyWithSpecificDay(current: Date): Date {
    const targetDay = this.monthDay!; // Direct use of 1-31
    const currentMonth = new Date(current);
    const normalizedCurrent = startOfDay(current, { in: tz(this.timezone) });

    // First, try to find the target day in the current month if it's after the current date
    let normalizedTargetThisMonth: Date;
    if (this.timezone === 'UTC') {
      normalizedTargetThisMonth = new Date(
        Date.UTC(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          targetDay,
        ),
      );
    } else {
      const targetDateThisMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        targetDay,
      );
      normalizedTargetThisMonth = startOfDay(targetDateThisMonth, {
        in: tz(this.timezone),
      });
    }

    // If the target day exists in the current month and is STRICTLY after the current date, use it
    if (
      targetDay <= getDaysInMonth(currentMonth, { in: tz(this.timezone) }) &&
      isAfter(normalizedTargetThisMonth, normalizedCurrent)
    ) {
      return normalizedTargetThisMonth;
    }

    // Otherwise, find next month with target day (always move forward)
    // Start from the next interval month
    let nextMonth = addMonths(currentMonth, this.interval, {
      in: tz(this.timezone),
    });
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops

    while (attempts < maxAttempts) {
      const daysInTargetMonth = getDaysInMonth(nextMonth, {
        in: tz(this.timezone),
      });

      // If the target day exists in this month, use it
      if (targetDay <= daysInTargetMonth) {
        if (this.timezone === 'UTC') {
          return new Date(
            Date.UTC(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay),
          );
        } else {
          const targetDate = new Date(
            nextMonth.getFullYear(),
            nextMonth.getMonth(),
            targetDay,
          );
          return startOfDay(targetDate, { in: tz(this.timezone) });
        }
      }

      // Handle the case where target day doesn't exist
      if (this.monthDayMode === 'last') {
        // Use the last day of the month
        const lastDay = lastDayOfMonth(nextMonth, { in: tz(this.timezone) });
        return startOfDay(lastDay, { in: tz(this.timezone) });
      }

      // Skip mode: move to next month
      nextMonth = addMonths(nextMonth, this.interval, {
        in: tz(this.timezone),
      });
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

  /**
   * Get all monthly occurrences with specific day within the given date range
   */
  private getAllMonthlyOccurrencesWithSpecificDay(range: DateRange): Date[] {
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
    const startNormalized = startOfDay(range.start, { in: tz(this.timezone) });
    const rangeEndNormalized = startOfDay(range.end, { in: tz(this.timezone) });

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    // Start from the rule's start date month
    let monthCounter = 0;
    let currentMonthStart = new Date(this.startDate);

    // Generate occurrences month by month with proper intervals
    while (currentMonthStart <= effectiveEndDate) {
      // Get the target day occurrence in this month
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

          // Stop if we've reached the count limit
          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }

      // Move to the next interval month
      monthCounter++;
      currentMonthStart = addMonths(
        this.startDate,
        monthCounter * this.interval,
        { in: tz(this.timezone) },
      );

      // Safety check to prevent infinite loops
      if (occurrences.length > MAX_NEXT_OCCURENCES || monthCounter > 120) {
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
    const daysInMonth = getDaysInMonth(monthDate, { in: tz(this.timezone) });

    // If the target day exists in this month, use it
    if (targetDay <= daysInMonth) {
      // Create date in the same timezone as the input monthDate
      if (this.timezone === 'UTC') {
        // For UTC, create date directly
        return new Date(
          Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), targetDay),
        );
      } else {
        // For other timezones, use startOfDay with timezone
        const targetDate = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth(),
          targetDay,
        );
        return startOfDay(targetDate, { in: tz(this.timezone) });
      }
    }

    // Handle the case where target day doesn't exist
    if (this.monthDayMode === 'last') {
      // Use the last day of the month
      const lastDay = lastDayOfMonth(monthDate, { in: tz(this.timezone) });
      return startOfDay(lastDay, { in: tz(this.timezone) });
    }

    // Skip mode: return null to skip this month
    return null;
  }

  /**
   * Get the next monthly occurrence with specific day after the given date
   */
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

    const afterNormalized = startOfDay(after, { in: tz(this.timezone) });

    // Check count limit by generating all occurrences up to the after date
    if (this.count !== undefined) {
      const allOccurrences = this.getAllMonthlyOccurrencesWithSpecificDay({
        start: this.startDate,
        end: addMonths(afterNormalized, 200, { in: tz(this.timezone) }), // Look ahead enough to find all count occurrences
      });

      // Find the next occurrence after the given date
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

    // If the start date is after the 'after' date, check if it matches our monthDay
    if (isAfter(this.startDate, afterNormalized)) {
      const startOccurrence = this.getMonthDayOccurrence(this.startDate);
      if (
        startOccurrence &&
        isAfter(startOccurrence, afterNormalized)
      ) {
        return startOccurrence;
      }
    }

    // Generate all monthly occurrences in a reasonable range and find the next one
    const range = {
      start: afterNormalized,
      end: addMonths(afterNormalized, 100, { in: tz(this.timezone) }), // Look ahead 100 months to find next occurrence
    };

    const allOccurrences = this.getAllMonthlyOccurrencesWithSpecificDay(range);

    // Find the first occurrence after the 'after' date
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

    return nextDay(date, targetWeekday, { in: tz(this.timezone) });
  }

  /**
   * Get all occurrences of specified weekdays in the week containing the given date
   */
  private getWeekdaysInWeek(weekStartDate: Date, weekdays: WeekDay[]): Date[] {
    const occurrences: Date[] = [];

    // For each target weekday, calculate its date in this week
    for (const targetWeekday of weekdays) {
      // Calculate days to add to get to the target weekday
      // weekStartDate is the reference point for this week
      const weekStartDay = this.getDay(weekStartDate);
      let daysToAdd = targetWeekday - weekStartDay;

      // Adjust if the target day is in the previous week
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }

      const targetDate = addDays(weekStartDate, daysToAdd, {
        in: tz(this.timezone),
      });
      occurrences.push(startOfDay(targetDate, { in: tz(this.timezone) }));
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get all weekly occurrences with specific weekdays within the given date range
   */
  private getAllWeeklyOccurrencesWithWeekDays(range: DateRange): Date[] {
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
    const startNormalized = startOfDay(range.start, { in: tz(this.timezone) });
    const rangeEndNormalized = startOfDay(range.end, { in: tz(this.timezone) });

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    // Start from the aligned week that contains the rule's start date
    const baseWeekStart = startOfWeek(this.startDate, {
      weekStartsOn: this.weekStartsOn,
      in: tz(this.timezone),
    });
    let weekCounter = 0;
    let currentWeekStart = baseWeekStart;

    // Generate occurrences week by week with proper intervals
    while (currentWeekStart <= effectiveEndDate) {
      // Get all weekday occurrences in this week
      const weekOccurrences = this.getWeekdaysInWeek(
        currentWeekStart,
        this.weekDays,
      );

      // Filter occurrences to only include those within the range and constraints
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

          // Stop if we've reached the count limit
          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }

      // Stop if we've reached the count limit (break out of outer loop too)
      if (this.count && occurrences.length >= this.count) {
        break;
      }

      // Move to the next interval week
      weekCounter++;
      currentWeekStart = addWeeks(baseWeekStart, weekCounter * this.interval, {
        in: tz(this.timezone),
      });

      // Safety check to prevent infinite loops
      if (occurrences.length > MAX_NEXT_OCCURENCES) {
        break;
      }
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get the next weekly occurrence with specific weekdays after the given date
   */
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

    const afterNormalized = startOfDay(after, { in: tz(this.timezone) });
    // Check count limit by generating all occurrences up to the after date
    if (this.count !== undefined) {
      const allOccurrences = this.getAllWeeklyOccurrencesWithWeekDays({
        start: this.startDate,
        end: addWeeks(afterNormalized, 200, { in: tz(this.timezone) }), // Look ahead enough to find all count occurrences
      });
      // Find the next occurrence after the given date
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

    // If the start date is after the 'after' date, check if it matches any of our weekdays
    if (isAfter(this.startDate, afterNormalized)) {
      const startWeekday = this.getDay(this.startDate);
      if (this.weekDays.includes(startWeekday)) {
        return this.startDate;
      }
    }
    // Generate all weekly occurrences in a reasonable range and find the next one
    const range = {
      start: afterNormalized,
      end: addWeeks(afterNormalized, 100, { in: tz(this.timezone) }), // Look ahead 100 weeks to find next occurrence
    };
    const allOccurrences = this.getAllWeeklyOccurrencesWithWeekDays(range);
    // Find the first occurrence after the 'after' date
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

  /**
   * Calculate the nth occurrence of a specific weekday in a month
   */
  private getNthWeekdayInMonth(
    monthDate: Date,
    weekday: WeekDay,
    nth: NthWeekdayOfMonth,
  ): Date | null {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Handle 'last' case
    if (nth === 'last') {
      // Start from the last day of the month and work backward
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = daysInMonth; day >= 1; day--) {
        const testDate =
          this.timezone === 'UTC'
            ? new Date(Date.UTC(year, month, day))
            : new Date(year, month, day);
        if (this.getDay(testDate) === weekday) {
          return startOfDay(testDate, { in: tz(this.timezone) });
        }
      }
      return null;
    }

    // Handle 1st, 2nd, 3rd, 4th cases
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const testDate =
        this.timezone === 'UTC'
          ? new Date(Date.UTC(year, month, day))
          : new Date(year, month, day);
      if (this.getDay(testDate) === weekday) {
        count++;
        if (count === nth) {
          return startOfDay(testDate, { in: tz(this.timezone) });
        }
      }
    }

    return null; // nth occurrence doesn't exist in this month
  }

  /**
   * Get all monthly occurrences with nth weekday within the given date range
   */
  private getAllMonthlyOccurrencesWithNthWeekday(range: DateRange): Date[] {
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
    const startNormalized = startOfDay(range.start, { in: tz(this.timezone) });
    const rangeEndNormalized = startOfDay(range.end, { in: tz(this.timezone) });

    // Use the earliest end date: either the range end or the rule's end date
    const effectiveEndDate =
      this.endDate && isBefore(this.endDate, rangeEndNormalized)
        ? this.endDate
        : rangeEndNormalized;

    // Start from the rule's start date month
    let monthCounter = 0;
    let currentMonthStart = new Date(this.startDate);

    // Generate occurrences month by month with proper intervals
    while (currentMonthStart <= effectiveEndDate) {
      // Get the nth weekday occurrence in this month
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

          // Stop if we've reached the count limit
          if (this.count && occurrences.length >= this.count) {
            break;
          }
        }
      }

      // Move to the next interval month
      monthCounter++;
      currentMonthStart = addMonths(
        this.startDate,
        monthCounter * this.interval,
        { in: tz(this.timezone) },
      );

      // Safety check to prevent infinite loops
      if (occurrences.length > MAX_NEXT_OCCURENCES || monthCounter > 120) {
        break;
      }
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get the next monthly occurrence with nth weekday after the given date
   */
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

    const afterNormalized = startOfDay(after, { in: tz(this.timezone) });

    // Check count limit by generating all occurrences up to the after date
    if (this.count !== undefined) {
      const allOccurrences = this.getAllMonthlyOccurrencesWithNthWeekday({
        start: this.startDate,
        end: addMonths(afterNormalized, 200, { in: tz(this.timezone) }), // Look ahead enough to find all count occurrences
      });

      // Find the next occurrence after the given date
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

    // If the start date is after the 'after' date, check if it matches our nth weekday
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

    // Generate all monthly occurrences in a reasonable range and find the next one
    const range = {
      start: afterNormalized,
      end: addMonths(afterNormalized, 100, { in: tz(this.timezone) }), // Look ahead 100 months to find next occurrence
    };

    const allOccurrences = this.getAllMonthlyOccurrencesWithNthWeekday(range);

    // Find the first occurrence after the 'after' date
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
    const currentMonth = new Date(current);
    const normalizedCurrent = startOfDay(current, { in: tz(this.timezone) });

    // First, try to find the nth weekday in the current month if it's after the current date
    const targetThisMonth = this.getNthWeekdayInMonth(
      currentMonth,
      weekday,
      nth,
    );

    // If the target exists in the current month and is STRICTLY after the current date, use it
    if (targetThisMonth && isAfter(targetThisMonth, normalizedCurrent)) {
      return targetThisMonth;
    }

    // Otherwise, find next month with nth weekday (always move forward)
    // Start from the next interval month
    let nextMonth = addMonths(currentMonth, this.interval, {
      in: tz(this.timezone),
    });
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

      // Move to next interval month
      nextMonth = addMonths(nextMonth, this.interval, {
        in: tz(this.timezone),
      });
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

      // Build frequency text
      if (this.interval === 1) {
        text = Quickurrence.capitalize(this.rule);
      } else {
        text = `Every ${this.interval} ${this.rule === 'daily' ? 'days' : this.rule === 'weekly' ? 'weeks' : this.rule === 'monthly' ? 'months' : 'years'}`;
      }

      // Add specific day information
      if (this.rule === 'weekly' && this.weekDays && this.weekDays.length > 0) {
        const dayNames = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        // Sort weekdays for display with Saturday before Sunday
        const sortedWeekDays = Quickurrence.sortWeekDaysForDisplay(
          this.weekDays,
        );
        const dayLabels = sortedWeekDays.map((day) => dayNames[day]).join(', ');
        text += ` on ${dayLabels}`;
      }

      if (this.rule === 'monthly' && this.monthDay) {
        text += ` on the ${Quickurrence.getOrdinalDay(this.monthDay)}`;
      }

      if (this.rule === 'monthly' && this.nthWeekdayOfMonth) {
        const dayNames = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const nthText =
          this.nthWeekdayOfMonth.nth === 'last'
            ? 'last'
            : Quickurrence.getOrdinalNumber(
                this.nthWeekdayOfMonth.nth as number,
              );
        text += ` on the ${nthText} ${dayNames[this.nthWeekdayOfMonth.weekday]}`;
      }

      // Add times-of-day information
      if (this.timesOfDay && this.timesOfDay.length > 0) {
        text += ` at ${this.timesOfDay.join(', ')}`;
      }

      // Add preset information
      if (this.preset === 'businessDays') {
        text += ' (business days only)';
      } else if (this.preset === 'weekends') {
        text += ' (weekends only)';
      }

      // Add end condition
      if (this.count) {
        text += `, ${this.count} times`;
      } else if (this.endDate) {
        text += ` until ${this.endDate.toLocaleDateString()}`;
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
    // Clean the options to remove incompatible combinations before creating instance
    const cleanedOptions = Quickurrence.clean(quickurrenceOptions);
    return new Quickurrence(cleanedOptions).toHumanText();
  }

  /**
   * Capitalize the first letter of a string
   */
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
