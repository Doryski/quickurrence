import { isBefore } from 'date-fns';
import type {
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

    // Validate basic options (now optional but validate if provided)
    this.validateStartDate(startDate);
    this.validateRule(rule);

    // Validate optional options
    this.validateTimezone(timezone);
    this.validateInterval(interval);
    this.validateWeekStartsOn(weekStartsOn);
    this.validateEndDate(startDate, endDate);
    this.validateCount(count);
    this.validateExcludeDates(excludeDates);
    this.validateCondition(condition);
    this.validatePreset(preset);

    // Validate rule-specific options
    this.validateWeeklyOptions(rule, weekDays);
    this.validateMonthlyOptions(
      rule,
      monthDay,
      monthDayMode,
      nthWeekdayOfMonth,
    );

    // Validate mutual exclusions
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
    if (!weekDays) return;

    // Only validate if rule is provided
    if (rule === undefined) return;

    // weekDays is only valid for weekly recurrence
    if (rule !== 'weekly') {
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

    // weekDays should not be empty
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

    // weekDays should contain valid values (0-6)
    const invalidDays = weekDays.filter((day) => day < 0 || day > 6);
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

    // weekDays should not contain duplicates
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
    // Only validate if rule is provided
    if (rule === undefined) return;

    // monthDay and monthDayMode are only valid for monthly recurrence
    if (
      (monthDay !== undefined ||
        (monthDayMode !== undefined && monthDay === undefined)) &&
      rule !== 'monthly'
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

    // monthDay should be between 1-31
    if (monthDay !== undefined) {
      if (monthDay < 1 || monthDay > 31) {
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
    }

    // monthDayMode should be valid
    if (monthDayMode !== undefined) {
      this.validateMonthDayMode(monthDayMode);
    }

    // nthWeekdayOfMonth is only valid for monthly recurrence
    if (nthWeekdayOfMonth && rule !== 'monthly') {
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

    // Validate nthWeekdayOfMonth configuration
    if (nthWeekdayOfMonth) {
      this.validateNthWeekdayConfig(nthWeekdayOfMonth);
    }
  }

  /**
   * Validate nthWeekdayOfMonth configuration
   */
  private static validateNthWeekdayConfig(config: NthWeekdayConfig): void {
    const { weekday, nth } = config;

    // weekday should be between 0-6
    if (weekday < 0 || weekday > 6) {
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

    // nth should be 1-4 or 'last'
    if (typeof nth === 'number' && (nth < 1 || nth > 4)) {
      throw QuickurrenceError.validation(
        `Invalid nth in nthWeekdayOfMonth: ${nth}. Nth must be 1, 2, 3, 4, or 'last'`,
        QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
        {
          option: 'nthWeekdayOfMonth.nth',
          value: nth,
          expected: '1, 2, 3, 4, or "last"',
        },
      );
    }

    if (typeof nth === 'string' && nth !== 'last') {
      throw QuickurrenceError.validation(
        `Invalid nth in nthWeekdayOfMonth: ${nth}. Nth must be 1, 2, 3, 4, or 'last'`,
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
    condition?: boolean | ((date: Date) => boolean),
    preset?: Preset,
  ): void {
    // Cannot use both monthDay and nthWeekdayOfMonth
    if (monthDay !== undefined && nthWeekdayOfMonth) {
      throw QuickurrenceError.configuration(
        'Cannot use both monthDay and nthWeekdayOfMonth options. Choose one approach for monthly recurrence.',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        {
          details: { conflictingOptions: ['monthDay', 'nthWeekdayOfMonth'] },
        },
      );
    }

    // Cannot use both count and endDate
    if (count !== undefined && endDate !== undefined) {
      throw QuickurrenceError.configuration(
        'Cannot use both count and endDate options. Choose one approach to limit occurrences.',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        {
          details: { conflictingOptions: ['count', 'endDate'] },
        },
      );
    }

    // Cannot use both preset and condition
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

    // count should be a positive integer
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
    if (!excludeDates) return;

    // excludeDates should not be an empty array
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

    // Each exclude date should be a valid Date object
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

    const validRules: RecurrenceRule[] = [
      'daily',
      'weekly',
      'monthly',
      'yearly',
    ];
    if (!validRules.includes(rule)) {
      throw QuickurrenceError.configuration(
        `Unsupported recurrence rule: ${rule}`,
        QuickurrenceErrorCode.UNSUPPORTED_RULE,
        {
          option: 'rule',
          value: rule,
          expected: `One of: ${validRules.join(', ')}`,
        },
      );
    }
  }

  /**
   * Validate preset option
   */
  private static validatePreset(preset?: Preset): void {
    if (preset === undefined) return;

    const validPresets: Preset[] = ['businessDays', 'weekends'];
    if (!validPresets.includes(preset)) {
      throw QuickurrenceError.configuration(
        `Unsupported preset: ${preset}`,
        QuickurrenceErrorCode.UNSUPPORTED_PRESET,
        {
          option: 'preset',
          value: preset,
          expected: `One of: ${validPresets.join(', ')}`,
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

    // Validate that endDate is a valid Date object
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

    // Only validate against startDate if startDate is provided
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

    if (
      !Number.isInteger(weekStartsOn) ||
      weekStartsOn < 0 ||
      weekStartsOn > 6
    ) {
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
  private static validateCondition(
    condition?: boolean | ((date: Date) => boolean),
  ): void {
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
   * Validate monthDayMode option
   */
  private static validateMonthDayMode(monthDayMode: string): void {
    const validModes = ['skip', 'last'];
    if (!validModes.includes(monthDayMode)) {
      throw QuickurrenceError.validation(
        `monthDayMode must be one of: ${validModes.join(', ')}. Got: ${monthDayMode}`,
        QuickurrenceErrorCode.INVALID_MONTH_DAY_MODE,
        {
          option: 'monthDayMode',
          value: monthDayMode,
          expected: `One of: ${validModes.join(', ')}`,
        },
      );
    }
  }
}
