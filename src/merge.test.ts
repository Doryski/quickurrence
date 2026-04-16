import { UTCDateMini } from '@date-fns/utc';
import { describe, expect, it } from 'vitest';
import { Quickurrence } from './index';
import { QuickurrenceMerge } from './merge';

describe('QuickurrenceMerge', () => {
  describe('Basic merging functionality', () => {
    it('should merge two daily rules with different intervals', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        interval: 2, // Every 2 days
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-02'),
        rule: 'daily',
        interval: 3, // Every 3 days
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
        interval: 2, // Every 2 weeks
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'weekly',
        weekDays: [2], // Tuesday
        interval: 3, // Every 3 weeks
      });

      const merged = new QuickurrenceMerge([rule1, rule2]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-02-12'),
      };

      const occurrences = merged.getAllOccurrences(range);

      expect(occurrences.length).toBeGreaterThan(0);

      // Should include both Monday and Tuesday occurrences
      const mondays = occurrences.filter((d) => d.getDay() === 1);
      const tuesdays = occurrences.filter((d) => d.getDay() === 2);

      expect(mondays.length).toBeGreaterThan(0);
      expect(tuesdays.length).toBeGreaterThan(0);

      // Verify specific dates
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
    });

    it('should merge monthly rules with different patterns', () => {
      const rule1 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'monthly',
        monthDay: 15, // 15th of each month
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

      // Should have occurrences from both monthly patterns
      const monthlyDates = occurrences.filter((d) => d.getDate() === 15);
      const lastMondays = occurrences.filter((d) => d.getDay() === 1);

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
        interval: 2, // Every 2 weeks on Monday
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-03'),
        rule: 'weekly',
        interval: 3, // Every 3 weeks on Wednesday
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
        count: 2, // Only 2 occurrences
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

      expect(merged.getCount()).toBe(8); // 5 + 3
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
      expect(retrievedRules).not.toBe(originalRules); // Should be a copy
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
        interval: 2, // Every other day
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
        monthDay: 15, // 15th of each month
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
        count: 10, // Only 10 occurrences
      });

      const rule2 = new Quickurrence({
        startDate: new UTCDateMini('2024-01-01'),
        rule: 'daily',
        endDate: new UTCDateMini('2024-01-05'), // Until Jan 5th
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
        interval: 2, // Every other day
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
        count: 3, // Only 3 occurrences
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
        condition: (date) => date.getDate() % 2 === 0, // Even dates only
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

      // Find days when ALL departments have meetings
      const commonOccurrences = merged.getCommonOccurrences(range);

      // Engineering: All business days (Mon-Fri)
      // Marketing: Mon, Wed, Fri
      // Sales: Wed, Fri
      // Common: Wed, Fri (when all 3 departments meet)
      expect(commonOccurrences.length).toBeGreaterThan(0);
      commonOccurrences.forEach((occurrence) => {
        const day = occurrence.getDay();
        expect(day === 3 || day === 5).toBe(true); // Only Wed (3) or Fri (5)
      });

      // Verify specific dates
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
          interval: 2, // Every 2 weeks
        }),
        new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [2], // Tuesday
          interval: 3, // Every 3 weeks
        }),
      ]);

      const occurrences = rule.getAllOccurrences({
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-02-12'),
      });

      expect(occurrences.length).toBeGreaterThan(0);

      // Verify we have both Mondays and Tuesdays
      const mondays = occurrences.filter((d) => d.getDay() === 1);
      const tuesdays = occurrences.filter((d) => d.getDay() === 2);

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
        interval: 2, // Every 2 weeks
      });

      const merged = new QuickurrenceMerge([engineeringMeetings, allHands]);

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-19'),
      };

      const occurrences = merged.getAllOccurrences(range);

      // Should include all engineering meetings plus all-hands (which overlaps on some Wednesdays)
      expect(occurrences.length).toBeGreaterThan(0);

      // Verify no weekends
      occurrences.forEach((occurrence) => {
        const day = occurrence.getDay();
        expect(day).not.toBe(0); // Not Sunday
        expect(day).not.toBe(6); // Not Saturday
      });
    });
  });
});
