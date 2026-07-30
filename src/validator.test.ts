import { UTCDateMini } from '@date-fns/utc';
import { describe, expect, it } from 'vitest';
import { QuickurrenceValidator } from './validator';
import { QuickurrenceError, QuickurrenceErrorCode } from './index';
import type { QuickurrenceOptions } from './index';

// Malformed input is the point of most cases below, so the single cast lives
// here rather than being repeated at every call site.
const errorCode = (options: unknown) => {
  try {
    QuickurrenceValidator.validateOptions(options as QuickurrenceOptions);
  } catch (error) {
    return (error as QuickurrenceError).code;
  }
  return undefined;
};

const START = new UTCDateMini('2024-01-01');

describe('QuickurrenceValidator', () => {
  describe('validateRule', () => {
    it('should allow undefined rule (now optional)', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should allow both startDate and rule to be undefined (both optional)', () => {
      const options: QuickurrenceOptions = {};

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should allow valid recurrence rules', () => {
      const validRules = ['daily', 'weekly', 'monthly', 'yearly'] as const;

      for (const rule of validRules) {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule,
        };

        expect(() => {
          QuickurrenceValidator.validateOptions(options);
        }).not.toThrow();
      }
    });

    it('should throw error for invalid recurrence rule', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        // @ts-expect-error - Testing invalid rule
        rule: 'invalid',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('Unsupported recurrence rule: invalid');
    });
  });

  describe('validatePreset', () => {
    it('should allow valid presets', () => {
      const validPresets = ['businessDays', 'weekends'] as const;

      for (const preset of validPresets) {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'daily',
          preset,
        };

        expect(() => {
          QuickurrenceValidator.validateOptions(options);
        }).not.toThrow();
      }
    });

    it('should allow undefined preset', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should throw error for invalid preset', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily' as const,
        // @ts-expect-error - Testing invalid preset
        preset: 'invalid',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('Unsupported preset: invalid');
    });
  });

  describe('validateWeekdayValue', () => {
    it('should allow valid weekday values 0-6', () => {
      const validWeekdays = [0, 1, 2, 3, 4, 5, 6] as const;

      for (const weekday of validWeekdays) {
        expect(() => {
          QuickurrenceValidator.validateWeekdayValue(weekday);
        }).not.toThrow();
      }
    });

    it('should throw error for undefined weekday', () => {
      expect(() => {
        QuickurrenceValidator.validateWeekdayValue(undefined);
      }).toThrow('Invalid weekday configuration');
    });

    it('should throw error for null weekday', () => {
      expect(() => {
        // @ts-expect-error - Testing null value
        QuickurrenceValidator.validateWeekdayValue(null);
      }).toThrow('Invalid weekday configuration');
    });
  });

  describe('startDate validation', () => {
    it('should allow undefined startDate (now optional)', () => {
      const options: QuickurrenceOptions = {
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should throw error for invalid startDate', () => {
      const options: QuickurrenceOptions = {
        startDate: new Date('invalid'),
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('startDate must be a valid Date object');
    });

    it('should throw error for non-Date startDate', () => {
      const options: QuickurrenceOptions = {
        // @ts-expect-error - Testing invalid startDate
        startDate: '2024-01-01',
        rule: 'daily' as const,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('startDate must be a valid Date object');
    });

    it('should throw INVALID_START_DATE for null startDate (untyped JS callers)', () => {
      const options: QuickurrenceOptions = {
        startDate: null as unknown as Date,
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('startDate must be a valid Date object');
    });
  });

  describe('timezone validation', () => {
    it('should allow valid timezone strings', () => {
      const validTimezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        '+05:30',
        '-08:00',
      ];

      for (const timezone of validTimezones) {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'daily',
          timezone,
        };

        expect(() => {
          QuickurrenceValidator.validateOptions(options);
        }).not.toThrow();
      }
    });

    it('should allow undefined timezone', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should throw error for empty timezone string', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        timezone: '',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('timezone must be a non-empty string');
    });

    it('should throw error for non-string timezone', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily' as const,
        // @ts-expect-error - Testing invalid timezone
        timezone: 123,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('timezone must be a non-empty string');
    });

    it('should throw error for timezone with invalid characters', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        timezone: 'America/New York!@#',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('timezone must be a valid timezone identifier');
    });
  });

  describe('interval validation', () => {
    it('should allow positive integer intervals', () => {
      const validIntervals = [1, 2, 5, 10, 100];

      for (const interval of validIntervals) {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'daily',
          interval,
        };

        expect(() => {
          QuickurrenceValidator.validateOptions(options);
        }).not.toThrow();
      }
    });

    it('should allow undefined interval', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should throw error for zero interval', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 0,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('interval must be a positive integer');
    });

    it('should throw error for negative interval', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: -1,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('interval must be a positive integer');
    });

    it('should throw error for non-integer interval', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 1.5,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('interval must be a positive integer');
    });
  });

  describe('weekStartsOn validation', () => {
    it('should allow valid weekStartsOn values (0-6)', () => {
      const validValues = [0, 1, 2, 3, 4, 5, 6] as const;

      for (const weekStartsOn of validValues) {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekStartsOn,
        };

        expect(() => {
          QuickurrenceValidator.validateOptions(options);
        }).not.toThrow();
      }
    });

    it('should allow undefined weekStartsOn', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should throw error for weekStartsOn < 0', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        // @ts-expect-error - Testing invalid weekStartsOn
        weekStartsOn: -1,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('weekStartsOn must be an integer between 0-6');
    });

    it('should throw error for weekStartsOn > 6', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        // @ts-expect-error - Testing invalid weekStartsOn
        weekStartsOn: 7,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('weekStartsOn must be an integer between 0-6');
    });

    it('should throw error for non-integer weekStartsOn', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly' as const,
        // @ts-expect-error - Testing invalid weekStartsOn
        weekStartsOn: 1.5,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('weekStartsOn must be an integer between 0-6');
    });
  });

  describe('endDate validation', () => {
    it('should throw error for invalid endDate', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new Date('invalid'),
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('endDate must be a valid Date object');
    });

    it('should throw error for non-Date endDate', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily' as const,
        // @ts-expect-error - Testing invalid endDate
        endDate: '2024-01-10',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('endDate must be a valid Date object');
    });
  });

  describe('condition validation', () => {
    it('should allow boolean conditions', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        condition: true,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();

      const options2: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        condition: false,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options2);
      }).not.toThrow();
    });

    it('should allow function conditions', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        condition: (date) => date.getDate() % 2 === 1,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should allow undefined condition', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should throw error for non-boolean/non-function condition', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily' as const,
        // @ts-expect-error - Testing invalid condition
        condition: 'always',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('condition must be a boolean or a function');
    });
  });

  describe('monthDayMode validation', () => {
    it('should allow valid monthDayMode values', () => {
      const validModes = ['skip', 'last'] as const;

      for (const monthDayMode of validModes) {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'monthly',
          monthDay: 31,
          monthDayMode,
        };

        expect(() => {
          QuickurrenceValidator.validateOptions(options);
        }).not.toThrow();
      }
    });

    it('should throw error for invalid monthDayMode', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 31,
        // @ts-expect-error - Testing invalid monthDayMode
        monthDayMode: 'invalid',
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('monthDayMode must be one of: skip, last. Got: invalid');
    });
  });

  describe('weekDays duplicate validation', () => {
    it('should throw error for duplicate weekDays', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 1, 5], // Duplicate 1
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('weekDays cannot contain duplicate values');
    });

    it('should allow weekDays without duplicates', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5],
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });
  });

  describe('excludeDates validation', () => {
    it('should throw error for invalid excludeDates', () => {
      const options = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [
          new UTCDateMini('2024-01-03'),
          new Date('invalid'), // Invalid date
          new UTCDateMini('2024-01-05'),
        ],
      };

      expect(() => {
        // @ts-expect-error - Testing invalid excludeDates
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('All excludeDates must be valid Date objects');
    });

    it('should throw error for non-Date objects in excludeDates', () => {
      const options = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [
          new UTCDateMini('2024-01-03'),
          '2024-01-04', // String instead of Date
        ],
      };

      expect(() => {
        // @ts-expect-error - Testing invalid excludeDates
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('All excludeDates must be valid Date objects');
    });
  });

  describe('existing validations', () => {
    it('should still validate weekDays for weekly recurrence', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily', // Wrong rule for weekDays
        weekDays: [1, 2, 3],
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('weekDays option is only valid for weekly recurrence');
    });

    it('should skip only the weekly-rule compatibility check when rule is undefined', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        weekDays: [1, 2, 3],
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow();
    });

    it('should still validate monthDay range', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly' as const,
        // @ts-expect-error - Testing invalid monthDay
        monthDay: 32,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('monthDay must be between 1-31');
    });

    it('should still validate count is positive integer', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: -1,
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow('count must be a positive integer');
    });

    it('should still validate mutual exclusions', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 5,
        endDate: new UTCDateMini('2024-01-10'),
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).toThrow(
        'Cannot use both count and endDate options. Choose one approach to limit occurrences.',
      );
    });
  });

  // `rule` is optional, but the *values* of the other options are not. The
  // rule-only checks (is this option compatible with this rule?) stay gated on
  // a rule being present; every value and shape check runs regardless, so a
  // rule-less config is rejected by the validator exactly as the zod schema
  // rejects it.
  describe('value checks with no rule supplied', () => {
    it('rejects an out-of-range weekDays entry', () => {
      expect(errorCode({ startDate: START, weekDays: [7] })).toBe(
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
    });

    it('rejects an empty weekDays array', () => {
      expect(errorCode({ startDate: START, weekDays: [] })).toBe(
        QuickurrenceErrorCode.EMPTY_REQUIRED_ARRAY,
      );
    });

    it('rejects duplicate weekDays', () => {
      expect(errorCode({ startDate: START, weekDays: [1, 1] })).toBe(
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
    });

    it('rejects an out-of-range monthDay', () => {
      expect(errorCode({ startDate: START, monthDay: 32 })).toBe(
        QuickurrenceErrorCode.INVALID_MONTH_DAY,
      );
    });

    it('rejects an unknown monthDayMode', () => {
      expect(errorCode({ startDate: START, monthDayMode: 'first' })).toBe(
        QuickurrenceErrorCode.INVALID_MONTH_DAY_MODE,
      );
    });

    it('rejects an out-of-range nthWeekdayOfMonth.weekday', () => {
      expect(
        errorCode({
          startDate: START,
          nthWeekdayOfMonth: { weekday: 7, nth: 1 },
        }),
      ).toBe(QuickurrenceErrorCode.INVALID_NTH_WEEKDAY);
    });

    it('rejects an out-of-range nthWeekdayOfMonth.nth', () => {
      expect(
        errorCode({
          startDate: START,
          nthWeekdayOfMonth: { weekday: 1, nth: 5 },
        }),
      ).toBe(QuickurrenceErrorCode.INVALID_NTH_WEEKDAY);
    });

    it('rejects an out-of-range weekStartsOn', () => {
      expect(errorCode({ startDate: START, weekStartsOn: 7 })).toBe(
        QuickurrenceErrorCode.INVALID_WEEK_STARTS_ON,
      );
    });

    it('rejects a malformed excludeDates entry', () => {
      expect(
        errorCode({ startDate: START, excludeDates: [new Date('nope')] }),
      ).toBe(QuickurrenceErrorCode.INVALID_EXCLUDE_DATES);
    });

    it('accepts well-formed values', () => {
      expect(
        errorCode({
          startDate: START,
          weekDays: [1, 3, 5],
          weekStartsOn: 6,
          excludeDates: [new UTCDateMini('2024-01-03')],
        }),
      ).toBeUndefined();

      expect(
        errorCode({ startDate: START, monthDay: 31, monthDayMode: 'skip' }),
      ).toBeUndefined();

      expect(
        errorCode({
          startDate: START,
          nthWeekdayOfMonth: { weekday: 1, nth: 'last' },
        }),
      ).toBeUndefined();
    });

    it('does not raise the monthly-only incompatibility for nthWeekdayOfMonth', () => {
      expect(
        errorCode({
          startDate: START,
          nthWeekdayOfMonth: { weekday: 1, nth: 2 },
        }),
      ).toBeUndefined();

      expect(
        errorCode({
          startDate: START,
          rule: 'weekly',
          nthWeekdayOfMonth: { weekday: 1, nth: 2 },
        }),
      ).toBe(QuickurrenceErrorCode.INCOMPATIBLE_OPTIONS);
    });

    it('does not raise the monthly-only incompatibility for monthDay', () => {
      expect(errorCode({ startDate: START, monthDay: 15 })).toBeUndefined();

      expect(
        errorCode({ startDate: START, rule: 'daily', monthDay: 15 }),
      ).toBe(QuickurrenceErrorCode.INCOMPATIBLE_OPTIONS);
    });
  });

  // The option checks test membership in the shared option arrays, not a
  // numeric range. A range comparison such as `day < 0 || day > 6` accepts
  // 3.5, '1' and other non-members; membership does not.
  describe('option values are checked by membership, not by range', () => {
    const nonWeekDays = [3.5, -1, 7, NaN, Infinity, '1', null, true];

    it.each(nonWeekDays)('rejects weekDays entry %p', (day) => {
      expect(errorCode({ startDate: START, rule: 'weekly', weekDays: [day] })).toBe(
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
    });

    it.each(nonWeekDays)('rejects weekStartsOn %p', (value) => {
      expect(errorCode({ startDate: START, weekStartsOn: value })).toBe(
        QuickurrenceErrorCode.INVALID_WEEK_STARTS_ON,
      );
    });

    it.each([0, 32, 15.5, -1, NaN, '15', null])(
      'rejects monthDay %p',
      (monthDay) => {
        expect(
          errorCode({ startDate: START, rule: 'monthly', monthDay }),
        ).toBe(QuickurrenceErrorCode.INVALID_MONTH_DAY);
      },
    );

    it.each([0, 5, 1.5, 'first', null, true])(
      'rejects nthWeekdayOfMonth.nth %p',
      (nth) => {
        expect(
          errorCode({
            startDate: START,
            nthWeekdayOfMonth: { weekday: 1, nth },
          }),
        ).toBe(QuickurrenceErrorCode.INVALID_NTH_WEEKDAY);
      },
    );

    // `Array.prototype.includes` compares with SameValueZero, under which -0
    // and 0 are the same value, so a negative zero is a legitimate Sunday.
    it('accepts -0 as day 0', () => {
      expect(errorCode({ startDate: START, weekDays: [-0] })).toBeUndefined();
      expect(errorCode({ startDate: START, weekStartsOn: -0 })).toBeUndefined();
    });
  });

  describe('shape guards', () => {
    it.each([3, '13', { 0: 1 }, new Set([1])])(
      'rejects a non-array weekDays %p',
      (weekDays) => {
        expect(errorCode({ startDate: START, weekDays })).toBe(
          QuickurrenceErrorCode.INVALID_WEEKDAYS,
        );
      },
    );

    it('reports the array shape rather than the member values for a non-array weekDays', () => {
      expect(() => {
        QuickurrenceValidator.validateOptions({
          startDate: START,
          weekDays: 3,
        } as unknown as QuickurrenceOptions);
      }).toThrow('weekDays must be an array of weekday values');
    });

    it.each(['last', 1, null, [1, 2]])(
      'rejects a non-object nthWeekdayOfMonth %p',
      (nthWeekdayOfMonth) => {
        expect(errorCode({ startDate: START, nthWeekdayOfMonth })).toBe(
          QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
        );
      },
    );

    it('reports the object shape for a null nthWeekdayOfMonth instead of throwing a TypeError', () => {
      expect(() => {
        QuickurrenceValidator.validateOptions({
          startDate: START,
          nthWeekdayOfMonth: null,
        } as unknown as QuickurrenceOptions);
      }).toThrow(
        'nthWeekdayOfMonth must be an object with weekday and nth properties',
      );
    });

    it.each(['2024-01-03', 1704240000000, { 0: new Date() }])(
      'rejects a non-array excludeDates %p',
      (excludeDates) => {
        expect(errorCode({ startDate: START, excludeDates })).toBe(
          QuickurrenceErrorCode.INVALID_EXCLUDE_DATES,
        );
      },
    );

    it('reports the array shape for a bare Date passed as excludeDates', () => {
      expect(() => {
        QuickurrenceValidator.validateOptions({
          startDate: START,
          excludeDates: new UTCDateMini('2024-01-03'),
        } as unknown as QuickurrenceOptions);
      }).toThrow('excludeDates must be an array of Date objects');
    });
  });

  // Values that cannot be implicitly coerced used to blow up inside the error
  // message's template literal, replacing the library error with a TypeError.
  describe('non-coercible values still produce a QuickurrenceError', () => {
    it('stringifies a symbol rule', () => {
      expect(errorCode({ startDate: START, rule: Symbol('weekly') })).toBe(
        QuickurrenceErrorCode.UNSUPPORTED_RULE,
      );
    });

    it('stringifies a symbol preset', () => {
      expect(errorCode({ startDate: START, preset: Symbol('weekends') })).toBe(
        QuickurrenceErrorCode.UNSUPPORTED_PRESET,
      );
    });

    it('stringifies a symbol monthDayMode', () => {
      expect(() => {
        QuickurrenceValidator.validateOptions({
          startDate: START,
          monthDayMode: Symbol('skip'),
        } as unknown as QuickurrenceOptions);
      }).toThrow('monthDayMode must be one of: skip, last. Got: Symbol(skip)');
    });

    it('stringifies a symbol nthWeekdayOfMonth.nth', () => {
      expect(() => {
        QuickurrenceValidator.validateOptions({
          startDate: START,
          nthWeekdayOfMonth: { weekday: 1, nth: Symbol('last') },
        } as unknown as QuickurrenceOptions);
      }).toThrow('Invalid nth in nthWeekdayOfMonth: Symbol(last)');
    });
  });

  // Validation inspects the option, never runs it: a predicate with side
  // effects or a cost must not fire just because a rule was constructed.
  describe('condition predicate is never invoked during validation', () => {
    let calls = 0;
    const countingCondition = () => {
      calls += 1;
      return true;
    };

    it('does not call the predicate for a rule-bearing config', () => {
      calls = 0;
      QuickurrenceValidator.validateOptions({
        startDate: START,
        rule: 'daily',
        condition: countingCondition,
      });
      expect(calls).toBe(0);
    });

    it('does not call the predicate for a rule-less config', () => {
      calls = 0;
      QuickurrenceValidator.validateOptions({
        startDate: START,
        condition: countingCondition,
      });
      expect(calls).toBe(0);
    });

    it('does not call the predicate on the path that rejects a conflicting preset', () => {
      calls = 0;
      expect(
        errorCode({
          startDate: START,
          rule: 'daily',
          condition: countingCondition,
          preset: 'weekends',
        }),
      ).toBe(QuickurrenceErrorCode.CONFLICTING_OPTIONS);
      expect(calls).toBe(0);
    });
  });
});
