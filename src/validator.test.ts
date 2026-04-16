import { UTCDateMini } from '@date-fns/utc';
import { describe, expect, it } from 'vitest';
import { QuickurrenceValidator } from './validator';
import type { QuickurrenceOptions } from './index';

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

    it('should not validate weekDays when rule is undefined', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        // No rule specified, weekDays should not be validated
        weekDays: [1, 2, 3],
      };

      expect(() => {
        QuickurrenceValidator.validateOptions(options);
      }).not.toThrow(); // Should not throw since rule validation is skipped
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
});
