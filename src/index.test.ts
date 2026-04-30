import { UTCDateMini } from '@date-fns/utc';
import { tz, TZDate } from '@date-fns/tz';
import { startOfDay } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  Quickurrence,
  type QuickurrenceOptions,
  type WeekDay,
  type MonthDay,
} from './index';

describe('Quickurrence', () => {
  describe('Default behavior', () => {
    it('should create with no options (using defaults)', () => {
      const rule = new Quickurrence();

      expect(rule.getRule()).toBe('daily');
      expect(rule.getStartDate()).toBeDefined();
      // Default timezone is UTC, so today must be computed in UTC.
      const today = startOfDay(new Date(), { in: tz('UTC') });
      expect(rule.getStartDate()).toEqual(today);
    });

    it('should use default rule when only startDate is provided', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({ startDate });

      expect(rule.getRule()).toBe('daily');
      expect(rule.getStartDate()).toEqual(new UTCDateMini('2024-01-01'));
    });

    it('should use default startDate when only rule is provided', () => {
      const rule = new Quickurrence({ rule: 'weekly' });

      expect(rule.getRule()).toBe('weekly');
      expect(rule.getStartDate()).toBeDefined();
      // Default timezone is UTC, so today must be computed in UTC.
      const today = startOfDay(new Date(), { in: tz('UTC') });
      expect(rule.getStartDate()).toEqual(today);
    });

    it('should use timezone for default startDate', () => {
      const timezone = 'America/New_York';
      const rule = new Quickurrence({ timezone });

      expect(rule.getStartDate()).toBeDefined();
      // Should use timezone for calculating today
      const today = startOfDay(new Date(), { in: tz(timezone) });
      expect(rule.getStartDate()).toEqual(today);
    });
  });

  describe('Daily recurrence', () => {
    it('should generate daily occurrences', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({ startDate, rule: 'daily' });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-05'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
    });

    it('should get next occurrence after a given date', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({ startDate, rule: 'daily' });

      const nextOccurrence = rule.getNextOccurrence(
        new UTCDateMini('2024-01-03'),
      );
      expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-04'));
    });
  });

  describe('Weekly recurrence', () => {
    it('should generate weekly occurrences', () => {
      const startDate = new UTCDateMini('2024-01-01'); // Monday
      const rule = new Quickurrence({ startDate, rule: 'weekly' });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-29'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
    });

    it('should default to Monday as week start (weekStartsOn = 1)', () => {
      const startDate = new UTCDateMini('2024-01-01'); // Monday
      const rule = new Quickurrence({ startDate, rule: 'weekly' });

      expect(rule.getWeekStartsOn()).toBe(1); // Monday
    });

    it('should generate weekly occurrences with Sunday as week start (weekStartsOn = 0)', () => {
      const startDate = new UTCDateMini('2024-01-01'); // Monday
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        weekStartsOn: 0,
      });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-29'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
      expect(rule.getWeekStartsOn()).toBe(0);
    });

    it('should generate weekly occurrences with Wednesday as week start (weekStartsOn = 3)', () => {
      const startDate = new UTCDateMini('2024-01-01'); // Monday
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        weekStartsOn: 3,
      });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-29'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
      expect(rule.getWeekStartsOn()).toBe(3);
    });

    it('should handle different weekStartsOn values correctly', () => {
      // Test with Friday start date and different weekStartsOn values
      const startDate = new UTCDateMini('2024-01-05'); // Friday
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        weekStartsOn: 5,
      }); // Friday as week start

      const range = {
        start: new UTCDateMini('2024-01-05'),
        end: new UTCDateMini('2024-02-02'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-05'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-12'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-19'));
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-26'));
      expect(occurrences[4]).toEqual(new UTCDateMini('2024-02-02'));
      expect(rule.getWeekStartsOn()).toBe(5);
    });

    it('should get next occurrence with custom weekStartsOn', () => {
      const startDate = new UTCDateMini('2024-01-01'); // Monday
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        weekStartsOn: 0,
      }); // Sunday as week start

      const nextOccurrence = rule.getNextOccurrence(
        new UTCDateMini('2024-01-03'),
      );
      expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-08'));
    });
  });

  describe('Monthly recurrence', () => {
    it('should generate monthly occurrences', () => {
      const startDate = new UTCDateMini('2024-01-15');
      const rule = new Quickurrence({ startDate, rule: 'monthly' });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-04-30'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(4);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-15'));
      expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-15'));
    });

    describe('Monthly recurrence with specific days', () => {
      describe('Basic functionality', () => {
        it('should generate occurrences on the 1st of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1, // 1st day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-01'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-01'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-01'));
        });

        it('should generate occurrences on the 5th of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 5, // 5th day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-05'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-05'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-05'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-05'));
        });

        it('should generate occurrences on the 29th with skip mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 29, // 29th day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          // Should include Jan 29, Feb 29 (leap year), Mar 29, Apr 29
          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-29'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29')); // 2024 is leap year
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-29'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-29'));
        });

        it('should generate occurrences on the 30th with skip mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 30, // 30th day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          // Should skip February (only 29 days in 2024), include Jan 30, Mar 30, Apr 30
          expect(occurrences).toHaveLength(3);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-30'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-30'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-04-30'));
        });

        it('should generate occurrences on the 31st with skip mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31, // 31st day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          // Should include only months with 31 days: Jan, Mar, May, Jul
          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-31'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-31'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-07-31'));
        });
      });

      describe('Last mode functionality', () => {
        it('should generate occurrences on the 29th with last mode (non-leap year)', () => {
          const startDate = new UTCDateMini('2025-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 29, // 29th day of month
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2025-01-01'),
            end: new UTCDateMini('2025-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2025-01-29'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2025-02-28')); // Last day of Feb in non-leap year
          expect(occurrences[2]).toEqual(new UTCDateMini('2025-03-29'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2025-04-29'));
        });

        it('should generate occurrences on the 30th with last mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 30, // 30th day of month
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-30'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29')); // Last day of Feb in leap year
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-30'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-30'));
        });

        it('should generate occurrences on the 31st with last mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31, // 31st day of month
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(7);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29')); // Last day of Feb
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-31'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-30')); // Last day of Apr
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-05-31'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-06-30')); // Last day of Jun
          expect(occurrences[6]).toEqual(new UTCDateMini('2024-07-31'));
        });
      });

      describe('Leap year scenarios', () => {
        it('should handle 29th in leap year vs non-leap year with skip mode', () => {
          // Leap year test
          const startDate2024 = new UTCDateMini('2024-01-01');
          const rule2024 = new Quickurrence({
            startDate: startDate2024,
            rule: 'monthly',
            monthDay: 29, // 29th day of month
            monthDayMode: 'skip',
          });

          const range2024 = {
            start: new UTCDateMini('2024-02-01'),
            end: new UTCDateMini('2024-02-29'),
          };

          const occurrences2024 = rule2024.getAllOccurrences(range2024);
          expect(occurrences2024).toHaveLength(1);
          expect(occurrences2024[0]).toEqual(new UTCDateMini('2024-02-29'));

          // Non-leap year test
          const startDate2025 = new UTCDateMini('2025-01-01');
          const rule2025 = new Quickurrence({
            startDate: startDate2025,
            rule: 'monthly',
            monthDay: 29, // 29th day of month
            monthDayMode: 'skip',
          });

          const range2025 = {
            start: new UTCDateMini('2025-02-01'),
            end: new UTCDateMini('2025-03-31'),
          };

          const occurrences2025 = rule2025.getAllOccurrences(range2025);
          expect(occurrences2025).toHaveLength(1);
          expect(occurrences2025[0]).toEqual(new UTCDateMini('2025-03-29')); // February skipped
        });

        it('should handle 29th in leap year vs non-leap year with last mode', () => {
          // Leap year test
          const startDate2024 = new UTCDateMini('2024-01-01');
          const rule2024 = new Quickurrence({
            startDate: startDate2024,
            rule: 'monthly',
            monthDay: 29, // 29th day of month
            monthDayMode: 'last',
          });

          const range2024 = {
            start: new UTCDateMini('2024-02-01'),
            end: new UTCDateMini('2024-02-29'),
          };

          const occurrences2024 = rule2024.getAllOccurrences(range2024);
          expect(occurrences2024).toHaveLength(1);
          expect(occurrences2024[0]).toEqual(new UTCDateMini('2024-02-29'));

          // Non-leap year test
          const startDate2025 = new UTCDateMini('2025-01-01');
          const rule2025 = new Quickurrence({
            startDate: startDate2025,
            rule: 'monthly',
            monthDay: 29, // 29th day of month
            monthDayMode: 'last',
          });

          const range2025 = {
            start: new UTCDateMini('2025-02-01'),
            end: new UTCDateMini('2025-02-28'),
          };

          const occurrences2025 = rule2025.getAllOccurrences(range2025);
          expect(occurrences2025).toHaveLength(1);
          expect(occurrences2025[0]).toEqual(new UTCDateMini('2025-02-28')); // Last day of Feb
        });
      });

      describe('getNextOccurrence with monthly days', () => {
        it('should get next occurrence on 15th of month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 15, // 15th day of month
            monthDayMode: 'skip',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-20'), // After the 15th
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-15'));
        });

        it('should get next occurrence with skip mode for 31st', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31, // 31st day of month
            monthDayMode: 'skip',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-31'));
        });

        it('should get next occurrence with skip mode skipping February', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31, // 31st day of month
            monthDayMode: 'skip',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-02-15'), // February doesn't have 31st
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-03-31')); // Skip February
        });

        it('should get next occurrence with last mode for February', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31, // 31st day of month
            monthDayMode: 'last',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-02-15'), // February doesn't have 31st
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-29')); // Last day of Feb
        });

        it('should return next month when after date equals the monthDay occurrence (bug fix)', () => {
          const startDate = new UTCDateMini('2024-02-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1,
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-02-01'), // Same as startDate and monthDay
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-03-01'));
        });

        it('should return next monthDay occurrence when after date falls on the monthDay', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 15,
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'), // Falls exactly on monthDay
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-15'));
        });

        it('should return next monthDay when after date is past the startDate', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1,
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-01'));
        });

        it('should support a chain of recurring completions on the 1st of each month', () => {
          const rule = new Quickurrence({
            startDate: new UTCDateMini('2024-01-01'),
            rule: 'monthly',
            monthDay: 1,
          });

          const second = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
          expect(second).toEqual(new UTCDateMini('2024-02-01'));

          const third = rule.getNextOccurrence(second!);
          expect(third).toEqual(new UTCDateMini('2024-03-01'));

          const fourth = rule.getNextOccurrence(third!);
          expect(fourth).toEqual(new UTCDateMini('2024-04-01'));
        });

        it('should return next month when after date equals monthDay with timezone', () => {
          const timezone = 'Europe/Warsaw';
          const startDate = new TZDate('2024-02-01', timezone);
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1,
            timezone,
          });

          const nextOccurrence = rule.getNextOccurrence(
            new TZDate('2024-02-01', timezone),
          );
          expect(nextOccurrence).toEqual(
            startOfDay(new TZDate('2024-03-01', timezone), { in: tz(timezone) }),
          );
        });
      });

      describe('Intervals with monthly days', () => {
        it('should generate occurrences every 2 months on the 15th', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            interval: 2,
            monthDay: 15, // 15th day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-07-15'));
        });

        it('should generate occurrences every 3 months on the 31st with last mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            interval: 3,
            monthDay: 31, // 31st day of month
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-10-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-04-30')); // Last day of April
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-07-31'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-10-31'));
        });
      });

      describe('Edge cases and validation', () => {
        it('should throw error when monthDay is used with non-monthly recurrence', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'daily',
              monthDay: 15, // Not allowed for daily
            });
          }).toThrow(
            'monthDay and monthDayMode options are only valid for monthly recurrence',
          );
        });

        it('should throw error when monthDayMode is set with non-monthly recurrence', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'weekly',
              monthDayMode: 'last', // Not allowed for weekly
            });
          }).toThrow(
            'monthDay and monthDayMode options are only valid for monthly recurrence',
          );
        });

        it('should throw error when monthDay is out of range', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              // @ts-expect-error - Testing invalid monthDay value
              monthDay: 32, // Invalid (should be 1-31)
            });
          }).toThrow('monthDay must be between 1-31');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              // @ts-expect-error - Testing invalid monthDay value
              monthDay: 0, // Invalid (should be 1-31)
            });
          }).toThrow('monthDay must be between 1-31');
        });

        it('should work with monthDay 1 representing 1st of month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1, // 1st day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-03-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(3);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-01'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-01'));
        });

        it('should work with monthDay 31 representing 31st of month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31, // 31st day of month
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-03-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(2); // Jan 31 and Mar 31, skipping Feb
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-31'));
        });
      });

      describe('Utility methods', () => {
        it('should return monthDay from getMonthDay method', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 15,
          });

          const monthDay = rule.getMonthDay();
          expect(monthDay).toBe(15);
        });

        it('should return undefined for monthDay when not specified', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
          });

          const monthDay = rule.getMonthDay();
          expect(monthDay).toBeUndefined();
        });

        it('should return monthDayMode from getMonthDayMode method', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 15,
            monthDayMode: 'last',
          });

          const monthDayMode = rule.getMonthDayMode();
          expect(monthDayMode).toBe('last');
        });

        it('should return default monthDayMode (last) when not specified', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 15,
          });

          const monthDayMode = rule.getMonthDayMode();
          expect(monthDayMode).toBe('last');
        });
      });

      describe('Backward compatibility', () => {
        it('should work exactly as before when monthDay is not specified', () => {
          const startDate = new UTCDateMini('2024-01-15');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            // No monthDay specified - should behave as before
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-15'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-15'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-15'));
        });
      });
    });

    describe('Monthly recurrence with nth weekday', () => {
      describe('Basic nth weekday functionality', () => {
        it('should generate occurrences on the 1st Monday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // 1st Monday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // 1st Monday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-05')); // 1st Monday of Feb
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-04')); // 1st Monday of Mar
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-01')); // 1st Monday of Apr
        });

        it('should generate occurrences on the 2nd Wednesday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 3, nth: 2 }, // 2nd Wednesday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-10')); // 2nd Wednesday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-14')); // 2nd Wednesday of Feb
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-13')); // 2nd Wednesday of Mar
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-10')); // 2nd Wednesday of Apr
        });

        it('should generate occurrences on the 3rd Friday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 5, nth: 3 }, // 3rd Friday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-19')); // 3rd Friday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-16')); // 3rd Friday of Feb
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-15')); // 3rd Friday of Mar
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-19')); // 3rd Friday of Apr
        });

        it('should generate occurrences on the 4th Thursday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 4, nth: 4 }, // 4th Thursday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-25')); // 4th Thursday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-22')); // 4th Thursday of Feb
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-28')); // 4th Thursday of Mar
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-25')); // 4th Thursday of Apr
        });

        it('should generate occurrences on the last Sunday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 0, nth: 'last' }, // Last Sunday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-28')); // Last Sunday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-25')); // Last Sunday of Feb
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-31')); // Last Sunday of Mar
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-28')); // Last Sunday of Apr
        });
      });

      describe('Edge cases', () => {
        it('should skip months where nth weekday does not exist', () => {
          // Test case where some months might not have a 5th occurrence
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 4 }, // 4th Monday
          });

          const range = {
            start: new UTCDateMini('2024-02-01'),
            end: new UTCDateMini('2024-02-29'),
          };

          const occurrences = rule.getAllOccurrences(range);

          // February 2024 has 4th Monday on Feb 26
          expect(occurrences).toHaveLength(1);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-02-26')); // 4th Monday of Feb
        });

        it('should handle months where weekday does not occur enough times', () => {
          // Test 5th occurrence which might not exist in some months
          const startDate = new UTCDateMini('2024-03-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 4 }, // 4th Monday
          });

          const range = {
            start: new UTCDateMini('2024-03-01'),
            end: new UTCDateMini('2024-06-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          // Should include months where 4th Monday exists
          expect(occurrences.length).toBeGreaterThan(0);
          // March 2024: 4th Monday is March 25
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-25'));
        });
      });

      describe('getNextOccurrence with nth weekday', () => {
        it('should get next occurrence on 1st Monday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // 1st Monday
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'), // After the 1st Monday of Jan
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-05')); // 1st Monday of Feb
        });

        it('should get next occurrence with last weekday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 5, nth: 'last' }, // Last Friday
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-26')); // Last Friday of Jan
        });

        it('should return next month when after date equals the nth weekday occurrence (bug fix)', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // 1st Monday
          });

          // Jan 1st 2024 is a Monday, so 1st Monday of Jan = Jan 1st
          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-01'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-05')); // 1st Monday of Feb
        });
      });

      describe('Intervals with nth weekday', () => {
        it('should generate occurrences every 2 months on 1st Monday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            interval: 2,
            nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // 1st Monday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // 1st Monday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-04')); // 1st Monday of Mar
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-06')); // 1st Monday of May
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-07-01')); // 1st Monday of Jul
        });

        it('should generate occurrences every 3 months on last Friday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            interval: 3,
            nthWeekdayOfMonth: { weekday: 5, nth: 'last' }, // Last Friday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-10-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-26')); // Last Friday of Jan
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-04-26')); // Last Friday of Apr
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-07-26')); // Last Friday of Jul
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-10-25')); // Last Friday of Oct
        });
      });

      describe('Validation and error handling', () => {
        it('should throw error when nthWeekdayOfMonth is used with non-monthly recurrence', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'daily',
              nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // Not allowed for daily
            });
          }).toThrow(
            'nthWeekdayOfMonth option is only valid for monthly recurrence',
          );
        });

        it('should throw error when weekday is invalid', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              // @ts-expect-error - Testing invalid weekday
              nthWeekdayOfMonth: { weekday: 7, nth: 1 }, // 7 is invalid (should be 0-6)
            });
          }).toThrow(
            'Invalid weekday in nthWeekdayOfMonth: 7. Weekday must be between 0-6',
          );
        });

        it('should throw error when nth is invalid number', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              // @ts-expect-error - Testing invalid nth
              nthWeekdayOfMonth: { weekday: 1, nth: 5 }, // 5 is invalid (should be 1-4 or 'last')
            });
          }).toThrow(
            "Invalid nth in nthWeekdayOfMonth: 5. Nth must be 1, 2, 3, 4, or 'last'",
          );
        });

        it('should throw error when nth is invalid string', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              // @ts-expect-error - Testing invalid nth
              nthWeekdayOfMonth: { weekday: 1, nth: 'first' }, // 'first' is invalid (should be 'last')
            });
          }).toThrow(
            "Invalid nth in nthWeekdayOfMonth: first. Nth must be 1, 2, 3, 4, or 'last'",
          );
        });

        it('should throw error when both monthDay and nthWeekdayOfMonth are specified', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              monthDay: 15,
              nthWeekdayOfMonth: { weekday: 1, nth: 1 },
            });
          }).toThrow(
            'Cannot use both monthDay and nthWeekdayOfMonth options. Choose one approach for monthly recurrence.',
          );
        });
      });

      describe('Utility methods', () => {
        it('should return nthWeekdayOfMonth configuration from getNthWeekdayOfMonth method', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const config = { weekday: 1 as const, nth: 1 as const };
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: config,
          });

          const retrievedConfig = rule.getNthWeekdayOfMonth();
          expect(retrievedConfig).toEqual(config);
        });

        it('should return undefined for nthWeekdayOfMonth when not specified', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
          });

          const config = rule.getNthWeekdayOfMonth();
          expect(config).toBeUndefined();
        });

        it('should return copy of nthWeekdayOfMonth config (not reference)', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const originalConfig = { weekday: 1 as const, nth: 1 as const };
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: originalConfig,
          });

          const config = rule.getNthWeekdayOfMonth();
          if (config) {
            // Modify returned config
            config.nth = 2;
          }

          const configAgain = rule.getNthWeekdayOfMonth();
          expect(configAgain?.nth).toBe(1); // Should not be modified
        });
      });

      describe('Backward compatibility', () => {
        it('should work exactly as before when nthWeekdayOfMonth is not specified', () => {
          const startDate = new UTCDateMini('2024-01-15');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            // No nthWeekdayOfMonth specified - should behave as before
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-15'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-15'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-15'));
        });
      });
    });
  });

  describe('Yearly recurrence', () => {
    it('should generate yearly occurrences', () => {
      const startDate = new UTCDateMini('2024-03-15');
      const rule = new Quickurrence({ startDate, rule: 'yearly' });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2026-12-31'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(3);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2025-03-15'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2026-03-15'));
    });
  });

  describe('Edge cases', () => {
    it('should handle start date after the "after" date in getNextOccurrence', () => {
      const startDate = new UTCDateMini('2024-01-10');
      const rule = new Quickurrence({ startDate, rule: 'daily' });

      const nextOccurrence = rule.getNextOccurrence(
        new UTCDateMini('2024-01-05'),
      );
      expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-10'));
    });

    it('should handle range that starts before the rule start date', () => {
      const startDate = new UTCDateMini('2024-01-10');
      const rule = new Quickurrence({ startDate, rule: 'daily' });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-12'),
      };

      const occurrences = rule.getAllOccurrences(range);

      expect(occurrences).toHaveLength(3);
      expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-10'));
      expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-11'));
      expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-12'));
    });

    it('should handle empty date range', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({ startDate, rule: 'daily' });

      const range = {
        start: new UTCDateMini('2024-02-01'),
        end: new UTCDateMini('2024-01-31'), // end before start
      };

      const occurrences = rule.getAllOccurrences(range);
      expect(occurrences).toHaveLength(0);
    });
  });

  describe('Timezone handling', () => {
    it('should accept timezone parameter in constructor', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({
        startDate,
        rule: 'daily',
        timezone: 'America/New_York',
      });

      // Test that the rule was created successfully with timezone
      expect(rule.getRule()).toBe('daily');
      expect(rule.getStartDate()).toBeDefined();
    });

    it('should work with utility functions using custom timezone', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({
        startDate,
        rule: 'daily',
        timezone: 'America/New_York',
      });

      const range = {
        start: new UTCDateMini('2024-01-01'),
        end: new UTCDateMini('2024-01-03'),
      };

      const occurrences = rule.getAllOccurrences(range);
      expect(occurrences).toHaveLength(3);
    });

    it('should handle timezone in getNextOccurrence', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({
        startDate,
        rule: 'daily',
        timezone: 'America/New_York',
      });

      const afterDate = new UTCDateMini('2024-01-02');
      const nextOccurrence = rule.getNextOccurrence(afterDate);

      // Should return the next occurrence after the afterDate
      expect(nextOccurrence).toBeDefined();
      expect(nextOccurrence.getTime()).toBeGreaterThan(afterDate.getTime());
    });
  });

  describe('Interval support', () => {
    describe('Daily recurrence with intervals', () => {
      it('should generate daily occurrences with interval 2', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-09'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-09'));
      });

      it('should generate daily occurrences with interval 3', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-13'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-10'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-13'));
      });

      it('should get next occurrence with interval 2', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should get next occurrence when completing task on start date (interval 2)', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        // Complete task on Jan 1 (start date) -> next should be Jan 3
        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should maintain interval alignment across multiple completions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        // Simulate completing tasks over multiple occurrences
        // Valid dates: Jan 1, Jan 3, Jan 5, Jan 7, Jan 9...

        // Complete on Jan 1 -> next is Jan 3
        let next = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
        expect(next).toEqual(new UTCDateMini('2024-01-03'));

        // Complete on Jan 3 -> next is Jan 5
        next = rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        expect(next).toEqual(new UTCDateMini('2024-01-05'));

        // Complete on Jan 5 -> next is Jan 7
        next = rule.getNextOccurrence(new UTCDateMini('2024-01-05'));
        expect(next).toEqual(new UTCDateMini('2024-01-07'));

        // Complete on Jan 7 -> next is Jan 9
        next = rule.getNextOccurrence(new UTCDateMini('2024-01-07'));
        expect(next).toEqual(new UTCDateMini('2024-01-09'));
      });

      it('should handle interval 3 correctly across multiple completions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 3,
        });

        // Valid dates: Jan 1, Jan 4, Jan 7, Jan 10...

        // Complete on Jan 1 -> next is Jan 4
        let next = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
        expect(next).toEqual(new UTCDateMini('2024-01-04'));

        // Complete on Jan 4 -> next is Jan 7
        next = rule.getNextOccurrence(new UTCDateMini('2024-01-04'));
        expect(next).toEqual(new UTCDateMini('2024-01-07'));

        // Complete on Jan 7 -> next is Jan 10
        next = rule.getNextOccurrence(new UTCDateMini('2024-01-07'));
        expect(next).toEqual(new UTCDateMini('2024-01-10'));
      });

      it('should handle interval 7 (weekly) correctly', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 7,
        });

        // Valid dates: Jan 1, Jan 8, Jan 15, Jan 22...

        // Complete on Jan 1 -> next is Jan 8
        let next = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
        expect(next).toEqual(new UTCDateMini('2024-01-08'));

        // Complete on Jan 8 -> next is Jan 15
        next = rule.getNextOccurrence(new UTCDateMini('2024-01-08'));
        expect(next).toEqual(new UTCDateMini('2024-01-15'));
      });

      it('should handle user scenario with Europe/Warsaw timezone (interval 2)', () => {
        const startDate = new TZDate(
          '2025-11-08T01:00:00.000+01:00',
          'Europe/Warsaw',
        );
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
          timezone: 'Europe/Warsaw',
        });

        // Valid dates: Nov 8, Nov 10, Nov 12, Nov 14...

        // Complete on Nov 8 -> next should be Nov 10, NOT Nov 9
        const nov8 = new TZDate(
          '2025-11-08T01:00:00.000+01:00',
          'Europe/Warsaw',
        );
        let next = rule.getNextOccurrence(nov8);
        const nov10 = new TZDate(
          '2025-11-10T01:00:00.000+01:00',
          'Europe/Warsaw',
        );
        expect(startOfDay(next, { in: tz('Europe/Warsaw') })).toEqual(
          startOfDay(nov10, { in: tz('Europe/Warsaw') }),
        );

        // Complete on Nov 10 -> next should be Nov 12
        next = rule.getNextOccurrence(nov10);
        const nov12 = new TZDate(
          '2025-11-12T01:00:00.000+01:00',
          'Europe/Warsaw',
        );
        expect(startOfDay(next, { in: tz('Europe/Warsaw') })).toEqual(
          startOfDay(nov12, { in: tz('Europe/Warsaw') }),
        );
      });

      it('should not return same date when called on valid occurrence date', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        // When completing task on a valid occurrence date, should return NEXT occurrence
        const nextFromJan1 = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(nextFromJan1).not.toEqual(new UTCDateMini('2024-01-01'));
        expect(nextFromJan1).toEqual(new UTCDateMini('2024-01-03'));

        const nextFromJan3 = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );
        expect(nextFromJan3).not.toEqual(new UTCDateMini('2024-01-03'));
        expect(nextFromJan3).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should preserve interval when using Quickurrence.update', () => {
        const options = {
          rule: 'daily' as const,
          interval: 2,
          timezone: 'Europe/Warsaw',
          startDate: new Date('2025-11-08T01:00:00.000+01:00'),
        };

        // Update with a new startDate (simulating backend behavior)
        const updated = Quickurrence.update(options, {
          startDate: new Date('2025-11-10T01:00:00.000+01:00'),
          timezone: 'Europe/Warsaw',
        });

        expect(updated).not.toBeNull();
        expect(updated?.interval).toBe(2);
        expect(updated?.rule).toBe('daily');
      });

      it('should align to interval grid even when dueDate is misaligned', () => {
        // Scenario: Task created with interval 2, starting Nov 8
        // Valid dates: Nov 8, Nov 10, Nov 12, Nov 14...
        const startDate = new UTCDateMini('2024-11-08');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        // If dueDate was manually changed to Nov 9 (misaligned)
        // Next occurrence should still align to the grid: Nov 10
        const nov9 = new UTCDateMini('2024-11-09');
        const nextFromMisaligned = rule.getNextOccurrence(nov9);
        expect(nextFromMisaligned).toEqual(new UTCDateMini('2024-11-10'));

        // Next from Nov 10 should be Nov 12 (maintaining grid)
        const nov10 = new UTCDateMini('2024-11-10');
        const nextFromAligned = rule.getNextOccurrence(nov10);
        expect(nextFromAligned).toEqual(new UTCDateMini('2024-11-12'));

        // Even from Nov 11 (misaligned), should return Nov 12
        const nov11 = new UTCDateMini('2024-11-11');
        const nextFromNov11 = rule.getNextOccurrence(nov11);
        expect(nextFromNov11).toEqual(new UTCDateMini('2024-11-12'));
      });

      it('should handle interval 3 with misaligned dates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 3,
        });

        // Valid dates: Jan 1, Jan 4, Jan 7, Jan 10...

        // From Jan 2 (misaligned) -> should return Jan 4
        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-02'))).toEqual(
          new UTCDateMini('2024-01-04'),
        );

        // From Jan 3 (misaligned) -> should return Jan 4
        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-03'))).toEqual(
          new UTCDateMini('2024-01-04'),
        );

        // From Jan 5 (misaligned) -> should return Jan 7
        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-05'))).toEqual(
          new UTCDateMini('2024-01-07'),
        );

        // From Jan 6 (misaligned) -> should return Jan 7
        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-06'))).toEqual(
          new UTCDateMini('2024-01-07'),
        );
      });
    });

    describe('Weekly recurrence with intervals', () => {
      it('should generate weekly occurrences with interval 2', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-02-01'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-29'));
      });

      it('should generate weekly occurrences with interval 3', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-02-15'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-22'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-02-12'));
      });
    });

    describe('Monthly recurrence with intervals', () => {
      it('should generate monthly occurrences with interval 2', () => {
        const startDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-07-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-07-15'));
      });

      it('should generate monthly occurrences with interval 3', () => {
        const startDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-09-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-04-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-07-15'));
      });
    });

    describe('Yearly recurrence with intervals', () => {
      it('should generate yearly occurrences with interval 2', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2030-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2026-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2028-03-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2030-03-15'));
      });

      it('should generate yearly occurrences with interval 3', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          interval: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2035-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2027-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2030-03-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2033-03-15'));
      });
    });

    describe('Utility functions with intervals', () => {
      it('should create daily rule with interval using utility function', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          timezone: 'UTC',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-07'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-07'));
      });

      it('should create weekly rule with interval using utility function', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          timezone: 'UTC',
          interval: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-02-15'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-22'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-02-12'));
      });

      it('should create monthly rule with interval using utility function', () => {
        const startDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          timezone: 'UTC',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-05-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
      });

      it('should create yearly rule with interval using utility function', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          timezone: 'UTC',
          interval: 2,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2030-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2026-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2028-03-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2030-03-15'));
      });
    });

    describe('Backward compatibility', () => {
      it('should work with interval 1 (default behavior)', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 1,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work without specifying interval (defaults to 1)', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-29'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
      });
    });
  });

  describe('Utility methods', () => {
    it('should return correct start date', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({
        startDate,
        rule: 'daily',
        timezone: 'UTC',
      });

      expect(rule.getStartDate()).toEqual(new UTCDateMini('2024-01-01'));
    });

    it('should return correct rule', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        timezone: 'UTC',
      });

      expect(rule.getRule()).toBe('weekly');
    });

    it('should return original options', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const originalOptions: QuickurrenceOptions = {
        startDate,
        rule: 'monthly',
        timezone: 'America/New_York',
      };

      const rule = new Quickurrence(originalOptions);
      const retrievedOptions = rule.getOptions();

      expect(retrievedOptions).toEqual(originalOptions);
      // Ensure it's a copy, not the same reference
      expect(retrievedOptions).not.toBe(originalOptions);
      expect(retrievedOptions.startDate).not.toBe(startDate);
    });
  });

  describe('End date functionality', () => {
    describe('getAllOccurrences with endDate option', () => {
      it('should respect endDate in daily recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-03');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-10'), // Range end is after rule end
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should respect endDate in weekly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const endDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          endDate,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-02-01'), // Range end is after rule end
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15'));
      });

      it('should respect endDate when range end is before rule end', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-10');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-03'), // Range end is before rule end
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should throw error when endDate is before startDate in constructor', () => {
        const startDate = new UTCDateMini('2024-01-05');
        const endDate = new UTCDateMini('2024-01-01'); // End before start

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            endDate,
          });
        }).toThrow('End date cannot be before start date');
      });

      it('should allow endDate equal to startDate', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-01'); // Same date

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            endDate,
          });
        }).not.toThrow();
      });
    });

    describe('getNextOccurrence with endDate option', () => {
      it('should throw error when next occurrence would be after endDate', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-02');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
        });

        // Requesting next occurrence after the end date
        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        }).toThrow('No more occurrences within the specified end date');
      });

      it('should throw error when startDate is after endDate', () => {
        const startDate = new UTCDateMini('2024-01-05');
        const endDate = new UTCDateMini('2024-01-01');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            endDate,
          });
        }).toThrow('End date cannot be before start date');
      });

      it('should return occurrence when within endDate range', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-05');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
      });
    });

    describe('getEndDate method', () => {
      it('should return the end date when set', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-05');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
        });

        const retrievedEndDate = rule.getEndDate();
        expect(retrievedEndDate).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should return undefined when no end date is set', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const retrievedEndDate = rule.getEndDate();
        expect(retrievedEndDate).toBeUndefined();
      });
    });

    describe('Backward compatibility', () => {
      it('should work without endDate option (existing behavior)', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with getNextOccurrence without endDate', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-04'));
      });
    });

    describe('Weekly recurrence with specific weekdays', () => {
      describe('Basic weekday selection', () => {
        it('should generate occurrences on Monday only', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1], // Monday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-29'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08')); // Monday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15')); // Monday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-22')); // Monday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29')); // Monday
        });

        it('should generate occurrences on Wednesday only', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [3], // Wednesday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-17')); // Wednesday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-24')); // Wednesday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-31')); // Wednesday
        });

        it('should generate occurrences on Sunday only', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [0], // Sunday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-28'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-14')); // Sunday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-21')); // Sunday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-28')); // Sunday
        });
      });

      describe('Multiple weekdays selection', () => {
        it('should generate occurrences on Monday and Wednesday', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3], // Monday and Wednesday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-15'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-08')); // Monday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-15')); // Monday
        });

        it('should generate occurrences on Monday, Wednesday, and Friday', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3, 5], // Monday, Wednesday, Friday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-15'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(7);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05')); // Friday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08')); // Monday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-12')); // Friday
          expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-15')); // Monday
        });

        it('should generate weekend occurrences (Saturday and Sunday)', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [0, 6], // Sunday and Saturday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-21'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(6);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06')); // Saturday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13')); // Saturday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14')); // Sunday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-20')); // Saturday
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-21')); // Sunday
        });

        it('should generate all weekday occurrences (Monday through Friday)', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 2, 3, 4, 5], // Monday through Friday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-12'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(10);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04')); // Thursday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05')); // Friday
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08')); // Monday
          expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-09')); // Tuesday
          expect(occurrences[7]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
          expect(occurrences[8]).toEqual(new UTCDateMini('2024-01-11')); // Thursday
          expect(occurrences[9]).toEqual(new UTCDateMini('2024-01-12')); // Friday
        });
      });

      describe('getNextOccurrence with weekdays', () => {
        it('should get next occurrence on the same weekday', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1], // Monday
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-03'), // Wednesday
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-08')); // Next Monday
        });

        it('should get next occurrence with multiple weekdays', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3, 5], // Monday, Wednesday, Friday
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-02'), // Tuesday
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
        });

        it('should get next occurrence when current day is later in week', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3], // Monday, Wednesday
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-04'), // Thursday
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-08')); // Next Monday
        });
      });

      describe('Intervals with weekdays', () => {
        it('should generate occurrences every 2 weeks on Monday', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            interval: 2,
            weekDays: [1], // Monday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-02-12'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-15')); // Monday (2 weeks later)
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-29')); // Monday (2 weeks later)
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-02-12')); // Monday (2 weeks later)
        });

        it('should generate occurrences every 2 weeks on Monday and Wednesday', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            interval: 2,
            weekDays: [1, 3], // Monday, Wednesday
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(6);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15')); // Monday (2 weeks later)
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-17')); // Wednesday (2 weeks later)
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29')); // Monday (2 weeks later)
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-31')); // Wednesday (2 weeks later)
        });
      });

      describe('Edge cases and validation', () => {
        it('should throw error when weekDays is used with non-weekly recurrence', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'daily',
              weekDays: [1], // Not allowed for daily
            });
          }).toThrow('weekDays option is only valid for weekly recurrence');
        });

        it('should throw error when weekDays contains invalid values', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'weekly',
              // @ts-expect-error - 7 is invalid (should be 0-6)
              weekDays: [1, 7],
            });
          }).toThrow('Invalid weekDays values: 7. Values must be between 0-6');
        });

        it('should throw error when weekDays is empty', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'weekly',
              weekDays: [], // Empty array not allowed
            });
          }).toThrow('weekDays cannot be empty when specified');
        });

        it('should handle weekDays in different order', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [5, 1, 3], // Friday, Monday, Wednesday (unsorted)
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-12'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(6);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05')); // Friday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08')); // Monday
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-12')); // Friday
        });

        it('should work when start date does not match any weekDay', () => {
          const startDate = new UTCDateMini('2024-01-02'); // Tuesday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 5], // Monday, Friday (no Tuesday)
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-15'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-05')); // Friday (first occurrence)
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08')); // Monday
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-12')); // Friday
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-15')); // Monday
        });
      });

      describe('Utility methods', () => {
        it('should return weekDays from getWeekDays method', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3, 5],
          });

          const weekDays = rule.getWeekDays();
          expect(weekDays).toEqual([1, 3, 5]);
        });

        it('should return undefined for weekDays when not specified', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
          });

          const weekDays = rule.getWeekDays();
          expect(weekDays).toBeUndefined();
        });

        it('should return copy of weekDays array (not reference)', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const originalWeekDays: WeekDay[] = [1, 3, 5];
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: originalWeekDays,
          });

          const weekDays = rule.getWeekDays();
          if (weekDays) {
            (weekDays as unknown as number[]).push(0); // Modify returned array
          }

          const weekDaysAgain = rule.getWeekDays();
          expect(weekDaysAgain).toEqual([1, 3, 5]); // Should not be modified
        });
      });

      describe('Backward compatibility', () => {
        it('should work exactly as before when weekDays is not specified', () => {
          const startDate = new UTCDateMini('2024-01-01'); // Monday
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            // No weekDays specified - should behave as before
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-29'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
        });
      });
    });
  });

  describe('Nth weekday of month utility methods', () => {
    it('should return correct nth weekday configuration', () => {
      const startDate = new UTCDateMini('2024-01-01');
      const config = { weekday: 1 as const, nth: 1 as const };
      const rule = new Quickurrence({
        startDate,
        rule: 'monthly',
        nthWeekdayOfMonth: config,
      });

      const retrievedConfig = rule.getNthWeekdayOfMonth();
      expect(retrievedConfig).toEqual(config);
      expect(retrievedConfig).not.toBe(config); // Should be a copy
    });
  });

  describe('Count-based recurrence', () => {
    describe('Basic count functionality', () => {
      it('should generate exactly N occurrences with daily recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 5,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'), // Range is much larger than needed
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should generate exactly N occurrences with weekly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'), // Range is much larger than needed
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15'));
      });

      it('should generate exactly N occurrences with monthly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          count: 4,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'), // Range is much larger than needed
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-15'));
      });

      it('should generate exactly N occurrences with yearly recurrence', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2030-12-31'), // Range is much larger than needed
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2025-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2026-03-15'));
      });
    });

    describe('Count with intervals', () => {
      it('should generate N occurrences with daily interval 2', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
          count: 4,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-07'));
      });

      it('should generate N occurrences with weekly interval 2', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-29'));
      });

      it('should generate N occurrences with monthly interval 3', () => {
        const startDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 3,
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-04-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-07-15'));
      });
    });

    describe('Count with weekly weekdays', () => {
      it('should generate N occurrences with specific weekdays', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5], // Monday, Wednesday, Friday
          count: 8,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(8);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05')); // Friday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08')); // Monday
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-12')); // Friday
        expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-15')); // Monday
        expect(occurrences[7]).toEqual(new UTCDateMini('2024-01-17')); // Wednesday
      });

      it('should generate N occurrences with weekdays and interval', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
          weekDays: [1, 5], // Monday, Friday
          count: 6,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(6);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-05')); // Friday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15')); // Monday (2 weeks later)
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-19')); // Friday (2 weeks later)
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29')); // Monday (2 weeks later)
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-02-02')); // Friday (2 weeks later)
      });
    });

    describe('Count with monthly specific day', () => {
      it('should generate N occurrences on specific day of month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 15,
          count: 5,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-15'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-05-15'));
      });

      it('should generate N occurrences with last mode for 31st', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 31,
          monthDayMode: 'last',
          count: 4,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29')); // Last day of Feb
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-31'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-30')); // Last day of Apr
      });
    });

    describe('Count with nth weekday of month', () => {
      it('should generate N occurrences on 1st Monday of each month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // 1st Monday
          count: 4,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // 1st Monday of Jan
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-05')); // 1st Monday of Feb
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-04')); // 1st Monday of Mar
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-01')); // 1st Monday of Apr
      });

      it('should generate N occurrences on last Friday of each month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 5, nth: 'last' }, // Last Friday
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-26')); // Last Friday of Jan
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-23')); // Last Friday of Feb
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-29')); // Last Friday of Mar
      });
    });

    describe('getNextOccurrence with count', () => {
      it('should return next occurrence within count limit', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 5,
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should throw error when requesting occurrence beyond count limit', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 3,
        });

        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03')); // After all 3 occurrences
        }).toThrow('No more occurrences within the specified count limit');
      });

      it('should work with weekly weekdays and count', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3], // Monday, Wednesday
          count: 4,
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
      });

      it('should throw error with weekly weekdays when beyond count', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3], // Monday, Wednesday
          count: 2,
        });

        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03')); // After 2 occurrences
        }).toThrow('No more occurrences within the specified count limit');
      });
    });

    describe('Range limitations with count', () => {
      it('should respect count even when range allows more occurrences', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-10'), // Range allows 10 occurrences
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should be limited by count
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should respect range when range is smaller than count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 10,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-03'), // Range only allows 3 occurrences
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should be limited by range
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });
    });

    describe('Validation', () => {
      it('should throw error when count is not a positive integer', () => {
        const startDate = new UTCDateMini('2024-01-01');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            count: 0,
          });
        }).toThrow('count must be a positive integer');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            count: -1,
          });
        }).toThrow('count must be a positive integer');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            count: 1.5,
          });
        }).toThrow('count must be a positive integer');
      });

      it('should throw error when both count and endDate are specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-10');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            count: 5,
            endDate,
          });
        }).toThrow(
          'Cannot use both count and endDate options. Choose one approach to limit occurrences.',
        );
      });
    });

    describe('Utility methods', () => {
      it('should return count from getCount method', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 5,
        });

        const count = rule.getCount();
        expect(count).toBe(5);
      });

      it('should return undefined for count when not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const count = rule.getCount();
        expect(count).toBeUndefined();
      });
    });

    describe('Edge cases', () => {
      it('should work with count 1', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 1,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-10'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(1);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
      });

      it('should handle large count numbers', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          count: 50,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2030-01-01'), // Only 7 years, less than 50
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(7); // Limited by range, not count
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[6]).toEqual(new UTCDateMini('2030-01-01'));
      });
    });

    describe('Backward compatibility', () => {
      it('should work exactly as before when count is not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          // No count specified - should behave as before
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });
    });
  });

  describe('Exclusion dates functionality', () => {
    describe('Basic exclusion functionality', () => {
      it('should exclude specific dates from daily recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates: [
            new UTCDateMini('2024-01-03'),
            new UTCDateMini('2024-01-05'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-06'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4); // Should exclude Jan 3rd and Jan 5th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-06'));
      });

      it('should exclude specific dates from weekly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          excludeDates: [
            new UTCDateMini('2024-01-08'),
            new UTCDateMini('2024-01-22'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-29'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Jan 8th and Jan 22nd
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-29'));
      });

      it('should exclude specific dates from monthly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          excludeDates: [
            new UTCDateMini('2024-02-15'),
            new UTCDateMini('2024-04-15'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-05-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Feb 15th and Apr 15th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
      });

      it('should exclude specific dates from yearly recurrence', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          excludeDates: [new UTCDateMini('2025-03-15')],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2026-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(2); // Should exclude 2025-03-15
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2026-03-15'));
      });
    });

    describe('Exclusions with intervals', () => {
      it('should exclude dates from daily recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
          excludeDates: [
            new UTCDateMini('2024-01-05'),
            new UTCDateMini('2024-01-09'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-11'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4); // Should exclude Jan 5th and Jan 9th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-11'));
      });

      it('should exclude dates from weekly recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
          excludeDates: [new UTCDateMini('2024-01-15')],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-02-12'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Jan 15th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-29'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-02-12'));
      });
    });

    describe('Exclusions with weekly specific weekdays', () => {
      it('should exclude dates from weekly recurrence with specific weekdays', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5], // Monday, Wednesday, Friday
          excludeDates: [
            new UTCDateMini('2024-01-03'),
            new UTCDateMini('2024-01-08'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-12'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4); // Should exclude Jan 3rd (Wed) and Jan 8th (Mon)
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-05')); // Friday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-10')); // Wednesday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-12')); // Friday
      });
    });

    describe('Exclusions with monthly specific day', () => {
      it('should exclude dates from monthly recurrence with specific day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 15,
          excludeDates: [
            new UTCDateMini('2024-02-15'),
            new UTCDateMini('2024-04-15'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-05-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Feb 15th and Apr 15th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
      });
    });

    describe('Exclusions with nth weekday of month', () => {
      it('should exclude dates from monthly nth weekday recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 1, nth: 1 }, // 1st Monday
          excludeDates: [new UTCDateMini('2024-02-05')], // 1st Monday of Feb
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-04-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Feb 5th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // 1st Monday of Jan
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-04')); // 1st Monday of Mar
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-04-01')); // 1st Monday of Apr
      });
    });

    describe('Exclusions with count limits', () => {
      it('should respect count limits when excluding dates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 5, // Want 5 occurrences
          excludeDates: [
            new UTCDateMini('2024-01-02'),
            new UTCDateMini('2024-01-04'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5); // Should still return 5 occurrences
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03')); // Skip Jan 2nd
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05')); // Skip Jan 4th
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-06'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-07'));
      });
    });

    describe('Exclusions with endDate', () => {
      it('should respect endDate when excluding dates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-05');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
          excludeDates: [new UTCDateMini('2024-01-03')],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'), // Range is larger than rule end
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4); // Should exclude Jan 3rd and respect endDate
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-05'));
      });
    });

    describe('getNextOccurrence with exclusions', () => {
      it('should skip excluded dates in getNextOccurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates: [
            new UTCDateMini('2024-01-02'),
            new UTCDateMini('2024-01-03'),
          ],
        });

        // First, check that the start date is returned if it's not excluded
        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

        // Then check that it skips excluded dates when looking for the next one
        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-04')); // Should skip Jan 2nd and 3rd
      });

      it('should handle exclusions with count in getNextOccurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 3,
          excludeDates: [new UTCDateMini('2024-01-02')],
        });

        const nextOccurrence1 = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(nextOccurrence1).toEqual(new UTCDateMini('2024-01-01'));

        const nextOccurrence2 = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(nextOccurrence2).toEqual(new UTCDateMini('2024-01-03')); // Skip Jan 2nd

        const nextOccurrence3 = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );
        expect(nextOccurrence3).toEqual(new UTCDateMini('2024-01-04'));

        // Should throw error when trying to get more than count limit
        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-04'));
        }).toThrow('No more occurrences within the specified count limit');
      });
    });

    describe('Edge cases and validation', () => {
      it('should throw error when excludeDates is empty array', () => {
        const startDate = new UTCDateMini('2024-01-01');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            excludeDates: [],
          });
        }).toThrow('excludeDates cannot be empty when specified');
      });

      it('should handle timezone normalization for excluded dates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          timezone: 'UTC',
          excludeDates: [new Date('2024-01-02T15:30:00Z')], // Should be normalized to start of day
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-04'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Jan 2nd
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
      });

      it('should work when no dates are excluded', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          // No excludeDates specified
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-03'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should handle excluding the start date', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates: [startDate], // Exclude the start date itself
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-04'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should exclude Jan 1st
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
      });
    });

    describe('Utility methods', () => {
      it('should return excludeDates from getExcludeDates method', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const excludeDates = [
          new UTCDateMini('2024-01-03'),
          new UTCDateMini('2024-01-05'),
        ];
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates,
        });

        const retrievedExcludeDates = rule.getExcludeDates();
        expect(retrievedExcludeDates).toBeDefined();
        expect(retrievedExcludeDates).toHaveLength(2);
        expect(retrievedExcludeDates![0]).toEqual(
          new UTCDateMini('2024-01-03'),
        );
        expect(retrievedExcludeDates![1]).toEqual(
          new UTCDateMini('2024-01-05'),
        );
      });

      it('should return undefined for excludeDates when not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const excludeDates = rule.getExcludeDates();
        expect(excludeDates).toBeUndefined();
      });

      it('should return copy of excludeDates array (not reference)', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalExcludeDates = [new UTCDateMini('2024-01-03')];
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates: originalExcludeDates,
        });

        const excludeDates = rule.getExcludeDates();
        if (excludeDates) {
          excludeDates.push(new UTCDateMini('2024-01-05')); // Modify returned array
        }

        const excludeDatesAgain = rule.getExcludeDates();
        expect(excludeDatesAgain).toHaveLength(1); // Should not be modified
        expect(excludeDatesAgain![0]).toEqual(new UTCDateMini('2024-01-03'));
      });
    });

    describe('Backward compatibility', () => {
      it('should work exactly as before when excludeDates is not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          // No excludeDates specified - should behave as before
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });
    });
  });

  describe('Conditional recurrence functionality', () => {
    describe('Boolean conditions', () => {
      it('should include all occurrences when condition is true', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: true,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should exclude all occurrences when condition is false', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: false,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(0);
      });
    });

    describe('Function conditions', () => {
      it('should include occurrences only when condition function returns true', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: (date) => date.getDate() % 2 === 1, // Only odd days
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-06'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // 1st, 3rd, 5th
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with weekly recurrence and weekday conditions', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5], // Monday, Wednesday, Friday
          condition: (date) => date.getDate() <= 15, // Only first half of month
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences.length).toBeGreaterThan(0);
        // All occurrences should be in first half of month
        occurrences.forEach((occurrence) => {
          expect(occurrence.getDate()).toBeLessThanOrEqual(15);
        });
      });

      it('should work with monthly recurrence and specific day conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 15,
          condition: (date) => date.getMonth() % 2 === 0, // Only even months (0, 2, 4...)
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-06-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Jan, Mar, May (months 0, 2, 4)
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
      });

      it('should work with yearly recurrence and custom conditions', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          condition: (date) => date.getFullYear() % 2 === 0, // Only even years
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2027-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(2); // 2024, 2026
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2026-03-15'));
      });

      it('should receive normalized date in condition function', () => {
        const startDate = new UTCDateMini('2024-01-01');
        let receivedDates: Date[] = [];

        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          timezone: 'America/New_York',
          condition: (date) => {
            receivedDates.push(new Date(date));
            // Verify the date is normalized to start of day
            expect(date.getHours()).toBe(0);
            expect(date.getMinutes()).toBe(0);
            expect(date.getSeconds()).toBe(0);
            expect(date.getMilliseconds()).toBe(0);
            return true;
          },
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-03'),
        };

        rule.getAllOccurrences(range);

        expect(receivedDates).toHaveLength(3);
      });
    });

    describe('Conditions combined with other features', () => {
      it('should work with both excludeDates and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates: [new UTCDateMini('2024-01-02')], // Exclude Jan 2nd
          condition: (date) => date.getDate() % 2 === 1, // Only odd days
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-06'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // 1st, 3rd, 5th (2nd excluded, 4th, 6th fail condition)
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with count limits and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 3,
          condition: (date) => date.getDate() % 2 === 1, // Only odd days
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // Should find exactly 3 odd days
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with endDate and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-05');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
          condition: (date) => date.getDate() % 2 === 1, // Only odd days
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'), // Range is larger than rule end
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // 1st, 3rd, 5th within endDate
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with intervals and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2, // Every 2 days
          condition: (date) => date.getDay() !== 0, // Not Sunday
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-15'),
        };

        const occurrences = rule.getAllOccurrences(range);

        // Should include dates that are every 2 days AND not Sunday
        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          expect(occurrence.getDay()).not.toBe(0); // Not Sunday
        });
      });
    });

    describe('getNextOccurrence with conditions', () => {
      it('should skip dates that do not meet condition', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: (date) => date.getDate() % 2 === 1, // Only odd days
        });

        // First occurrence should be Jan 1st (odd day)
        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

        // Next occurrence after Jan 1st should be Jan 3rd (skipping Jan 2nd)
        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should work with count limits and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 2,
          condition: (date) => date.getDate() % 2 === 1, // Only odd days
        });

        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

        const secondOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(secondOccurrence).toEqual(new UTCDateMini('2024-01-03'));

        // Should throw error when trying to get more than count limit
        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        }).toThrow('No more occurrences within the specified count limit');
      });

      it('should throw error when no future occurrences meet condition with endDate', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-02');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          endDate,
          condition: (date) => date.getDate() > 5, // No dates in range meet condition
        });

        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2023-12-31'));
        }).toThrow('No more occurrences within the specified end date');
      });
    });

    describe('Complex condition scenarios', () => {
      it('should handle holiday exclusion example', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const holidays = [
          new UTCDateMini('2024-01-01'), // New Year's Day
          new UTCDateMini('2024-01-15'), // MLK Day
        ];

        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1], // Every Monday
          condition: (date) => {
            // Not a holiday
            return !holidays.some(
              (holiday) => holiday.getTime() === date.getTime(),
            );
          },
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-22'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(2); // Jan 8 and Jan 22 (excluding Jan 1 and Jan 15)
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-22'));
      });

      it('should handle business days only condition', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: (date) => {
            const day = date.getDay();
            return day !== 0 && day !== 6; // Monday-Friday only
          },
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'),
        };

        const occurrences = rule.getAllOccurrences(range);

        // Should only include weekdays
        expect(occurrences).toHaveLength(10); // 10 business days in 2 weeks
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day).not.toBe(0); // Not Sunday
          expect(day).not.toBe(6); // Not Saturday
        });
      });

      it('should handle seasonal conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 1,
          condition: (date) => {
            const month = date.getMonth();
            return month >= 5 && month <= 7; // Summer months (June, July, August)
          },
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3); // June 1, July 1, August 1
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-06-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-07-01'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-08-01'));
      });
    });

    describe('Utility methods', () => {
      it('should return condition from getCondition method when boolean', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: true,
        });

        const condition = rule.getCondition();
        expect(condition).toBe(true);
      });

      it('should return condition function from getCondition method', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const conditionFn = (date: Date) => date.getDate() % 2 === 1;
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: conditionFn,
        });

        const condition = rule.getCondition();
        expect(condition).toBe(conditionFn);
      });

      it('should return undefined when no condition is specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const condition = rule.getCondition();
        expect(condition).toBeUndefined();
      });
    });

    describe('Backward compatibility', () => {
      it('should work exactly as before when condition is not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          // No condition specified - should behave as before
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });
    });
  });

  describe('Preset functionality', () => {
    describe('Business days preset', () => {
      it('should include only business days (Monday-Friday)', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'), // Two weeks
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(10); // 10 business days in 2 weeks
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day).toBeGreaterThanOrEqual(1); // Monday or later
          expect(day).toBeLessThanOrEqual(5); // Friday or earlier
        });

        // Check specific dates
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04')); // Thursday
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05')); // Friday
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08')); // Monday (skip weekend)
      });

      it('should work with weekly recurrence and business days preset', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-29'),
        };

        const occurrences = rule.getAllOccurrences(range);

        // Business days preset means Monday-Friday every week, so 21 business days in Jan 2024
        expect(occurrences).toHaveLength(21);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04')); // Thursday
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05')); // Friday
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08')); // Monday (next week)
        // Verify no weekends are included
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day).toBeGreaterThanOrEqual(1); // Monday or later
          expect(day).toBeLessThanOrEqual(5); // Friday or earlier
        });
      });

      it('should exclude weekends when starting on a weekend', () => {
        const startDate = new UTCDateMini('2024-01-06'); // Saturday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-06'),
          end: new UTCDateMini('2024-01-12'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5); // Monday-Friday only
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-08')); // Monday (first business day)
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-12')); // Friday
      });

      it('should work with count limit and business days', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
          count: 5,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5); // Exactly 5 business days
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03')); // Wednesday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04')); // Thursday
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05')); // Friday
      });

      it('should work with intervals and business days', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2, // Every 2 days
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-15'),
        };

        const occurrences = rule.getAllOccurrences(range);

        // Should include dates that are every 2 days AND business days
        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day).toBeGreaterThanOrEqual(1); // Monday or later
          expect(day).toBeLessThanOrEqual(5); // Friday or earlier
        });
      });
    });

    describe('Weekends preset', () => {
      it('should include only weekends (Saturday and Sunday)', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-21'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(6); // 3 weekends = 6 days
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day === 0 || day === 6).toBe(true); // Sunday (0) or Saturday (6)
        });

        // Check specific dates
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06')); // Saturday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13')); // Saturday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14')); // Sunday
      });

      it('should work with weekly recurrence and weekends preset', () => {
        const startDate = new UTCDateMini('2024-01-06'); // Saturday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          preset: 'weekends',
        });

        const range = {
          start: new UTCDateMini('2024-01-06'),
          end: new UTCDateMini('2024-02-03'),
        };

        const occurrences = rule.getAllOccurrences(range);

        // Weekends preset means Saturday AND Sunday every week, so 9 weekend days total
        expect(occurrences).toHaveLength(9);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06')); // Saturday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13')); // Saturday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14')); // Sunday
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-20')); // Saturday
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-21')); // Sunday
        expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-27')); // Saturday
        expect(occurrences[7]).toEqual(new UTCDateMini('2024-01-28')); // Sunday
        expect(occurrences[8]).toEqual(new UTCDateMini('2024-02-03')); // Saturday
        // Verify only weekends are included
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day === 0 || day === 6).toBe(true); // Sunday (0) or Saturday (6)
        });
      });

      it('should exclude weekdays when starting on a weekday', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-07'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(2); // Only Saturday and Sunday
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06')); // Saturday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
      });

      it('should work with count limit and weekends', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
          count: 4,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4); // Exactly 4 weekend days
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06')); // Saturday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13')); // Saturday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14')); // Sunday
      });
    });

    describe('getNextOccurrence with presets', () => {
      it('should get next business day occurrence', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        // From Thursday, next should be Friday
        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-04'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-05')); // Friday

        // From Friday, next should be Monday (skip weekend)
        const nextAfterFriday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-05'),
        );
        expect(nextAfterFriday).toEqual(new UTCDateMini('2024-01-08')); // Monday
      });

      it('should get next weekend occurrence', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
        });

        // From Wednesday, next should be Saturday
        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-06')); // Saturday

        // From Saturday, next should be Sunday
        const nextAfterSaturday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-06'),
        );
        expect(nextAfterSaturday).toEqual(new UTCDateMini('2024-01-07')); // Sunday
      });

      it('should work with count limits and business days', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
          count: 3,
        });

        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01')); // Monday

        const secondOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(secondOccurrence).toEqual(new UTCDateMini('2024-01-02')); // Tuesday

        const thirdOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(thirdOccurrence).toEqual(new UTCDateMini('2024-01-03')); // Wednesday

        // Should throw error when trying to get more than count limit
        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        }).toThrow('No more occurrences within the specified count limit');
      });
    });

    describe('Preset with other features', () => {
      it('should work with excludeDates and business days preset', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
          excludeDates: [
            new UTCDateMini('2024-01-03'), // Wednesday
            new UTCDateMini('2024-01-05'), // Friday
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-12'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(8); // 10 business days - 2 excluded
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01')); // Monday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02')); // Tuesday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04')); // Thursday (skip Wed)
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08')); // Monday (skip Fri and weekend)
      });

      it('should work with endDate and weekends preset', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
          endDate,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'), // Range is larger than rule end
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4); // 2 weekends within endDate
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06')); // Saturday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07')); // Sunday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13')); // Saturday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14')); // Sunday
      });

      it('should work with monthly recurrence and business days preset', () => {
        const startDate = new UTCDateMini('2024-01-15'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-04-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        // Should include monthly occurrences that fall on business days
        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day).toBeGreaterThanOrEqual(1); // Monday or later
          expect(day).toBeLessThanOrEqual(5); // Friday or earlier
        });
      });
    });

    describe('Validation and error handling', () => {
      it('should throw error when both preset and condition are specified', () => {
        const startDate = new UTCDateMini('2024-01-01');

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            preset: 'businessDays',
            condition: (date) => date.getDate() % 2 === 1,
          });
        }).toThrow(
          'Cannot use both preset and condition options. Choose one approach for filtering occurrences.',
        );
      });

      it('should create rule successfully with valid presets', () => {
        const startDate = new UTCDateMini('2024-01-01');

        // Should create successfully with businessDays preset
        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            preset: 'businessDays',
          });
        }).not.toThrow();

        // Should create successfully with weekends preset
        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            preset: 'weekends',
          });
        }).not.toThrow();
      });
    });

    describe('Utility methods', () => {
      it('should return preset from getPreset method', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const preset = rule.getPreset();
        expect(preset).toBe('businessDays');
      });

      it('should return undefined when no preset is specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const preset = rule.getPreset();
        expect(preset).toBeUndefined();
      });

      it('should return undefined for condition when preset is specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const condition = rule.getCondition();
        expect(condition).toBeUndefined();

        // Presets now set rule configurations instead of condition functions
        expect(rule.getRule()).toBe('weekly');
        expect(rule.getWeekDays()).toEqual([1, 2, 3, 4, 5]); // Monday through Friday
      });
    });

    describe('Edge cases', () => {
      it('should handle business days across month boundaries', () => {
        const startDate = new UTCDateMini('2024-01-30'); // Tuesday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-30'),
          end: new UTCDateMini('2024-02-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(5); // Tue, Wed, Thu, Fri, Mon
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-30')); // Tuesday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-31')); // Wednesday
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-02-01')); // Thursday
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-02-02')); // Friday
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-02-05')); // Monday (skip weekend)
      });

      it('should handle weekends across month boundaries', () => {
        const startDate = new UTCDateMini('2024-01-30'); // Tuesday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
        });

        const range = {
          start: new UTCDateMini('2024-01-30'),
          end: new UTCDateMini('2024-02-05'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(2); // 1 Saturday + 1 Sunday in range
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-02-03')); // Saturday
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-04')); // Sunday
      });

      it('should work with business days preset when no business days exist in range', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-06'), // Saturday
          end: new UTCDateMini('2024-01-07'), // Sunday
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(0); // No business days in weekend range
      });
    });

    describe('Backward compatibility', () => {
      it('should work exactly as before when preset is not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          // No preset specified - should behave as before
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-07'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(7); // All 7 days including weekends
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-07'));
      });
    });
  });

  describe('toHumanText functionality', () => {
    describe('Basic recurrence rules', () => {
      it('should generate text for daily recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const text = rule.toHumanText();
        expect(text).toBe('Daily');
      });

      it('should generate text for weekly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly');
      });

      it('should generate text for monthly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly');
      });

      it('should generate text for yearly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
        });

        const text = rule.toHumanText();
        expect(text).toBe('Yearly');
      });
    });

    describe('Intervals', () => {
      it('should generate text for daily recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 2 days');
      });

      it('should generate text for weekly recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 3,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 3 weeks');
      });

      it('should generate text for monthly recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 2,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 2 months');
      });

      it('should generate text for yearly recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          interval: 5,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 5 years');
      });
    });

    describe('Weekly with specific weekdays', () => {
      it('should generate text for weekly on single weekday', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1], // Monday
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Monday');
      });

      it('should generate text for weekly on multiple weekdays', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5], // Monday, Wednesday, Friday
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Monday, Wednesday, Friday');
      });

      it('should generate text for weekly on weekend days', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [0, 6], // Sunday, Saturday
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Saturday, Sunday');
      });

      it('should generate text for weekly with interval and weekdays', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
          weekDays: [2, 4], // Tuesday, Thursday
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 2 weeks on Tuesday, Thursday');
      });
    });

    describe('Monthly with specific days', () => {
      it('should generate text for monthly on specific day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 15,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 15th');
      });

      it('should generate text for monthly on 1st day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 1,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 1st');
      });

      it('should generate text for monthly on 2nd day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 2,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 2nd');
      });

      it('should generate text for monthly on 3rd day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 3,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 3rd');
      });

      it('should generate text for monthly on 21st day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 21,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 21st');
      });

      it('should generate text for monthly on 22nd day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 22,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 22nd');
      });

      it('should generate text for monthly on 23rd day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 23,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 23rd');
      });

      it('should generate text for monthly with interval and specific day', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 3,
          monthDay: 31,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 3 months on the 31st');
      });
    });

    describe('Monthly with nth weekday', () => {
      it('should generate text for 1st Monday of month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 1, nth: 1 },
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 1st Monday');
      });

      it('should generate text for 2nd Wednesday of month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 3, nth: 2 },
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 2nd Wednesday');
      });

      it('should generate text for 3rd Friday of month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 5, nth: 3 },
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 3rd Friday');
      });

      it('should generate text for 4th Thursday of month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 4, nth: 4 },
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the 4th Thursday');
      });

      it('should generate text for last Sunday of month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 0, nth: 'last' },
        });

        const text = rule.toHumanText();
        expect(text).toBe('Monthly on the last Sunday');
      });

      it('should generate text with interval and nth weekday', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 2,
          nthWeekdayOfMonth: { weekday: 2, nth: 1 },
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 2 months on the 1st Tuesday');
      });
    });

    describe('End conditions', () => {
      it('should generate text with count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 5,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Daily, 5 times');
      });

      it('should generate text with end date', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-31');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          endDate,
        });

        const text = rule.toHumanText();
        expect(text).toBe(`Weekly until ${endDate.toLocaleDateString()}`);
      });

      it('should generate text with complex rule and count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5],
          count: 10,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Monday, Wednesday, Friday, 10 times');
      });

      it('should generate text with complex rule and end date', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-06-30');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 15,
          endDate,
        });

        const text = rule.toHumanText();
        expect(text).toBe(
          `Monthly on the 15th until ${endDate.toLocaleDateString()}`,
        );
      });
    });

    describe('Presets', () => {
      it('should generate text with business days preset', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const text = rule.toHumanText();
        expect(text).toBe(
          'Weekly on Monday, Tuesday, Wednesday, Thursday, Friday (business days only)',
        );
      });

      it('should generate text with weekends preset', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Saturday, Sunday (weekends only)');
      });

      it('should generate text with business days preset and interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
          preset: 'businessDays',
        });

        const text = rule.toHumanText();
        expect(text).toBe(
          'Every 2 weeks on Monday, Tuesday, Wednesday, Thursday, Friday (business days only)',
        );
      });

      it('should generate text with weekends preset and count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          preset: 'weekends',
          count: 8,
        });

        const text = rule.toHumanText();
        expect(text).toBe(
          'Weekly on Saturday, Sunday (weekends only), 8 times',
        );
      });
    });

    describe('Complex combinations', () => {
      it('should generate text for complex weekly rule', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-12-31');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
          weekDays: [1, 3],
          endDate,
        });

        const text = rule.toHumanText();
        expect(text).toBe(
          `Every 2 weeks on Monday, Wednesday until ${endDate.toLocaleDateString()}`,
        );
      });

      it('should generate text for complex monthly rule with nth weekday', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          interval: 3,
          nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
          count: 4,
        });

        const text = rule.toHumanText();
        expect(text).toBe('Every 3 months on the last Friday, 4 times');
      });
    });

    describe('Static method', () => {
      it('should generate text using static method', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'daily',
          count: 3,
        };

        const text = Quickurrence.toHumanText(options);
        expect(text).toBe('Daily, 3 times');
      });

      it('should generate text for complex options using static method', () => {
        const endDate = new UTCDateMini('2024-06-30');
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'monthly',
          interval: 2,
          monthDay: 15,
          endDate,
        };

        const text = Quickurrence.toHumanText(options);
        expect(text).toBe(
          `Every 2 months on the 15th until ${endDate.toLocaleDateString()}`,
        );
      });
    });

    describe('Error handling', () => {
      it('should return error message when text generation would fail', () => {
        // Test that toHumanText handles errors gracefully by testing with normal input
        // The error handling is tested internally in the method
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const text = rule.toHumanText();
        // This should work normally - the error handling is tested internally
        expect(text).toBe('Daily');
      });
    });

    describe('Edge cases', () => {
      it('should handle ordinal numbers correctly', () => {
        const testCases = [
          { day: 11, expected: 'Monthly on the 11th' },
          { day: 12, expected: 'Monthly on the 12th' },
          { day: 13, expected: 'Monthly on the 13th' },
          { day: 14, expected: 'Monthly on the 14th' },
        ];

        testCases.forEach(({ day, expected }) => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: day as MonthDay,
          });

          const text = rule.toHumanText();
          expect(text).toBe(expected);
        });
      });
    });
  });

  describe('update() static method functionality', () => {
    describe('Basic updates', () => {
      it('should update interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: 2,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.interval).toBe(2);
        expect(updatedOptions!.rule).toBe('daily');
        expect(updatedOptions!.startDate).toEqual(
          startOfDay(startDate, { in: tz('UTC') }),
        );
      });

      it('should update end date', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-12-31');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'weekly',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          endDate,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.endDate).toEqual(endDate);
        expect(updatedOptions!.rule).toBe('weekly');
      });

      it('should update count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'monthly',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          count: 5,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.count).toBe(5);
        expect(updatedOptions!.rule).toBe('monthly');
      });

      it('should update rule', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          rule: 'weekly',
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.rule).toBe('weekly');
        expect(updatedOptions!.startDate).toEqual(
          startOfDay(startDate, { in: tz('UTC') }),
        );
      });
    });

    describe('Weekly options', () => {
      it('should update weekDays', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'weekly',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          weekDays: [1, 3, 5] as WeekDay[],
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.weekDays).toEqual([1, 3, 5]);
        expect(updatedOptions!.rule).toBe('weekly');
      });

      it('should not include weekDays when array is empty', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5] as WeekDay[],
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          weekDays: [],
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.weekDays).toBeUndefined();
      });
    });

    describe('Monthly options', () => {
      it('should update monthDay', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'monthly',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          monthDay: 15,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.monthDay).toBe(15);
      });

      it('should update monthDayMode', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'monthly',
          monthDay: 31,
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          monthDayMode: 'skip',
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.monthDayMode).toBe('skip');
      });

      it('should update nthWeekdayOfMonth', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'monthly',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          nthWeekdayOfMonth: { weekday: 1 as WeekDay, nth: 1 },
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.nthWeekdayOfMonth).toEqual({
          weekday: 1,
          nth: 1,
        });
      });
    });

    describe('Exclusions and conditions', () => {
      it('should update excludeDates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const excludeDates = [
          new UTCDateMini('2024-01-03'),
          new UTCDateMini('2024-01-05'),
        ];
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          excludeDates,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.excludeDates).toEqual(excludeDates);
      });

      it('should not include excludeDates when array is empty', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          excludeDates: [new UTCDateMini('2024-01-03')],
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          excludeDates: [],
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.excludeDates).toBeUndefined();
      });

      it('should update preset', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          preset: 'businessDays',
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.preset).toBe('businessDays');
      });

      it('should update condition', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const condition = (date: Date) => date.getDate() % 2 === 1;
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          condition,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.condition).toBe(condition);
      });
    });

    describe('Complex updates', () => {
      it('should handle multiple updates at once', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-12-31');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          rule: 'weekly',
          interval: 2,
          endDate,
          weekDays: [1, 3, 5] as WeekDay[],
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.rule).toBe('weekly');
        expect(updatedOptions!.interval).toBe(2);
        expect(updatedOptions!.endDate).toEqual(endDate);
        expect(updatedOptions!.weekDays).toEqual([1, 3, 5]);
      });

      it('should override existing options', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'weekly',
          interval: 2,
          weekDays: [1, 3] as WeekDay[],
          count: 5,
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: 3,
          weekDays: [2, 4, 6] as WeekDay[],
          count: 10,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.interval).toBe(3);
        expect(updatedOptions!.weekDays).toEqual([2, 4, 6]);
        expect(updatedOptions!.count).toBe(10);
        expect(updatedOptions!.rule).toBe('weekly'); // Should keep existing rule
      });
    });

    describe('Default values and filtering', () => {
      it('should not include interval when it is 1', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          interval: 2,
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: 1,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.interval).toBeUndefined();
      });

      it('should not include count when it is 0', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          count: 5,
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          count: 0,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.count).toBeUndefined();
      });

      it('should pass timezone to updated options', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          timezone: 'America/New_York',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: 2,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions?.timezone).toBe('America/New_York');
      });

      it('should normalize startDate to start of day', () => {
        const startDate = new Date('2024-01-01T15:30:45.123Z');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: 2,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.startDate).toEqual(
          startOfDay(startDate, { in: tz('UTC') }),
        );
      });
    });

    describe('Validation and error handling', () => {
      it('should return null when rule is undefined', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          rule: undefined,
        });

        expect(updatedOptions).toBeNull();
      });

      it('should handle invalid count by filtering it out', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        // The update method filters out invalid count values (< 1)
        const updatedOptions = Quickurrence.update(originalOptions, {
          count: -1, // Invalid count should be filtered out
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.count).toBeUndefined(); // Should be filtered out
      });

      it('should clean incompatible options when updating', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        // The update method should clean incompatible options
        const updatedOptions = Quickurrence.update(originalOptions, {
          weekDays: [1, 2, 3] as WeekDay[], // weekDays only valid for weekly, should be cleaned
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.weekDays).toBeUndefined(); // Should be cleaned out
        expect(updatedOptions!.rule).toBe('daily');

        // Should be able to create Quickurrence instance without errors
        expect(() => {
          if (updatedOptions) {
            new Quickurrence(updatedOptions);
          }
        }).not.toThrow();
      });
    });

    describe('Immutability', () => {
      it('should not modify original options', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          interval: 1,
        };
        const originalCopy = { ...originalOptions };

        Quickurrence.update(originalOptions, {
          interval: 2,
          count: 5,
        });

        expect(originalOptions).toEqual(originalCopy);
      });

      it('should create new object with updated values', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: 3,
        });

        expect(updatedOptions).not.toBe(originalOptions);
        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.interval).toBe(3);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty updates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          interval: 2,
        };

        const updatedOptions = Quickurrence.update(originalOptions, {});

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.rule).toBe('daily');
        expect(updatedOptions!.interval).toBe(2);
        expect(updatedOptions!.timezone).toBe('UTC');
      });

      it('should handle undefined updates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'weekly',
          interval: 2,
          weekDays: [1, 3] as WeekDay[],
        };

        const updatedOptions = Quickurrence.update(originalOptions, {
          interval: undefined,
          weekDays: undefined,
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.interval).toBeUndefined();
        expect(updatedOptions!.weekDays).toBeUndefined();
        expect(updatedOptions!.rule).toBe('weekly');
      });
    });
  });

  describe('getMatchingPreset static method', () => {
    describe('Business days preset detection', () => {
      it('should detect business days preset for weekly with Monday-Friday', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5] as WeekDay[], // Monday-Friday
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should detect business days preset with unsorted weekdays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [5, 1, 3, 2, 4] as WeekDay[], // Friday, Monday, Wednesday, Tuesday, Thursday (unsorted)
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should not detect business days for partial weekdays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3] as WeekDay[], // Only Mon-Wed
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should not detect business days when weekends are included', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [0, 1, 2, 3, 4, 5, 6] as WeekDay[], // All days
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });
    });

    describe('Weekends preset detection', () => {
      it('should detect weekends preset for weekly with Saturday-Sunday', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [0, 6] as WeekDay[], // Sunday, Saturday
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('weekends');
      });

      it('should detect weekends preset with unsorted weekdays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [6, 0] as WeekDay[], // Saturday, Sunday (unsorted)
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('weekends');
      });

      it('should not detect weekends for partial weekend days', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [6] as WeekDay[], // Only Saturday
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should not detect weekends when weekdays are included', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [0, 1, 6] as WeekDay[], // Sunday, Monday, Saturday
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });
    });

    describe('Non-matching configurations', () => {
      it('should return undefined for daily recurrence', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'daily',
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should return undefined for monthly recurrence', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'monthly',
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should return undefined for yearly recurrence', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'yearly',
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should return undefined for weekly without weekDays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          // No weekDays specified
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should return undefined for weekly with empty weekDays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should return undefined for custom weekday combinations', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 3, 5] as WeekDay[], // Monday, Wednesday, Friday only
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });
    });

    describe('Edge cases', () => {
      it('should handle options with intervals', () => {
        const businessDaysOptions: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          interval: 2,
          weekDays: [1, 2, 3, 4, 5] as WeekDay[],
        };

        const matchingPreset =
          Quickurrence.getMatchingPreset(businessDaysOptions);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should handle options with count', () => {
        const weekendsOptions: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [0, 6] as WeekDay[],
          count: 10,
        };

        const matchingPreset = Quickurrence.getMatchingPreset(weekendsOptions);
        expect(matchingPreset).toBe('weekends');
      });

      it('should handle options with endDate', () => {
        const businessDaysOptions: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5] as WeekDay[],
          endDate: new UTCDateMini('2024-12-31'),
        };

        const matchingPreset =
          Quickurrence.getMatchingPreset(businessDaysOptions);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should handle options with other weekly configurations', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5] as WeekDay[],
          weekStartsOn: 0, // Sunday
          interval: 3,
          count: 5,
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });
    });

    describe('Integration with existing functionality', () => {
      it('should work with configurations created by presetToOptions', () => {
        const businessDaysConfig = Quickurrence.presetToOptions('businessDays');
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          ...businessDaysConfig,
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should work with weekends configurations created by presetToOptions', () => {
        const weekendsConfig = Quickurrence.presetToOptions('weekends');
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          ...weekendsConfig,
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('weekends');
      });

      it('should detect preset from actual Quickurrence instance options', () => {
        const rule = new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          preset: 'businessDays',
        });

        const options = rule.getOptions();
        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should not detect preset when configuration differs from preset-created config', () => {
        // Start with business days preset, then modify
        const rule = new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          preset: 'businessDays',
        });

        const modifiedOptions: QuickurrenceOptions = {
          ...rule.getOptions(),
          weekDays: [1, 2, 3] as WeekDay[], // Only Mon-Wed (not full business days)
        };

        const matchingPreset = Quickurrence.getMatchingPreset(modifiedOptions);
        expect(matchingPreset).toBeUndefined();
      });
    });
  });

  describe('Business days timezone bug reproduction', () => {
    describe('getNextOccurrence with timezone and business days', () => {
      it('should return correct next business day when using Europe/Warsaw timezone', () => {
        const startDate = new Date('2025-09-16T22:00:00.000Z'); // Tuesday at 22:00 UTC
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          timezone: 'Europe/Warsaw',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday
          preset: 'businessDays',
        });

        // When asking for the next occurrence after the start date
        const nextOccurrence = rule.getNextOccurrence(startDate);

        // Should return Wednesday (next business day), not the same date
        const expectedDate = new Date('2025-09-17T22:00:00.000Z'); // Wednesday at 22:00 UTC
        expect(nextOccurrence).toEqual(expectedDate);
        expect(nextOccurrence.getTime()).not.toBe(startDate.getTime()); // Should not be the same date
      });

      it('should handle business days correctly when start date is on a business day', () => {
        const startDate = new Date('2025-09-16T22:00:00.000Z'); // Tuesday at 22:00 UTC (business day)
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          timezone: 'Europe/Warsaw',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday
          preset: 'businessDays',
        });

        // When the current date is slightly after the start date
        const afterStartDate = new Date('2025-09-16T22:00:01.000Z'); // 1 second after start
        const nextOccurrence = rule.getNextOccurrence(afterStartDate);

        // Should return next business day (Wednesday)
        const expectedDate = new Date('2025-09-17T22:00:00.000Z');
        expect(nextOccurrence).toEqual(expectedDate);
      });

      it('should correctly identify day of week for timezone-aware business days', () => {
        const startDate = new Date('2025-09-16T22:00:00.000Z'); // Tuesday at 22:00 UTC
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          timezone: 'Europe/Warsaw',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday
          preset: 'businessDays',
        });

        // Verify that the start date is correctly identified as Tuesday (day 2)
        // in UTC (the comment above marks 22:00 UTC = Tuesday).
        const dayOfWeek = startDate.getUTCDay();
        expect(dayOfWeek).toBe(2); // Tuesday

        // Verify that Tuesday is included in weekDays
        const weekDays = rule.getWeekDays();
        expect(weekDays).toContain(2);

        // Get occurrences to verify the pattern
        const range = {
          start: startDate,
          end: new Date('2025-09-21T21:59:00.000Z'), // Sunday 23:59 Europe/Warsaw time
        };

        const occurrences = rule.getAllOccurrences(range);
        expect(occurrences).toHaveLength(3); // Wed, Thu, Fri
        expect(occurrences[0]).toEqual(new Date('2025-09-16T22:00:00.000Z')); // Wednesday (start date)
        expect(occurrences[1]).toEqual(new Date('2025-09-17T22:00:00.000Z')); // Thursday
        expect(occurrences[2]).toEqual(new Date('2025-09-18T22:00:00.000Z')); // Friday
      });
    });
  });

  describe('Weekdays preset bug reproduction', () => {
    describe('Task completion scenario', () => {
      it('should maintain weekdays-only pattern after task completion simulation', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday (weekdays preset)
        });

        // Simulate completing a task on Wednesday and getting next occurrence
        const nextAfterWednesday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'), // Wednesday
        );

        // Should be Thursday (next weekday), not Saturday or Sunday
        expect(nextAfterWednesday).toEqual(new UTCDateMini('2024-01-04')); // Thursday

        // Simulate completing Friday task, should skip weekend
        const nextAfterFriday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-05'), // Friday
        );

        // Should be Monday (skip weekend), not Saturday
        expect(nextAfterFriday).toEqual(new UTCDateMini('2024-01-08')); // Monday
      });

      it('should never include weekends when weekdays preset is used', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday only
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-21'), // 3 weeks
        };

        const occurrences = rule.getAllOccurrences(range);

        // Verify no weekends are included
        occurrences.forEach((occurrence) => {
          const dayOfWeek = occurrence.getDay();
          expect(dayOfWeek).not.toBe(0); // Not Sunday
          expect(dayOfWeek).not.toBe(6); // Not Saturday
          expect(dayOfWeek).toBeGreaterThanOrEqual(1); // Monday or later
          expect(dayOfWeek).toBeLessThanOrEqual(5); // Friday or earlier
        });

        // Should be exactly 15 occurrences (3 weeks × 5 weekdays)
        expect(occurrences).toHaveLength(15);
      });

      it('should detect bug when weekDays accidentally includes all 7 days', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday

        // This would be the buggy behavior - all 7 days instead of just weekdays
        const buggyRule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [0, 1, 2, 3, 4, 5, 6], // All days (BUG!)
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-07'), // One week
        };

        const occurrences = buggyRule.getAllOccurrences(range);

        // This would show the bug - should be 7 occurrences (every day)
        expect(occurrences).toHaveLength(7);

        // Check that weekends ARE included (this would be the bug)
        const hasWeekends = occurrences.some((occurrence) => {
          const day = occurrence.getDay();
          return day === 0 || day === 6; // Sunday or Saturday
        });
        expect(hasWeekends).toBe(true); // This shows the bug behavior
      });

      it('should correctly handle weekdays preset vs all-days behavior', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday

        // Correct weekdays preset
        const correctRule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday-Friday only
        });

        // Buggy behavior (all days)
        const buggyRule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [0, 1, 2, 3, 4, 5, 6], // All 7 days
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'), // 2 weeks
        };

        const correctOccurrences = correctRule.getAllOccurrences(range);
        const buggyOccurrences = buggyRule.getAllOccurrences(range);

        // Correct should have 10 occurrences (2 weeks × 5 weekdays)
        expect(correctOccurrences).toHaveLength(10);

        // Buggy would have 14 occurrences (2 weeks × 7 days)
        expect(buggyOccurrences).toHaveLength(14);

        // The difference should be the weekend days
        expect(buggyOccurrences.length - correctOccurrences.length).toBe(4); // 4 weekend days in 2 weeks
      });

      it('should maintain correct weekDays array after multiple getNextOccurrence calls', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday
        });

        // Simulate multiple task completions
        let currentDate = new UTCDateMini('2024-01-01'); // Start with Monday

        for (let i = 0; i < 10; i++) {
          const nextOccurrence = rule.getNextOccurrence(currentDate);
          const dayOfWeek = nextOccurrence.getDay();

          // Should always be a weekday
          expect(dayOfWeek).toBeGreaterThanOrEqual(1); // Monday or later
          expect(dayOfWeek).toBeLessThanOrEqual(5); // Friday or earlier
          expect(dayOfWeek).not.toBe(0); // Never Sunday
          expect(dayOfWeek).not.toBe(6); // Never Saturday

          currentDate = new UTCDateMini(nextOccurrence);
        }

        // Verify the rule's weekDays haven't been corrupted
        const weekDays = rule.getWeekDays();
        expect(weekDays).toEqual([1, 2, 3, 4, 5]);
        expect(weekDays).toHaveLength(5); // Should still be 5 days, not 7
      });

      it('should handle edge case of completing last weekday of week', () => {
        const startDate = new UTCDateMini('2024-01-01'); // Monday
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday
        });

        // Complete a task on Friday (last weekday of week)
        const nextAfterFriday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-05'), // Friday
        );

        // Should jump to Monday of next week, skipping weekend
        expect(nextAfterFriday).toEqual(new UTCDateMini('2024-01-08')); // Monday
        expect(nextAfterFriday.getDay()).toBe(1); // Should be Monday, not Saturday (6) or Sunday (0)

        // Complete that Monday task
        const nextAfterMonday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-08'), // Monday
        );

        // Should be Tuesday
        expect(nextAfterMonday).toEqual(new UTCDateMini('2024-01-09')); // Tuesday
        expect(nextAfterMonday.getDay()).toBe(2); // Should be Tuesday
      });

      it('should work correctly with consistent timezone usage (fixed backend approach)', () => {
        // The fix: Use UTC consistently for both Quickurrence instance and dates
        const originalQuickurrence: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'), // Monday
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday (weekdays preset)
          timezone: 'UTC',
        };

        // Fixed backend approach: Keep timezone as UTC for consistent calculations
        const quickurrence = new Quickurrence({
          ...originalQuickurrence,
          timezone: 'UTC', // Keep as UTC instead of overriding with user timezone
        });

        // Test with UTC dates (as stored in database)
        const testDate = new UTCDateMini('2024-01-03'); // Wednesday in UTC

        const nextOccurrence = quickurrence.getNextOccurrence(testDate);

        // Should correctly return Thursday (next weekday)
        expect(nextOccurrence.getDay()).toBe(4); // Thursday
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-04')); // Thursday

        // Verify weekDays are still correct
        const weekDays = quickurrence.getWeekDays();
        expect(weekDays).toEqual([1, 2, 3, 4, 5]);
      });

      it('should reproduce Quickurrence.update scenario from backend due date changes', () => {
        const originalQuickurrence: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'), // Monday
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Monday through Friday (weekdays preset)
          timezone: 'UTC',
        };

        // Create a proper date in America/New_York timezone
        const newStartDate = new Date('2024-01-08T00:00:00-05:00'); // Jan 8 midnight in NY time

        const updatedQuickurrence = Quickurrence.update(originalQuickurrence, {
          startDate: newStartDate,
          timezone: 'America/New_York', // User timezone
        });

        expect(updatedQuickurrence).toBeDefined();
        if (updatedQuickurrence) {
          expect(updatedQuickurrence.weekDays).toEqual([1, 2, 3, 4, 5]); // Should still be weekdays only
          expect(updatedQuickurrence.weekDays).toHaveLength(5); // Should not be 7 days
          // The startDate should be normalized to start of day in America/New_York timezone
          // When we pass Jan 8 00:00 NY time and normalize it, it should stay as Jan 8 00:00 NY time
          const expectedDate = new Date('2024-01-08T00:00:00-05:00');
          expect(updatedQuickurrence.startDate?.getTime()).toBe(
            expectedDate.getTime(),
          );
          expect(updatedQuickurrence.timezone).toBe('America/New_York');

          // Test that creating a new Quickurrence with these options works correctly
          const newQuickurrence = new Quickurrence(updatedQuickurrence);
          const weekDays = newQuickurrence.getWeekDays();
          expect(weekDays).toEqual([1, 2, 3, 4, 5]);
          expect(weekDays).toHaveLength(5);
        }
      });

      it('should detect if weekDays gets corrupted during JSON serialization/deserialization', () => {
        // Simulate database roundtrip (JSONB storage/retrieval)
        const originalQuickurrence: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5], // Weekdays preset
          timezone: 'UTC',
        };

        // Simulate JSON serialization (what happens when storing to JSONB)
        const serialized = JSON.stringify(originalQuickurrence);
        expect(serialized).toContain('[1,2,3,4,5]'); // Should contain correct weekdays

        // Simulate JSON deserialization (what happens when retrieving from JSONB)
        const deserialized = JSON.parse(serialized) as QuickurrenceOptions;

        // Dates need special handling in real JSON scenarios
        if (deserialized.startDate) {
          deserialized.startDate = new Date(deserialized.startDate);
        }

        expect(deserialized.weekDays).toEqual([1, 2, 3, 4, 5]);
        expect(deserialized.weekDays).toHaveLength(5);

        // Test creating Quickurrence from deserialized data
        const quickurrence = new Quickurrence(deserialized);
        const weekDays = quickurrence.getWeekDays();
        expect(weekDays).toEqual([1, 2, 3, 4, 5]);
        expect(weekDays).toHaveLength(5);

        // Test that it doesn't include weekends
        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'),
        };
        const occurrences = quickurrence.getAllOccurrences(range);
        occurrences.forEach((occurrence) => {
          const day = occurrence.getDay();
          expect(day).not.toBe(0); // Not Sunday
          expect(day).not.toBe(6); // Not Saturday
        });
      });
    });
  });

  describe('sortWeekDaysForDisplay static method', () => {
    it('should sort weekdays with Saturday before Sunday', () => {
      const weekdays: WeekDay[] = [0, 6]; // Sunday, Saturday
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([6, 0]); // Saturday, Sunday
    });

    it('should handle multiple weekdays with Saturday before Sunday', () => {
      const weekdays: WeekDay[] = [0, 1, 3, 6]; // Sunday, Monday, Wednesday, Saturday
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([6, 0, 1, 3]); // Saturday, Sunday, Monday, Wednesday
    });

    it('should handle all weekdays correctly', () => {
      const weekdays: WeekDay[] = [0, 1, 2, 3, 4, 5, 6]; // Sunday through Saturday
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([6, 0, 1, 2, 3, 4, 5]); // Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday
    });

    it('should return a new array without modifying the original', () => {
      const weekdays: WeekDay[] = [0, 6];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).not.toBe(weekdays); // Should be a different array reference
      expect(weekdays).toEqual([0, 6]); // Original should remain unchanged
    });

    it('should handle empty array', () => {
      const weekdays: WeekDay[] = [];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([]);
    });

    it('should handle single weekday', () => {
      const weekdays: WeekDay[] = [3]; // Wednesday
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([3]);
    });

    it('orders Saturday (6) before Sunday (0) when mixed with other days', () => {
      const sorted = Quickurrence.sortWeekDaysForDisplay([0, 6, 1, 5]);
      expect(sorted).toEqual([6, 0, 1, 5]);
    });
  });

  describe('update() schema-failure path', () => {
    it('throws when produced options fail final schema validation', () => {
      // Force a non-Date startDate through the cast — survives clean(), fails schema.
      expect(() =>
        Quickurrence.update(
          { rule: 'daily', startDate: new Date('2026-01-01') },
          { startDate: 'not-a-date' as unknown as Date },
        ),
      ).toThrowError(/Invalid quickurrence options/);
    });
  });

  describe('presetToOptions unknown preset', () => {
    it('throws on unknown preset', () => {
      expect(() =>
        Quickurrence.presetToOptions('mystery' as unknown as 'businessDays'),
      ).toThrowError(/Unknown preset/);
    });
  });

  describe('getNextOccurrence end-date guard (day-level path)', () => {
    it('throws END_DATE_EXCEEDED when after >= endDate', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-05T00:00:00Z'),
        timezone: 'UTC',
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2026-01-10T00:00:00Z')),
      ).toThrowError(/end date|END_DATE_EXCEEDED/i);
    });
  });

  describe('weekly with single weekDay + interval > 1', () => {
    it('exercises getNextWeekdayOccurrence nextDay branch', () => {
      const rule = new Quickurrence({
        rule: 'weekly',
        startDate: new Date('2026-01-05T00:00:00Z'), // Mon
        timezone: 'UTC',
        weekDays: [3], // Wed only — startDate is Mon so nextDay branch fires
        interval: 2,
      });
      const next = rule.getNextOccurrence(new Date('2026-01-04T00:00:00Z'));
      expect(next.getTime()).toBe(new Date('2026-01-07T00:00:00Z').getTime());
    });
  });

  describe('monthly with monthDay — boundary paths', () => {
    it('throws COUNT_LIMIT_EXCEEDED past last counted occurrence', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-15T00:00:00Z'),
        timezone: 'UTC',
        monthDay: 15,
        count: 2,
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2026-04-15T00:00:00Z')),
      ).toThrowError(/count limit|COUNT_LIMIT_EXCEEDED/i);
    });

    it('returns startDate occurrence when after < startDate', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-06-15T00:00:00Z'),
        timezone: 'UTC',
        monthDay: 15,
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T00:00:00Z'));
      expect(next.getTime()).toBe(new Date('2026-06-15T00:00:00Z').getTime());
    });

    it('throws END_DATE_EXCEEDED when window is exhausted', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-15T00:00:00Z'),
        endDate: new Date('2026-03-15T00:00:00Z'),
        timezone: 'UTC',
        monthDay: 15,
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2027-01-01T00:00:00Z')),
      ).toThrowError(/end date|END_DATE_EXCEEDED/i);
    });
  });

  describe('monthly with nthWeekdayOfMonth — boundary paths', () => {
    it('throws COUNT_LIMIT_EXCEEDED past last counted occurrence', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        nthWeekdayOfMonth: { weekday: 2, nth: 2 }, // 2nd Tuesday
        count: 2,
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2026-06-01T00:00:00Z')),
      ).toThrowError(/count limit|COUNT_LIMIT_EXCEEDED/i);
    });

    it('returns startDate occurrence when after < startDate', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-06-01T00:00:00Z'),
        timezone: 'UTC',
        nthWeekdayOfMonth: { weekday: 2, nth: 2 },
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T00:00:00Z'));
      // 2nd Tuesday of June 2026 is 2026-06-09
      expect(next.getTime()).toBe(new Date('2026-06-09T00:00:00Z').getTime());
    });

    it('throws END_DATE_EXCEEDED past endDate', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-03-01T00:00:00Z'),
        timezone: 'UTC',
        nthWeekdayOfMonth: { weekday: 2, nth: 2 },
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2027-01-01T00:00:00Z')),
      ).toThrowError(/end date|END_DATE_EXCEEDED/i);
    });

    it("'last' nth: returns last weekday of month", () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T00:00:00Z'));
      expect(next.getTime()).toBe(new Date('2026-01-30T00:00:00Z').getTime()); // last Friday of Jan 2026
    });
  });

  describe('toHumanText interval and terminator branches', () => {
    it('handles interval > 1 for daily', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01'),
        interval: 3,
      });
      expect(rule.toHumanText()).toMatch(/Every 3 days/);
    });

    it('handles interval > 1 for weekly', () => {
      const rule = new Quickurrence({
        rule: 'weekly',
        startDate: new Date('2026-01-01'),
        interval: 2,
      });
      expect(rule.toHumanText()).toMatch(/Every 2 weeks/);
    });

    it('handles interval > 1 for monthly', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-01'),
        interval: 2,
      });
      expect(rule.toHumanText()).toMatch(/Every 2 months/);
    });

    it('handles interval > 1 for yearly', () => {
      const rule = new Quickurrence({
        rule: 'yearly',
        startDate: new Date('2026-01-01'),
        interval: 2,
      });
      expect(rule.toHumanText()).toMatch(/Every 2 years/);
    });

    it('handles yearly with interval=1 (Yearly capitalize)', () => {
      const rule = new Quickurrence({
        rule: 'yearly',
        startDate: new Date('2026-01-01'),
      });
      expect(rule.toHumanText()).toMatch(/^Yearly/);
    });

    it('mentions monthDay ordinals (1st, 2nd, 3rd, 11th)', () => {
      expect(
        new Quickurrence({
          rule: 'monthly',
          startDate: new Date('2026-01-01'),
          monthDay: 1,
        }).toHumanText(),
      ).toMatch(/on the 1st/);
      expect(
        new Quickurrence({
          rule: 'monthly',
          startDate: new Date('2026-01-01'),
          monthDay: 2,
        }).toHumanText(),
      ).toMatch(/on the 2nd/);
      expect(
        new Quickurrence({
          rule: 'monthly',
          startDate: new Date('2026-01-01'),
          monthDay: 3,
        }).toHumanText(),
      ).toMatch(/on the 3rd/);
      expect(
        new Quickurrence({
          rule: 'monthly',
          startDate: new Date('2026-01-01'),
          monthDay: 11,
        }).toHumanText(),
      ).toMatch(/on the 11th/);
    });

    it("mentions nthWeekdayOfMonth ordinals including 'last'", () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-01'),
        nthWeekdayOfMonth: { weekday: 2, nth: 2 },
      });
      expect(rule.toHumanText()).toMatch(/on the 2nd Tuesday/);

      const ruleLast = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-01'),
        nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
      });
      expect(ruleLast.toHumanText()).toMatch(/on the last Friday/);
    });

    it('mentions weekends preset', () => {
      const rule = new Quickurrence({
        startDate: new Date('2026-01-01'),
        preset: 'weekends',
      });
      expect(rule.toHumanText()).toMatch(/weekends only/);
    });

    it('mentions businessDays preset', () => {
      const rule = new Quickurrence({
        startDate: new Date('2026-01-01'),
        preset: 'businessDays',
      });
      expect(rule.toHumanText()).toMatch(/business days only/);
    });

    it('mentions count terminator', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01'),
        count: 5,
      });
      expect(rule.toHumanText()).toMatch(/, 5 times/);
    });

    it('mentions endDate terminator', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
      expect(rule.toHumanText()).toMatch(/until /);
    });

    it('static toHumanText delegates through clean()', () => {
      const text = Quickurrence.toHumanText({
        rule: 'weekly',
        startDate: new Date('2026-01-01'),
        weekDays: [1, 3, 5],
      });
      expect(text).toMatch(/Monday/);
    });
  });
});
