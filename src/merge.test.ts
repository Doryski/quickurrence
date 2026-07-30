import { TZDate } from '@date-fns/tz';
import { UTCDateMini } from '@date-fns/utc';
import { describe, expect, it } from 'vitest';
import {
  type Condition,
  Quickurrence,
  QuickurrenceError,
  QuickurrenceErrorCode,
} from './index';
import { QuickurrenceMerge } from './merge';

const utcWeekday = (date: Date) => new UTCDateMini(date).getUTCDay();
const utcDayOfMonth = (date: Date) => new UTCDateMini(date).getUTCDate();

describe('QuickurrenceMerge', () => {
  describe('Basic merging functionality', () => {
    it('should merge two daily rules with different intervals', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-02'),
        rule: 'daily',
        interval: 3,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-10'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Rule1: 1st, 3rd, 5th, 7th, 9th
      // Rule2: 2nd, 5th, 8th
      // Merged (deduplicated): 1st, 2nd, 3rd, 5th, 7th, 8th, 9th
      expect(occurrences).toHaveLength(7);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-05'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-07'));
      expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08'));
      expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-09'));
    });

    it('should merge weekly rules with different weekdays (as in user example)', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'), // Monday
        rule: 'weekly',
        weekDays: [1], // Monday
        interval: 2,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [2], // Tuesday
        interval: 3,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-02-12'),
      };

      const occurrences = merged.getAllOccurrences(range);

      expect(occurrences.length).toBeGreaterThan(0);

      const mondays = occurrences.filter((d) => utcWeekday(d) === 1);
      const tuesdays = occurrences.filter((d) => utcWeekday(d) === 2);

      expect(mondays.length).toBeGreaterThan(0);
      expect(tuesdays.length).toBeGreaterThan(0);

      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
    });

    it('should merge monthly rules with different patterns', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 15,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        nthWeekdayOfMonth: { weekday: 1, nth: 'last' }, // Last Monday of each month
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-04-30'),
      };

      const occurrences = merged.getAllOccurrences(range);

      expect(occurrences.length).toBeGreaterThan(0);

      const monthlyDates = occurrences.filter((d) => utcDayOfMonth(d) === 15);
      const lastMondays = occurrences.filter((d) => utcWeekday(d) === 1);

      expect(monthlyDates.length).toBeGreaterThan(0);
      expect(lastMondays.length).toBeGreaterThan(0);
    });
  });

  describe('getNextOccurrence', () => {
    it('should return the earliest next occurrence from merged rules', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-05'), // Later start date
        rule: 'weekly',
        interval: 2,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'), // Earlier start date
        rule: 'weekly',
        interval: 3,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const nextOccurrence = merged.getNextOccurrence(
        new UTCDateMini('2023-12-31'),
      );
      expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-01')); // Earlier start date
    });

    it('should find next occurrence across multiple rules', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        interval: 2,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-03'),
        rule: 'weekly',
        interval: 3,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      // After Jan 1, next should be Jan 3 (Wednesday from rule2)
      const nextOccurrence = merged.getNextOccurrence(
        new UTCDateMini('2024-01-01'),
      );
      expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
    });

    it('should throw error when no more occurrences exist', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-02'),
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-03'),
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      expect(() => {
        merged.getNextOccurrence(new UTCDateMini('2024-01-05'));
      }).toThrow('No more occurrences from any of the merged rules');
    });

    it('should work when some rules have no more occurrences but others do', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 2,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-10'),
        rule: 'weekly',
        // No count limit
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      // After rule1 has no more occurrences, should get from rule2
      const nextOccurrence = merged.getNextOccurrence(
        new UTCDateMini('2024-01-05'),
      );
      expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-10'));
    });
  });

  describe('Utility methods', () => {
    it('should return the earliest start date', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-05'),
        rule: 'daily',
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'), // Earlier
        rule: 'daily',
      });

      const rule3 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-10'),
        rule: 'daily',
      });

      const merged = new QuickurrenceMerge([rule1, rule2, rule3]);

      expect(merged.getStartDate()).toEqual(new UTCDateMini('2024-01-01'));
    });

    it('should return the latest end date when all rules have end dates', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-05'),
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-10'), // Later
      });

      const rule3 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-08'),
      });

      const merged = new QuickurrenceMerge([rule1, rule2, rule3]);

      expect(merged.getEndDate()).toEqual(new UTCDateMini('2024-01-10'));
    });

    it('should return undefined for end date when any rule has no end date', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-05'),
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        // No end date
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      expect(merged.getEndDate()).toBeUndefined();
    });

    it('should return sum of counts when all rules have counts', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 5,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        count: 3,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      expect(merged.getCount()).toBe(8);
    });

    it('should return undefined for count when any rule has no count limit', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 5,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        // No count limit
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      expect(merged.getCount()).toBeUndefined();
    });

    it('should return union of exclude dates from all rules', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [
          new UTCDateMini('2024-01-03'),
          new UTCDateMini('2024-01-05'),
        ],
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [
          new UTCDateMini('2024-01-03'), // Duplicate - should be deduplicated
          new UTCDateMini('2024-01-07'),
        ],
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const excludeDates = merged.getExcludeDates();
      expect(excludeDates).toBeDefined();
      expect(excludeDates).toHaveLength(3); // Deduplicated
      expect(excludeDates![0]).toEqual(new UTCDateMini('2024-01-03'));
      expect(excludeDates![1]).toEqual(new UTCDateMini('2024-01-05'));
      expect(excludeDates![2]).toEqual(new UTCDateMini('2024-01-07'));
    });

    it('should return undefined for exclude dates when no rules have exclude dates', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      expect(merged.getExcludeDates()).toBeUndefined();
    });

    it('should return correct rule count', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
      });

      const rule3 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
      });

      const merged = new QuickurrenceMerge([rule1, rule2, rule3]);

      expect(merged.getRuleCount()).toBe(3);
    });

    it('should return copy of rules array', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
      });

      const originalRules = [rule1, rule2];
      const merged = new QuickurrenceMerge(originalRules);

      const retrievedRules = merged.getRules();
      expect(retrievedRules).toHaveLength(2);
      expect(retrievedRules[0]).toBe(rule1);
      expect(retrievedRules[1]).toBe(rule2);
      expect(retrievedRules).not.toBe(originalRules);
    });

    it('should throw error for unsupported methods', () => {
      const rule = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const merged = new QuickurrenceMerge([rule]);

      expect(() => merged.getRule()).toThrow(
        'getRule() is not supported for merged rules',
      );
      expect(() => merged.getWeekStartsOn()).toThrow(
        'getWeekStartsOn() is not supported for merged rules',
      );
      expect(() => merged.getWeekDays()).toThrow(
        'getWeekDays() is not supported for merged rules',
      );
      expect(() => merged.getMonthDay()).toThrow(
        'getMonthDay() is not supported for merged rules',
      );
      expect(() => merged.getMonthDayMode()).toThrow(
        'getMonthDayMode() is not supported for merged rules',
      );
      expect(() => merged.getNthWeekdayOfMonth()).toThrow(
        'getNthWeekdayOfMonth() is not supported for merged rules',
      );
      expect(() => merged.getCondition()).toThrow(
        'getCondition() is not supported for merged rules',
      );
      expect(() => merged.getPreset()).toThrow(
        'getPreset() is not supported for merged rules',
      );
      expect(() => merged.getOptions()).toThrow(
        'getOptions() is not supported for merged rules',
      );
    });
  });

  describe('getCommonOccurrences', () => {
    it('should return occurrences common to all rules', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-06'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1: 1st, 2nd, 3rd, 4th, 5th, 6th
      // Rule2: 1st, 3rd, 5th
      // Common (intersection): 1st, 3rd, 5th
      expect(commonOccurrences).toHaveLength(3);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
      expect(commonOccurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
    });

    it('should return empty array when rules have no common occurrences', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1], // Monday
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [2], // Tuesday
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-31'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1: All Mondays
      // Rule2: All Tuesdays
      // Common: None (no overlap between Mondays and Tuesdays)
      expect(commonOccurrences).toHaveLength(0);
    });

    it('should handle partial overlap between rules', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5], // Mon, Wed, Fri
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [3, 5], // Wed, Fri
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-07'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1: Mon, Wed, Fri
      // Rule2: Wed, Fri
      // Common: Wed, Fri
      expect(commonOccurrences).toHaveLength(2);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-01-05')); // Friday
    });

    it('should work with single rule', () => {
      const rule = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 3,
      });

      const merged = new QuickurrenceMerge([rule]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-10'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Single rule: common occurrences are just all occurrences
      expect(commonOccurrences).toHaveLength(3);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(commonOccurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
    });

    it('should work with three rules having common intersection', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2, // Every 2 days: 1st, 3rd, 5th, 7th, ...
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 3, // Every 3 days: 1st, 4th, 7th, 10th, ...
      });

      const rule3 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 6, // Every 6 days: 1st, 7th, 13th, ...
      });

      const merged = new QuickurrenceMerge([rule1, rule2, rule3]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-15'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1 (every 2): 1, 3, 5, 7, 9, 11, 13, 15
      // Rule2 (every 3): 1, 4, 7, 10, 13
      // Rule3 (every 6): 1, 7, 13
      // Common intersection: 1, 7, 13
      expect(commonOccurrences).toHaveLength(3);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
      expect(commonOccurrences[2]).toEqual(new UTCDateMini('2024-01-13'));
    });

    it('should handle monthly rules with common occurrences', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 15,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-15'),
        rule: 'monthly',
        interval: 2, // Every 2 months on the 15th (start date day)
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-06-30'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1: Jan 15, Feb 15, Mar 15, Apr 15, May 15, Jun 15
      // Rule2: Jan 15, Mar 15, May 15 (every 2 months starting from Jan 15)
      // Common: Jan 15, Mar 15, May 15
      expect(commonOccurrences).toHaveLength(3);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
      expect(commonOccurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
    });

    it('should work with rules having different constraints', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 10,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-05'),
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-20'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1: Jan 1-10 (count limit)
      // Rule2: Jan 1-5 (end date limit)
      // Common: Jan 1-5
      expect(commonOccurrences).toHaveLength(5);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(commonOccurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
    });

    it('should work with exclusions affecting common occurrences', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [new UTCDateMini('2024-01-03')],
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2,
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-06'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Rule1: 1st, 2nd, 4th, 5th, 6th (excludes 3rd)
      // Rule2: 1st, 3rd, 5th
      // Common: 1st, 5th (3rd is excluded from rule1)
      expect(commonOccurrences).toHaveLength(2);
      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-01-05'));
    });

    it('should return empty array with empty rules array', () => {
      // This won't actually work because constructor throws error,
      // but let's test the method logic directly
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'daily',
        }),
      ]);

      // Manually set rules to empty to test edge case
      merged.rules = [];

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-05'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);
      expect(commonOccurrences).toHaveLength(0);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate identical occurrences from multiple rules', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2, // Every other day, but overlaps with rule1 on odd days
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-05'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Rule1: 1st, 2nd, 3rd, 4th, 5th
      // Rule2: 1st, 3rd, 5th
      // Merged (deduplicated): 1st, 2nd, 3rd, 4th, 5th
      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
    });

    it('should handle complex overlapping patterns', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5], // Mon, Wed, Fri
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 2, 4], // Mon, Tue, Thu (overlaps on Mon)
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-07'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Should have Mon, Tue, Wed, Thu, Fri (all weekdays)
      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04')); // Thursday
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05')); // Friday
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rules with different constraints', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        count: 3,
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-05'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-08'),
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-10'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Rule1: 1st, 2nd, 3rd (count limit)
      // Rule2: 5th, 6th, 7th, 8th (within endDate)
      // Merged: 1st, 2nd, 3rd, 5th, 6th, 7th, 8th
      expect(occurrences).toHaveLength(7);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-05'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-06'));
      expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-07'));
      expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-08'));
    });

    it('should work with rules having exclude dates and conditions', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        excludeDates: [new UTCDateMini('2024-01-03')],
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        condition: (_date, parts) => parts.day % 2 === 0, // Even dates only
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-06'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Rule1: 1st, 2nd, 4th, 5th, 6th (excludes 3rd)
      // Rule2: 2nd, 4th, 6th (even dates only)
      // Merged: 1st, 2nd, 4th, 5th, 6th
      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-05'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-06'));
    });
  });

  describe('Error handling', () => {
    it('should throw error when no rules provided', () => {
      expect(() => {
        new QuickurrenceMerge([]);
      }).toThrow('At least one rule is required for merging');
    });

    it('should throw error when rules array is null/undefined', () => {
      expect(() => {
        // @ts-expect-error - test null
        new QuickurrenceMerge(null);
      }).toThrow('At least one rule is required for merging');

      expect(() => {
        // @ts-expect-error - test undefined
        new QuickurrenceMerge(undefined);
      }).toThrow('At least one rule is required for merging');
    });

    it('should handle single rule without issues', () => {
      const rule = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
      });

      const merged = new QuickurrenceMerge([rule]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-03'),
      };

      const occurrences = merged.getAllOccurrences(range);

      expect(occurrences).toHaveLength(3);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
    });
  });

  describe('Real-world examples', () => {
    it('should find common meeting times across departments', () => {
      // Engineering meetings: Every weekday
      const engineering = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        preset: 'businessDays',
      });

      // Marketing meetings: Monday, Wednesday, Friday
      const marketing = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5], // Mon, Wed, Fri
      });

      // Sales meetings: Wednesday and Friday
      const sales = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [3, 5], // Wed, Fri
      });

      const merged = new QuickurrenceMerge([engineering, marketing, sales]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-12'),
      };

      const commonOccurrences = merged.getCommonOccurrences(range);

      // Engineering: All business days (Mon-Fri)
      // Marketing: Mon, Wed, Fri
      // Sales: Wed, Fri
      // Common: Wed, Fri (when all 3 departments meet)
      expect(commonOccurrences.length).toBeGreaterThan(0);
      commonOccurrences.forEach((occurrence) => {
        const day = utcWeekday(occurrence);
        expect(day === 3 || day === 5).toBe(true); // Only Wed (3) or Fri (5)
      });

      expect(commonOccurrences[0]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
      expect(commonOccurrences[1]).toEqual(new UTCDateMini('2024-01-05')); // Friday
    });

    it('should handle the user-provided example correctly', () => {
      // "Every 2 weeks on Mondays and every 3 weeks on Tuesdays"
      const rule = new QuickurrenceMerge([
        new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1], // Monday
          interval: 2,
        }),
        new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [2], // Tuesday
          interval: 3,
        }),
      ]);

      const occurrences = rule.getAllOccurrences({
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-02-12'),
      });

      expect(occurrences.length).toBeGreaterThan(0);

      const mondays = occurrences.filter((d) => utcWeekday(d) === 1);
      const tuesdays = occurrences.filter((d) => utcWeekday(d) === 2);

      expect(mondays.length).toBeGreaterThan(0);
      expect(tuesdays.length).toBeGreaterThan(0);

      // First occurrences should be Jan 1 (Monday) and Jan 2 (Tuesday)
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
    });

    it('should handle business days from multiple sources', () => {
      // Business days from different departments
      const engineeringMeetings = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [1, 3, 5], // Mon, Wed, Fri
      });

      const allHands = new Quickurrence({
        startDate: new UTCDateMini('2024-01-03'),
        rule: 'weekly',
        weekDays: [3], // Wednesday
        interval: 2,
      });

      const merged = new QuickurrenceMerge([engineeringMeetings, allHands]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-19'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Should include all engineering meetings plus all-hands (which overlaps on some Wednesdays)
      expect(occurrences.length).toBeGreaterThan(0);

      occurrences.forEach((occurrence) => {
        const day = utcWeekday(occurrence);
        expect(day).not.toBe(0); // Not Sunday
        expect(day).not.toBe(6); // Not Saturday
      });
    });
  });

  // Every other merge test above uses UTC rules, where a merged occurrence is
  // indistinguishable from a UTC-day boundary. These cases give the merged rules
  // a non-UTC timezone so that union and intersection are exercised against
  // rule-zone midnights, including across a DST transition. Expected instants
  // are absolute epochs derived from the rule zone's offset on that date, and
  // `getTime()` is compared because a TZDate prints in its own zone.
  describe('Non-UTC rule timezone coverage', () => {
    const WARSAW = 'Europe/Warsaw';
    const NY = 'America/New_York';
    const epochs = (dates: Date[]) => dates.map((date) => date.getTime());
    const warsawDaily = (interval: number, day: number) =>
      new Quickurrence({
        rule: 'daily',
        interval,
        startDate: new TZDate(2026, 2, day, WARSAW),
        timezone: WARSAW,
      });

    it('unions two Warsaw rules across the CET->CEST switch', () => {
      const merged = new QuickurrenceMerge([
        warsawDaily(2, 27),
        warsawDaily(3, 28),
      ]);
      expect(
        epochs(
          merged.getAllOccurrences({
            start: new Date('2026-03-27T00:00:00Z'),
            end: new Date('2026-04-03T00:00:00Z'),
          }),
        ),
      ).toEqual([
        Date.parse('2026-03-26T23:00:00.000Z'), // 2026-03-27 00:00 +01:00
        Date.parse('2026-03-27T23:00:00.000Z'), // 2026-03-28 00:00 +01:00
        Date.parse('2026-03-28T23:00:00.000Z'), // 2026-03-29 00:00 +01:00
        Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00
        Date.parse('2026-04-01T22:00:00.000Z'), // 2026-04-02 00:00 +02:00
        Date.parse('2026-04-02T22:00:00.000Z'), // 2026-04-03 00:00 +02:00
      ]);
    });

    it('intersects two Warsaw rules across the CET->CEST switch', () => {
      const merged = new QuickurrenceMerge([
        warsawDaily(2, 27),
        warsawDaily(3, 27),
      ]);
      expect(
        epochs(
          merged.getCommonOccurrences({
            start: new Date('2026-03-27T00:00:00Z'),
            end: new Date('2026-04-15T00:00:00Z'),
          }),
        ),
      ).toEqual([
        Date.parse('2026-03-26T23:00:00.000Z'), // 2026-03-27 00:00 +01:00
        Date.parse('2026-04-01T22:00:00.000Z'), // 2026-04-02 00:00 +02:00
        Date.parse('2026-04-07T22:00:00.000Z'), // 2026-04-08 00:00 +02:00
        Date.parse('2026-04-13T22:00:00.000Z'), // 2026-04-14 00:00 +02:00
      ]);
    });

    it('intersects two Warsaw weekly rules on their shared weekdays', () => {
      const weekly = (weekDays: [number, number, number]) =>
        new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 2, 23, WARSAW), // Mon 2026-03-23
          timezone: WARSAW,
          weekDays: weekDays as never,
        });
      const merged = new QuickurrenceMerge([
        weekly([1, 3, 5]), // Mon, Wed, Fri
        weekly([3, 5, 6]), // Wed, Fri, Sat
      ]);
      expect(
        epochs(
          merged.getCommonOccurrences({
            start: new Date('2026-03-23T00:00:00Z'),
            end: new Date('2026-04-05T00:00:00Z'),
          }),
        ),
      ).toEqual([
        Date.parse('2026-03-24T23:00:00.000Z'), // Wed 2026-03-25 00:00 +01:00
        Date.parse('2026-03-26T23:00:00.000Z'), // Fri 2026-03-27 00:00 +01:00
        Date.parse('2026-03-31T22:00:00.000Z'), // Wed 2026-04-01 00:00 +02:00
        Date.parse('2026-04-02T22:00:00.000Z'), // Fri 2026-04-03 00:00 +02:00
      ]);
    });

    it('keeps both zones when unioning a Warsaw and a New York rule', () => {
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 0, 1, WARSAW),
          timezone: WARSAW,
          count: 2,
        }),
        new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 0, 1, NY),
          timezone: NY,
          count: 2,
        }),
      ]);
      expect(
        epochs(
          merged.getAllOccurrences({
            start: new Date('2025-12-31T00:00:00Z'),
            end: new Date('2026-01-05T00:00:00Z'),
          }),
        ),
      ).toEqual([
        Date.parse('2025-12-31T23:00:00.000Z'), // Warsaw 2026-01-01 00:00
        Date.parse('2026-01-01T05:00:00.000Z'), // New York 2026-01-01 00:00
        Date.parse('2026-01-01T23:00:00.000Z'), // Warsaw 2026-01-02 00:00
        Date.parse('2026-01-02T05:00:00.000Z'), // New York 2026-01-02 00:00
      ]);
    });

    it('finds nothing in common between a Warsaw and a New York daily rule', () => {
      // Warsaw midnight and New York midnight are six hours apart in January,
      // so two day-level rules in those zones never share an instant.
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 0, 1, WARSAW),
          timezone: WARSAW,
        }),
        new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 0, 1, NY),
          timezone: NY,
        }),
      ]);
      expect(
        merged.getCommonOccurrences({
          start: new Date('2025-12-31T00:00:00Z'),
          end: new Date('2026-01-05T00:00:00Z'),
        }),
      ).toEqual([]);
    });

    it('returns the earliest Warsaw next occurrence across the DST switch', () => {
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 2, 30, WARSAW),
          timezone: WARSAW,
        }),
        new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
        }),
      ]);
      expect(
        merged.getNextOccurrence(new TZDate(2026, 2, 28, WARSAW)).getTime(),
      ).toBe(Date.parse('2026-03-29T22:00:00.000Z')); // 2026-03-30 00:00 +02:00
    });
  });

  // The merge used to pass a member rule's TZDate straight through, so its
  // constructor identity is what pins the plain-Date contract; `instanceof
  // Date` is satisfied by a TZDate too.
  describe('returns plain Dates', () => {
    const WARSAW = 'Europe/Warsaw';
    const merged = (timezone: string, extra: { timesOfDay?: string[] } = {}) =>
      new QuickurrenceMerge([
        new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-06-10T00:00:00.000Z'),
          timezone,
          ...extra,
        }),
        new Quickurrence({
          rule: 'weekly',
          startDate: new Date('2026-06-10T00:00:00.000Z'),
          timezone,
          ...extra,
        }),
      ]);

    for (const timezone of ['UTC', WARSAW]) {
      it(`returns a plain Date from getNextOccurrence for a ${timezone} rule`, () => {
        const next = merged(timezone).getNextOccurrence(
          new Date('2026-06-10T00:00:00.000Z'),
        );

        expect(next.constructor).toBe(Date);
        expect(next.toISOString().endsWith('Z')).toBe(true);
      });

      it(`returns a plain Date from getNextOccurrence for a ${timezone} timesOfDay rule`, () => {
        const next = merged(timezone, {
          timesOfDay: ['09:00'],
        }).getNextOccurrence(new Date('2026-06-10T00:00:00.000Z'));

        expect(next.constructor).toBe(Date);
        expect(next.toISOString().endsWith('Z')).toBe(true);
      });

      it(`returns plain Dates from getAllOccurrences for a ${timezone} rule`, () => {
        const occurrences = merged(timezone).getAllOccurrences({
          start: new Date('2026-06-10T00:00:00.000Z'),
          end: new Date('2026-06-14T00:00:00.000Z'),
        });

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          expect(occurrence.constructor).toBe(Date);
          expect(occurrence.toISOString().endsWith('Z')).toBe(true);
        });
      });
    }
  });
});

// Regression coverage for the defects reconciled in the 0.4.0 validation work,
// on the merge surface specifically.
describe('QuickurrenceMerge 0.4.0 regressions', () => {
  const START = new Date('2026-01-01T00:00:00.000Z');
  // START is a UTC midnight and every rule below is a UTC rule, so whole-day ms
  // arithmetic lands on a UTC midnight exactly. Each window is the smallest
  // that overruns the 1000 cap for its shape, so the capped runs stay fast.
  const windowOf = (days: number) => ({
    start: START,
    end: new Date(START.getTime() + days * 86_400_000),
  });

  const caughtError = (call: () => unknown) => {
    try {
      call();
    } catch (error) {
      return error;
    }
    return undefined;
  };

  const expectCode = (call: () => unknown, code: QuickurrenceErrorCode) => {
    const error = caughtError(call);
    expect(error).toBeInstanceOf(QuickurrenceError);
    expect(error).not.toBeInstanceOf(RangeError);
    expect(error).not.toBeInstanceOf(TypeError);
    expect((error as QuickurrenceError).code).toBe(code);
    return error as QuickurrenceError;
  };

  describe('the merged occurrence cap is exactly 1000', () => {
    // Generating a full 1000 occurrences is by design the heaviest work in the
    // suite, and the TZ sweep runs several zones concurrently on one machine,
    // so the default 5s per-test budget is raised rather than the assertion
    // weakened.
    const CAP_TEST_TIMEOUT_MS = 30_000;

    // Each rule is capped at 1000 on its own, so a 2-rule union used to return
    // up to 2000 and a union including a 3-slot timesOfDay rule up to 4000.
    it('caps the union of two day-level rules at 1000', () => {
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          rule: 'daily',
          startDate: START,
          timezone: 'UTC',
          interval: 2,
        }),
        new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-01-02T00:00:00.000Z'),
          timezone: 'UTC',
          interval: 2,
        }),
      ]);

      // The two interval-2 rules interleave into every day, so 1050 days is
      // the smallest window whose union overruns the cap.
      expect(merged.getAllOccurrences(windowOf(1050))).toHaveLength(1000);
    }, CAP_TEST_TIMEOUT_MS);

    it('caps a union where one rule has timesOfDay at 1000', () => {
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          rule: 'daily',
          startDate: START,
          timezone: 'UTC',
          timesOfDay: ['09:00', '18:00'],
        }),
        new Quickurrence({
          rule: 'weekly',
          startDate: START,
          timezone: 'UTC',
          weekDays: [1, 3],
        }),
      ]);

      // The 2-slot rule alone yields 1000 instants over 500 days, so 550 days
      // is enough for the union to overrun the cap.
      expect(merged.getAllOccurrences(windowOf(550))).toHaveLength(1000);
    }, CAP_TEST_TIMEOUT_MS);

    it('honours a small count exactly', () => {
      const merged = new QuickurrenceMerge([
        new Quickurrence({
          rule: 'daily',
          startDate: START,
          timezone: 'UTC',
          count: 5,
        }),
      ]);

      expect(merged.getAllOccurrences(windowOf(1050))).toHaveLength(5);
    });
  });

  describe('non-Date input is a coded error, not a bare TypeError', () => {
    const merged = () =>
      new QuickurrenceMerge([
        new Quickurrence({ rule: 'daily', startDate: START, timezone: 'UTC' }),
        new Quickurrence({
          rule: 'weekly',
          startDate: START,
          timezone: 'UTC',
          weekDays: [1],
        }),
      ]);
    const asDate = (value: string) => value as unknown as Date;

    it('rejects a string range from getAllOccurrences', () => {
      const error = expectCode(
        () =>
          merged().getAllOccurrences({
            start: asDate('2026-01-01'),
            end: asDate('2026-02-01'),
          }),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('range.start');
    });

    it('rejects a non-Date range.end from getCommonOccurrences', () => {
      const error = expectCode(
        () =>
          merged().getCommonOccurrences({
            start: START,
            end: asDate('2026-02-01'),
          }),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('range.end');
    });

    // A bad `after` is not exhaustion, so it must surface rather than be
    // reported as NO_MORE_OCCURRENCES by the merge's exhaustion handling.
    it('rejects a string argument to getNextOccurrence', () => {
      const error = expectCode(
        () => merged().getNextOccurrence(asDate('2026-01-01')),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('after');
      expect(error.code).not.toBe(QuickurrenceErrorCode.NO_MORE_OCCURRENCES);
    });

    it('still degrades to [] for a genuine Invalid Date', () => {
      expect(
        merged().getAllOccurrences({ start: START, end: new Date('not-a-date') }),
      ).toEqual([]);
    });
  });

  // A hard TS2322 for consumers: the two classes' getCondition() disagreed, so
  // a variable typed to hold either could not be assigned. Type-level identity
  // is the actual contract; the runtime check keeps the pair honest.
  describe('getCondition() matches Quickurrence declared type', () => {
    type IsExactly<A, B> =
      (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false;
    type Assert<T extends true> = T;

    type _ConditionReturnTypesMatch = Assert<
      IsExactly<
        ReturnType<QuickurrenceMerge['getCondition']>,
        ReturnType<Quickurrence['getCondition']>
      >
    >;

    it('is assignable to the same variable as Quickurrence.getCondition', () => {
      const single = new Quickurrence({
        rule: 'daily',
        startDate: START,
        timezone: 'UTC',
        condition: true,
      });
      const readCondition: () => Condition | undefined = () =>
        single.getCondition();
      const mergedRead: () => Condition | undefined = () =>
        new QuickurrenceMerge([single]).getCondition();

      expect(readCondition()).toBe(true);
      expectCode(mergedRead, QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES);
    });
  });
});
