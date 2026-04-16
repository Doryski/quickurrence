import { UTCDateMini } from '@date-fns/utc';
import { describe, expect, it } from 'vitest';
import { Quickurrence, type QuickurrenceOptions, type WeekDay } from './index';

describe('Quickurrence.clean', () => {
  describe('Rule-specific option cleaning', () => {
    it('should remove weekDays when rule is not weekly', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        weekDays: [1, 2, 3] as WeekDay[],
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.weekDays).toBeUndefined();
      expect(cleaned.rule).toBe('daily');
      expect(cleaned.startDate).toEqual(options.startDate);
    });

    it('should preserve weekDays when rule is weekly', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5] as WeekDay[],
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.weekDays).toEqual([1, 3, 5]);
      expect(cleaned.rule).toBe('weekly');
    });

    it('should remove monthly options when rule is not monthly', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        monthDay: 15,
        monthDayMode: 'last',
        nthWeekdayOfMonth: { weekday: 1 as WeekDay, nth: 1 },
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.monthDay).toBeUndefined();
      expect(cleaned.monthDayMode).toBeUndefined();
      expect(cleaned.nthWeekdayOfMonth).toBeUndefined();
      expect(cleaned.rule).toBe('daily');
    });

    it('should preserve monthly options when rule is monthly', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 15,
        monthDayMode: 'skip',
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.monthDay).toBe(15);
      expect(cleaned.monthDayMode).toBe('skip');
      expect(cleaned.rule).toBe('monthly');
    });
  });

  describe('Conflicting options resolution', () => {
    it('should remove endDate when both count and endDate are specified', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 5,
        endDate: new UTCDateMini('2024-01-10'),
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.count).toBe(5);
      expect(cleaned.endDate).toBeUndefined();
    });

    it('should remove condition when both preset and condition are specified', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        preset: 'businessDays',
        condition: (date) => date.getDate() % 2 === 1,
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.preset).toBe('businessDays');
      expect(cleaned.condition).toBeUndefined();
    });

    it('should remove nthWeekdayOfMonth when both monthDay and nthWeekdayOfMonth are specified', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 15,
        nthWeekdayOfMonth: { weekday: 1 as WeekDay, nth: 1 },
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.monthDay).toBe(15);
      expect(cleaned.nthWeekdayOfMonth).toBeUndefined();
    });
  });

  describe('Empty array cleaning', () => {
    it('should remove empty weekDays array', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [] as WeekDay[],
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.weekDays).toBeUndefined();
    });

    it('should remove empty excludeDates array', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [],
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.excludeDates).toBeUndefined();
    });

    it('should preserve non-empty arrays', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3] as WeekDay[],
        excludeDates: [new UTCDateMini('2024-01-05')],
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.weekDays).toEqual([1, 3]);
      expect(cleaned.excludeDates).toEqual([new UTCDateMini('2024-01-05')]);
    });
  });

  describe('Default value cleaning', () => {
    it('should remove interval when it is 1 (default)', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 1,
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.interval).toBeUndefined();
    });

    it('should preserve interval when it is not 1', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2,
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.interval).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle options with no rule specified', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        weekDays: [1, 2, 3] as WeekDay[], // Would be invalid but no rule to validate against
        monthDay: 15,
      };

      const cleaned = Quickurrence.clean(options);

      // Should preserve all options since no rule to validate against
      expect(cleaned.weekDays).toEqual([1, 2, 3]);
      expect(cleaned.monthDay).toBe(15);
    });

    it('should handle empty options object', () => {
      const options: QuickurrenceOptions = {};

      const cleaned = Quickurrence.clean(options);

      expect(cleaned).toEqual({});
    });

    it('should handle options with only startDate', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.startDate).toEqual(options.startDate);
      expect(Object.keys(cleaned)).toHaveLength(1);
    });

    it('should not modify the original options object', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        weekDays: [1, 2, 3] as WeekDay[],
        monthDay: 15,
      };

      const originalOptions = { ...options };
      const cleaned = Quickurrence.clean(options);

      // Original should be unchanged
      expect(options).toEqual(originalOptions);
      // Cleaned should be different
      expect(cleaned.weekDays).toBeUndefined();
      expect(cleaned.monthDay).toBeUndefined();
    });
  });

  describe('Complex cleaning scenarios', () => {
    it('should clean multiple incompatible options at once', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'yearly',
        weekDays: [1, 2, 3] as WeekDay[], // Invalid for yearly
        monthDay: 15, // Invalid for yearly
        monthDayMode: 'last', // Invalid for yearly
        nthWeekdayOfMonth: { weekday: 1 as WeekDay, nth: 1 }, // Invalid for yearly
        count: 5,
        endDate: new UTCDateMini('2024-12-31'), // Conflicts with count
        preset: 'businessDays',
        condition: (date) => date.getDate() % 2 === 1, // Conflicts with preset
        interval: 1, // Default value
        excludeDates: [], // Empty array
      };

      const cleaned = Quickurrence.clean(options);

      expect(cleaned.rule).toBe('yearly');
      expect(cleaned.startDate).toEqual(options.startDate);
      expect(cleaned.count).toBe(5);
      expect(cleaned.preset).toBe('businessDays');

      // Should be removed
      expect(cleaned.weekDays).toBeUndefined();
      expect(cleaned.monthDay).toBeUndefined();
      expect(cleaned.monthDayMode).toBeUndefined();
      expect(cleaned.nthWeekdayOfMonth).toBeUndefined();
      expect(cleaned.endDate).toBeUndefined();
      expect(cleaned.condition).toBeUndefined();
      expect(cleaned.interval).toBeUndefined();
      expect(cleaned.excludeDates).toBeUndefined();
    });

    it('should allow creating valid Quickurrence instance from cleaned options', () => {
      const invalidOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        weekDays: [1, 2, 3] as WeekDay[], // Invalid for daily
        monthDay: 15, // Invalid for daily
      };

      const cleaned = Quickurrence.clean(invalidOptions);

      // Should be able to create instance without errors
      expect(() => {
        new Quickurrence(cleaned);
      }).not.toThrow();

      // Should be able to generate human text
      expect(() => {
        new Quickurrence(cleaned).toHumanText();
      }).not.toThrow();
    });

    it('should preserve valid complex configurations', () => {
      const options: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5] as WeekDay[],
        interval: 2,
        count: 10,
        excludeDates: [new UTCDateMini('2024-01-03')],
        timezone: 'America/New_York',
      };

      const cleaned = Quickurrence.clean(options);

      // All options should be preserved since they're valid
      expect(cleaned).toEqual(options);
    });
  });

  describe('Integration with toHumanText', () => {
    it('should allow toHumanText to work with previously invalid options', () => {
      const invalidOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        weekDays: [1, 2, 3] as WeekDay[], // Invalid for daily
      };

      // Should not throw error now
      expect(() => {
        Quickurrence.toHumanText(invalidOptions);
      }).not.toThrow();

      const humanText = Quickurrence.toHumanText(invalidOptions);
      expect(humanText).toBe('Daily');
    });

    it('should generate correct text for cleaned weekly options', () => {
      const invalidOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5] as WeekDay[],
        monthDay: 15, // Invalid for weekly, should be removed
      };

      const humanText = Quickurrence.toHumanText(invalidOptions);
      expect(humanText).toBe('Weekly on Monday, Wednesday, Friday');
    });

    it('should generate correct text for cleaned monthly options', () => {
      const invalidOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 15,
        weekDays: [1, 2, 3] as WeekDay[], // Invalid for monthly, should be removed
      };

      const humanText = Quickurrence.toHumanText(invalidOptions);
      expect(humanText).toBe('Monthly on the 15th');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle transitioning from weekly to daily rule', () => {
      // Simulate user changing from weekly to daily but weekDays still in form state
      const transitionOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily', // Changed from weekly
        weekDays: [1, 3, 5] as WeekDay[], // Left over from weekly
        interval: 2,
      };

      const cleaned = Quickurrence.clean(transitionOptions);

      expect(cleaned.rule).toBe('daily');
      expect(cleaned.interval).toBe(2);
      expect(cleaned.weekDays).toBeUndefined(); // Should be removed
    });

    it('should handle transitioning from monthly to weekly rule', () => {
      // Simulate user changing from monthly to weekly but monthly options still there
      const transitionOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly', // Changed from monthly
        monthDay: 15, // Left over from monthly
        monthDayMode: 'last', // Left over from monthly
        weekDays: [1, 3] as WeekDay[], // New weekly options
      };

      const cleaned = Quickurrence.clean(transitionOptions);

      expect(cleaned.rule).toBe('weekly');
      expect(cleaned.weekDays).toEqual([1, 3]);
      expect(cleaned.monthDay).toBeUndefined(); // Should be removed
      expect(cleaned.monthDayMode).toBeUndefined(); // Should be removed
    });

    it('should handle form state with conflicting end conditions', () => {
      // Simulate UI where user sets both count and endDate
      const conflictingOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 10,
        endDate: new UTCDateMini('2024-01-15'),
      };

      const cleaned = Quickurrence.clean(conflictingOptions);

      expect(cleaned.count).toBe(10);
      expect(cleaned.endDate).toBeUndefined(); // Should prioritize count
    });

    it('should handle form state with conflicting filter conditions', () => {
      // Simulate UI where user sets both preset and custom condition
      const conflictingOptions: QuickurrenceOptions = {
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        preset: 'businessDays',
        condition: (date) => date.getDate() % 2 === 1,
      };

      const cleaned = Quickurrence.clean(conflictingOptions);

      expect(cleaned.preset).toBe('businessDays');
      expect(cleaned.condition).toBeUndefined(); // Should prioritize preset
    });
  });
});
