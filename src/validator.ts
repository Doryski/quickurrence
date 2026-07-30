import { isBefore } from './compare';
// The option arrays and `isOneOf` come from the shared internal module rather
// than being restated, so this validator and the zod schemas in `./index`
// accept exactly the same values. Restating them is what let the two layers
// drift apart. Sourcing them from `./options` instead of `./index` also keeps
// the only edge to `./index` type-only, so there is no runtime import cycle.
import {
  dayOptions,
  isOneOf,
  monthDayModeOptions,
  monthDayOptions,
  nthWeekdayOfMonthOptions,
  presetOptions,
  recurrenceRulesOptions,
} from './options';
import type {
  Condition,
  RecurrenceRule,
  WeekDay,
  MonthDay,
  NthWeekdayConfig,
  Preset,
  QuickurrenceOptions,
} from './index';
import { QuickurrenceError, QuickurrenceErrorCode } from './error';

export class QuickurrenceValidator {
  /**
   * Validate all options for a Quickurrence instance
   */
  static validateOptions(options: QuickurrenceOptions): void {
    const {
      rule,
      startDate,
      timezone,
      interval,
      endDate,
      weekStartsOn,
      weekDays,
      monthDay,
      monthDayMode,
      nthWeekdayOfMonth,
      count,
      excludeDates,
      condition,
      preset,
    } = options;

    this.validateStartDate(startDate);
    this.validateRule(rule);

    this.validateTimezone(timezone);
    this.validateInterval(interval);
    this.validateWeekStartsOn(weekStartsOn);
    this.validateEndDate(startDate, endDate);
    this.validateCount(count);
    this.validateExcludeDates(excludeDates);
    this.validateCondition(condition);
    this.validatePreset(preset);
    this.validateTimesOfDay(options.timesOfDay);

    this.validateWeeklyOptions(rule, weekDays);
    this.validateMonthlyOptions(
      rule,
      monthDay,
      monthDayMode,
      nthWeekdayOfMonth,
    );

    this.validateMutualExclusions(
      monthDay,
      nthWeekdayOfMonth,
      count,
      endDate,
      condition,
      preset,
    );
  }

  /**
   * Validate weekDays option is only used with weekly recurrence and has valid values
   */
  private static validateWeeklyOptions(
    rule: RecurrenceRule | undefined,
    weekDays: WeekDay[] | undefined,
  ): void {
    if (weekDays === undefined) return;

    if (rule !== undefined && rule !== 'weekly') {
      throw QuickurrenceError.configuration(
        'weekDays option is only valid for weekly recurrence',
        QuickurrenceErrorCode.INCOMPATIBLE_OPTIONS,
        {
          option: 'weekDays',
          rule,
          expected: 'weekly recurrence rule',
        },
      );
    }

    // Shape is checked even when no rule is given: the rule is optional, the
    // values are not, and the schema rejects them regardless of the rule.
    if (!Array.isArray(weekDays)) {
      throw QuickurrenceError.validation(
        'weekDays must be an array of weekday values',
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
        {
          option: 'weekDays',
          value: weekDays,
          expected: `Array of weekday values (${dayOptions.join(', ')})`,
        },
      );
    }

    if (weekDays.length === 0) {
      throw QuickurrenceError.validation(
        'weekDays cannot be empty when specified',
        QuickurrenceErrorCode.EMPTY_REQUIRED_ARRAY,
        {
          option: 'weekDays',
          value: weekDays,
          expected: 'Non-empty array of weekday values (0-6)',
        },
      );
    }

    const isWeekDay = isOneOf(dayOptions);
    const invalidDays = weekDays.filter((day) => !isWeekDay(day));
    if (invalidDays.length > 0) {
      throw QuickurrenceError.validation(
        `Invalid weekDays values: ${invalidDays.join(', ')}. Values must be between 0-6`,
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
        {
          option: 'weekDays',
          value: invalidDays,
          expected: 'Weekday values between 0-6',
        },
      );
    }

    const uniqueDays = [...new Set(weekDays)];
    if (uniqueDays.length !== weekDays.length) {
      throw QuickurrenceError.validation(
        'weekDays cannot contain duplicate values',
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
        {
          option: 'weekDays',
          value: weekDays,
          expected: 'Array with unique weekday values',
        },
      );
    }
  }

  /**
   * Validate monthly-specific options
   */
  private static validateMonthlyOptions(
    rule: RecurrenceRule | undefined,
    monthDay: MonthDay | undefined,
    monthDayMode: string | undefined,
    nthWeekdayOfMonth: NthWeekdayConfig | undefined,
  ): void {
    if (
      rule !== undefined &&
      rule !== 'monthly' &&
      (monthDay !== undefined || monthDayMode !== undefined)
    ) {
      throw QuickurrenceError.configuration(
        'monthDay and monthDayMode options are only valid for monthly recurrence',
        QuickurrenceErrorCode.INCOMPATIBLE_OPTIONS,
        {
          option: monthDay !== undefined ? 'monthDay' : 'monthDayMode',
          rule,
          expected: 'monthly recurrence rule',
        },
      );
    }

    // Value checks run whether or not a rule is given, matching the schema.
    if (monthDay !== undefined && !isOneOf(monthDayOptions)(monthDay)) {
      throw QuickurrenceError.validation(
        'monthDay must be between 1-31',
        QuickurrenceErrorCode.INVALID_MONTH_DAY,
        {
          option: 'monthDay',
          value: monthDay,
          expected: 'Integer between 1-31',
        },
      );
    }

    if (monthDayMode !== undefined) {
      this.validateMonthDayMode(monthDayMode);
    }

    if (nthWeekdayOfMonth !== undefined && rule !== undefined && rule !== 'monthly') {
      throw QuickurrenceError.configuration(
        'nthWeekdayOfMonth option is only valid for monthly recurrence',
        QuickurrenceErrorCode.INCOMPATIBLE_OPTIONS,
        {
          option: 'nthWeekdayOfMonth',
          rule,
          expected: 'monthly recurrence rule',
        },
      );
    }

    if (nthWeekdayOfMonth !== undefined) {
      this.validateNthWeekdayConfig(nthWeekdayOfMonth);
    }
  }

  /**
   * Validate nthWeekdayOfMonth configuration
   */
  private static validateNthWeekdayConfig(config: NthWeekdayConfig): void {
    if (config === null || typeof config !== 'object') {
      throw QuickurrenceError.validation(
        'nthWeekdayOfMonth must be an object with weekday and nth properties',
        QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
        {
          option: 'nthWeekdayOfMonth',
          value: config,
          expected: '{ weekday: 0-6, nth: 1 | 2 | 3 | 4 | "last" }',
        },
      );
    }

    const { weekday, nth } = config;

    if (!isOneOf(dayOptions)(weekday)) {
      throw QuickurrenceError.validation(
        `Invalid weekday in nthWeekdayOfMonth: ${weekday}. Weekday must be between 0-6`,
        QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
        {
          option: 'nthWeekdayOfMonth.weekday',
          value: weekday,
          expected: 'Weekday value between 0-6',
        },
      );
    }

    if (!isOneOf(nthWeekdayOfMonthOptions)(nth)) {
      throw QuickurrenceError.validation(
        `Invalid nth in nthWeekdayOfMonth: ${String(nth)}. Nth must be 1, 2, 3, 4, or 'last'`,
        QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
        {
          option: 'nthWeekdayOfMonth.nth',
          value: nth,
          expected: '1, 2, 3, 4, or "last"',
        },
      );
    }
  }

  /**
   * Validate mutual exclusions between options
   */
  private static validateMutualExclusions(
    monthDay?: MonthDay,
    nthWeekdayOfMonth?: NthWeekdayConfig,
    count?: number,
    endDate?: Date,
    condition?: Condition,
    preset?: Preset,
  ): void {
    if (monthDay !== undefined && nthWeekdayOfMonth) {
      throw QuickurrenceError.configuration(
        'Cannot use both monthDay and nthWeekdayOfMonth options. Choose one approach for monthly recurrence.',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        {
          details: { conflictingOptions: ['monthDay', 'nthWeekdayOfMonth'] },
        },
      );
    }

    if (count !== undefined && endDate !== undefined) {
      throw QuickurrenceError.configuration(
        'Cannot use both count and endDate options. Choose one approach to limit occurrences.',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        {
          details: { conflictingOptions: ['count', 'endDate'] },
        },
      );
    }

    if (preset !== undefined && condition !== undefined) {
      throw QuickurrenceError.configuration(
        'Cannot use both preset and condition options. Choose one approach for filtering occurrences.',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        {
          details: { conflictingOptions: ['preset', 'condition'] },
        },
      );
    }
  }

  /**
   * Validate count option
   */
  private static validateCount(count?: number): void {
    if (count === undefined) return;

    if (count <= 0 || !Number.isInteger(count)) {
      throw QuickurrenceError.validation(
        'count must be a positive integer',
        QuickurrenceErrorCode.INVALID_COUNT,
        {
          option: 'count',
          value: count,
          expected: 'Positive integer',
        },
      );
    }
  }

  /**
   * Validate excludeDates option
   */
  private static validateExcludeDates(excludeDates?: Date[]): void {
    if (excludeDates === undefined) return;

    if (!Array.isArray(excludeDates)) {
      throw QuickurrenceError.validation(
        'excludeDates must be an array of Date objects',
        QuickurrenceErrorCode.INVALID_EXCLUDE_DATES,
        {
          option: 'excludeDates',
          value: excludeDates,
          expected: 'Array of valid Date objects',
        },
      );
    }

    if (excludeDates.length === 0) {
      throw QuickurrenceError.validation(
        'excludeDates cannot be empty when specified',
        QuickurrenceErrorCode.EMPTY_REQUIRED_ARRAY,
        {
          option: 'excludeDates',
          value: excludeDates,
          expected: 'Non-empty array of Date objects',
        },
      );
    }

    const invalidDates = excludeDates.filter(
      (date) => !(date instanceof Date) || isNaN(date.getTime()),
    );
    if (invalidDates.length > 0) {
      throw QuickurrenceError.validation(
        'All excludeDates must be valid Date objects',
        QuickurrenceErrorCode.INVALID_EXCLUDE_DATES,
        {
          option: 'excludeDates',
          value: invalidDates,
          expected: 'Array of valid Date objects',
        },
      );
    }
  }

  /**
   * Validate rule option
   */
  private static validateRule(rule: RecurrenceRule | undefined): void {
    if (rule === undefined) return;

    if (!isOneOf(recurrenceRulesOptions)(rule)) {
      throw QuickurrenceError.configuration(
        `Unsupported recurrence rule: ${String(rule)}`,
        QuickurrenceErrorCode.UNSUPPORTED_RULE,
        {
          option: 'rule',
          value: rule,
          expected: `One of: ${recurrenceRulesOptions.join(', ')}`,
        },
      );
    }
  }

  /**
   * Validate preset option
   */
  private static validatePreset(preset?: Preset): void {
    if (preset === undefined) return;

    if (!isOneOf(presetOptions)(preset)) {
      throw QuickurrenceError.configuration(
        `Unsupported preset: ${String(preset)}`,
        QuickurrenceErrorCode.UNSUPPORTED_PRESET,
        {
          option: 'preset',
          value: preset,
          expected: `One of: ${presetOptions.join(', ')}`,
        },
      );
    }
  }

  /**
   * Validate individual weekday value at runtime
   */
  static validateWeekdayValue(
    weekday: WeekDay | undefined,
  ): asserts weekday is WeekDay {
    if (!weekday && weekday !== 0) {
      throw QuickurrenceError.validation(
        'Invalid weekday configuration',
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
        {
          value: weekday,
          expected: 'Valid weekday value (0-6)',
        },
      );
    }
  }

  /**
   * Validate endDate option
   */
  private static validateEndDate(
    startDate: Date | undefined,
    endDate: Date | undefined,
  ): void {
    if (!endDate) return;

    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      throw QuickurrenceError.validation(
        'endDate must be a valid Date object',
        QuickurrenceErrorCode.INVALID_END_DATE,
        {
          option: 'endDate',
          value: endDate,
          expected: 'Valid Date object',
        },
      );
    }

    if (startDate && isBefore(endDate, startDate)) {
      throw QuickurrenceError.dateTime(
        'End date cannot be before start date',
        QuickurrenceErrorCode.DATE_BEFORE_START,
        {
          option: 'endDate',
          value: endDate,
          expected: `Date on or after ${startDate.toISOString()}`,
          details: { startDate, endDate },
        },
      );
    }
  }

  /**
   * Validate startDate option
   */
  private static validateStartDate(startDate: Date | undefined): void {
    if (startDate === undefined) return;

    if (!startDate) {
      throw QuickurrenceError.validation(
        'startDate must be a valid Date object',
        QuickurrenceErrorCode.INVALID_START_DATE,
        {
          option: 'startDate',
          value: startDate,
          expected: 'Valid Date object',
        },
      );
    }

    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      throw QuickurrenceError.validation(
        'startDate must be a valid Date object',
        QuickurrenceErrorCode.INVALID_START_DATE,
        {
          option: 'startDate',
          value: startDate,
          expected: 'Valid Date object',
        },
      );
    }
  }

  /**
   * Validate timezone option
   */
  private static validateTimezone(timezone?: string): void {
    if (timezone === undefined) return;

    if (typeof timezone !== 'string' || timezone.trim() === '') {
      throw QuickurrenceError.validation(
        'timezone must be a non-empty string',
        QuickurrenceErrorCode.INVALID_TIMEZONE,
        {
          option: 'timezone',
          value: timezone,
          expected: 'Non-empty string',
        },
      );
    }

    // Basic validation - check if it's a reasonable timezone string
    // We can't easily validate all possible timezone strings without a library,
    // so we do basic format checking
    if (!/^[A-Za-z0-9_/:+-]+$/.test(timezone)) {
      throw QuickurrenceError.validation(
        'timezone must be a valid timezone identifier',
        QuickurrenceErrorCode.INVALID_TIMEZONE,
        {
          option: 'timezone',
          value: timezone,
          expected: 'Valid timezone identifier (e.g., UTC, America/New_York)',
        },
      );
    }
  }

  /**
   * Validate interval option
   */
  private static validateInterval(interval?: number): void {
    if (interval === undefined) return;

    if (!Number.isInteger(interval) || interval <= 0) {
      throw QuickurrenceError.validation(
        'interval must be a positive integer',
        QuickurrenceErrorCode.INVALID_INTERVAL,
        {
          option: 'interval',
          value: interval,
          expected: 'Positive integer',
        },
      );
    }
  }

  /**
   * Validate weekStartsOn option
   */
  private static validateWeekStartsOn(weekStartsOn?: number): void {
    if (weekStartsOn === undefined) return;

    if (!isOneOf(dayOptions)(weekStartsOn)) {
      throw QuickurrenceError.validation(
        'weekStartsOn must be an integer between 0-6',
        QuickurrenceErrorCode.INVALID_WEEK_STARTS_ON,
        {
          option: 'weekStartsOn',
          value: weekStartsOn,
          expected: 'Integer between 0-6',
        },
      );
    }
  }

  /**
   * Validate condition option
   */
  private static validateCondition(condition?: Condition): void {
    if (condition === undefined) return;

    if (typeof condition !== 'boolean' && typeof condition !== 'function') {
      throw QuickurrenceError.validation(
        'condition must be a boolean or a function',
        QuickurrenceErrorCode.INVALID_CONDITION,
        {
          option: 'condition',
          value: condition,
          expected: 'Boolean or function that takes a Date and returns boolean',
        },
      );
    }
  }

  /**
   * Validate timesOfDay option ("HH:MM" 24-hour strings)
   */
  private static validateTimesOfDay(timesOfDay?: string[]): void {
    if (timesOfDay === undefined) return;

    if (!Array.isArray(timesOfDay) || timesOfDay.length === 0) {
      throw QuickurrenceError.validation(
        'timesOfDay must be a non-empty array',
        QuickurrenceErrorCode.INVALID_TIMES_OF_DAY,
        {
          option: 'timesOfDay',
          value: timesOfDay,
          expected: 'Non-empty array of "HH:MM" strings',
        },
      );
    }

    const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    const invalid = timesOfDay.filter(
      (t) => typeof t !== 'string' || !pattern.test(t),
    );
    if (invalid.length > 0) {
      throw QuickurrenceError.validation(
        `Invalid timesOfDay values: ${invalid.join(', ')}. Must match "HH:MM" 24-hour format`,
        QuickurrenceErrorCode.INVALID_TIMES_OF_DAY,
        {
          option: 'timesOfDay',
          value: invalid,
          expected: '"HH:MM" 24-hour strings (e.g., "09:00", "14:30")',
        },
      );
    }

    const unique = new Set(timesOfDay);
    if (unique.size !== timesOfDay.length) {
      throw QuickurrenceError.validation(
        'timesOfDay cannot contain duplicate values',
        QuickurrenceErrorCode.INVALID_TIMES_OF_DAY,
        {
          option: 'timesOfDay',
          value: timesOfDay,
          expected: 'Array with unique "HH:MM" values',
        },
      );
    }
  }

  /**
   * Validate monthDayMode option
   */
  private static validateMonthDayMode(monthDayMode: string): void {
    if (!isOneOf(monthDayModeOptions)(monthDayMode)) {
      throw QuickurrenceError.validation(
        `monthDayMode must be one of: ${monthDayModeOptions.join(', ')}. Got: ${String(monthDayMode)}`,
        QuickurrenceErrorCode.INVALID_MONTH_DAY_MODE,
        {
          option: 'monthDayMode',
          value: monthDayMode,
          expected: `One of: ${monthDayModeOptions.join(', ')}`,
        },
      );
    }
  }
}
