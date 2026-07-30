import { UTCDateMini } from '@date-fns/utc';
import { tz, TZDate } from '@date-fns/tz';
import { startOfDay } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CountSchema,
  DateRangeSchema,
  IntervalSchema,
  MonthDaySchema,
  NthWeekdayOfMonthSchema,
  Quickurrence,
  QuickurrenceError,
  QuickurrenceErrorCode,
  type QuickurrenceOptions,
  QuickurrenceOptionsSchema,
  QuickurrenceValidator,
  RecurrenceRuleSchema,
  TimeOfDaySchema,
  TimesOfDaySchema,
  WeekDaySchema,
  WeekStartsOnSchema,
  type WeekDay,
  type MonthDay,
  type ZonedParts,
} from './index';
import * as publicApi from './index';

const utcWeekday = (date: Date) => new UTCDateMini(date).getUTCDay();
const utcDayOfMonth = (date: Date) => new UTCDateMini(date).getUTCDate();

const caughtError = (call: () => unknown) => {
  try {
    call();
  } catch (error) {
    return error;
  }
  return undefined;
};

/**
 * Every coded rejection is asserted the same way: it must be a
 * `QuickurrenceError` carrying the documented code, and it must NOT be one of
 * the raw platform errors the 0.4.0 work replaced — a `RangeError` escaping
 * from `Intl`, or a `TypeError` escaping from an internal `.getTime()`.
 */
const expectCode = (call: () => unknown, code: QuickurrenceErrorCode) => {
  const error = caughtError(call);
  expect(error).toBeInstanceOf(QuickurrenceError);
  expect(error).not.toBeInstanceOf(RangeError);
  expect(error).not.toBeInstanceOf(TypeError);
  expect((error as QuickurrenceError).code).toBe(code);
  return error as QuickurrenceError;
};

describe('Quickurrence', () => {
  describe('Default behavior', () => {
    // The default startDate is "today" read off the wall clock, so the clock is
    // pinned: otherwise a run that straddles midnight in the rule's timezone
    // compares two different days, and the expected instant would depend on
    // when the suite happens to execute. 12:00Z on a mid-June date keeps every
    // zone's local day unambiguous and away from any DST transition.
    const PINNED_NOW = new Date('2026-06-15T12:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers({ now: PINNED_NOW });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create with no options (using defaults)', () => {
      const rule = new Quickurrence();

      expect(rule.getRule()).toBe('daily');
      expect(rule.getStartDate()).toBeDefined();
      // Default timezone is UTC, so today is 2026-06-15T00:00 UTC.
      expect(rule.getStartDate().getTime()).toBe(
        new Date('2026-06-15T00:00:00.000Z').getTime(),
      );
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
      // Default timezone is UTC, so today is 2026-06-15T00:00 UTC.
      expect(rule.getStartDate().getTime()).toBe(
        new Date('2026-06-15T00:00:00.000Z').getTime(),
      );
    });

    it('should use timezone for default startDate', () => {
      const timezone = 'America/New_York';
      const rule = new Quickurrence({ timezone });

      expect(rule.getStartDate()).toBeDefined();
      // 2026-06-15 in New York is EDT (UTC-4), so its midnight is 04:00 UTC —
      // four hours later than the UTC default above, which is what makes this
      // assertion timezone-sensitive rather than a restatement of the default.
      expect(rule.getStartDate().getTime()).toBe(
        new Date('2026-06-15T04:00:00.000Z').getTime(),
      );
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
      const startDate = new UTCDateMini('2024-01-01');
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
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({ startDate, rule: 'weekly' });

      expect(rule.getWeekStartsOn()).toBe(1);
    });

    it('should generate weekly occurrences with Sunday as week start (weekStartsOn = 0)', () => {
      const startDate = new UTCDateMini('2024-01-01');
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
      const startDate = new UTCDateMini('2024-01-01');
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
      const startDate = new UTCDateMini('2024-01-05');
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        weekStartsOn: 5,
      });

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
      const startDate = new UTCDateMini('2024-01-01');
      const rule = new Quickurrence({
        startDate,
        rule: 'weekly',
        weekStartsOn: 0,
      });

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
            monthDay: 1,
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
            monthDay: 5,
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
            monthDay: 29,
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-29'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-29'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-29'));
        });

        it('should generate occurrences on the 30th with skip mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 30,
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

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
            monthDay: 31,
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

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
            monthDay: 29,
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2025-01-01'),
            end: new UTCDateMini('2025-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2025-01-29'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2025-02-28'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2025-03-29'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2025-04-29'));
        });

        it('should generate occurrences on the 30th with last mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 30,
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-30'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-30'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-30'));
        });

        it('should generate occurrences on the 31st with last mode', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31,
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(7);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-31'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-30'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-05-31'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-06-30'));
          expect(occurrences[6]).toEqual(new UTCDateMini('2024-07-31'));
        });
      });

      describe('Leap year scenarios', () => {
        it('should handle 29th in leap year vs non-leap year with skip mode', () => {
          const startDate2024 = new UTCDateMini('2024-01-01');
          const rule2024 = new Quickurrence({
            startDate: startDate2024,
            rule: 'monthly',
            monthDay: 29,
            monthDayMode: 'skip',
          });

          const range2024 = {
            start: new UTCDateMini('2024-02-01'),
            end: new UTCDateMini('2024-02-29'),
          };

          const occurrences2024 = rule2024.getAllOccurrences(range2024);
          expect(occurrences2024).toHaveLength(1);
          expect(occurrences2024[0]).toEqual(new UTCDateMini('2024-02-29'));

          const startDate2025 = new UTCDateMini('2025-01-01');
          const rule2025 = new Quickurrence({
            startDate: startDate2025,
            rule: 'monthly',
            monthDay: 29,
            monthDayMode: 'skip',
          });

          const range2025 = {
            start: new UTCDateMini('2025-02-01'),
            end: new UTCDateMini('2025-03-31'),
          };

          const occurrences2025 = rule2025.getAllOccurrences(range2025);
          expect(occurrences2025).toHaveLength(1);
          expect(occurrences2025[0]).toEqual(new UTCDateMini('2025-03-29'));
        });

        it('should handle 29th in leap year vs non-leap year with last mode', () => {
          const startDate2024 = new UTCDateMini('2024-01-01');
          const rule2024 = new Quickurrence({
            startDate: startDate2024,
            rule: 'monthly',
            monthDay: 29,
            monthDayMode: 'last',
          });

          const range2024 = {
            start: new UTCDateMini('2024-02-01'),
            end: new UTCDateMini('2024-02-29'),
          };

          const occurrences2024 = rule2024.getAllOccurrences(range2024);
          expect(occurrences2024).toHaveLength(1);
          expect(occurrences2024[0]).toEqual(new UTCDateMini('2024-02-29'));

          const startDate2025 = new UTCDateMini('2025-01-01');
          const rule2025 = new Quickurrence({
            startDate: startDate2025,
            rule: 'monthly',
            monthDay: 29,
            monthDayMode: 'last',
          });

          const range2025 = {
            start: new UTCDateMini('2025-02-01'),
            end: new UTCDateMini('2025-02-28'),
          };

          const occurrences2025 = rule2025.getAllOccurrences(range2025);
          expect(occurrences2025).toHaveLength(1);
          expect(occurrences2025[0]).toEqual(new UTCDateMini('2025-02-28'));
        });
      });

      describe('getNextOccurrence with monthly days', () => {
        it('should get next occurrence on 15th of month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 15,
            monthDayMode: 'skip',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-20'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-15'));
        });

        it('should get next occurrence with skip mode for 31st', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31,
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
            monthDay: 31,
            monthDayMode: 'skip',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-02-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-03-31'));
        });

        it('should get next occurrence with last mode for February', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 31,
            monthDayMode: 'last',
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-02-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-29'));
        });

        it('should return next month when after date equals the monthDay occurrence (bug fix)', () => {
          const startDate = new UTCDateMini('2024-02-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1,
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-02-01'),
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
            new UTCDateMini('2024-01-15'),
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
          // Warsaw midnight spelled out rather than derived with startOfDay,
          // which round-trips the wall clock through the host zone.
          expect(nextOccurrence).toEqual(
            new TZDate('2024-03-01T00:00:00.000+01:00', timezone),
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
            monthDay: 15,
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
            monthDay: 31,
            monthDayMode: 'last',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-10-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-31'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-04-30'));
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
              monthDay: 15,
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
              monthDayMode: 'last',
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
              monthDay: 32,
            });
          }).toThrow('monthDay must be between 1-31');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'monthly',
              // @ts-expect-error - Testing invalid monthDay value
              monthDay: 0,
            });
          }).toThrow('monthDay must be between 1-31');
        });

        it('should work with monthDay 1 representing 1st of month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            monthDay: 1,
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
            monthDay: 31,
            monthDayMode: 'skip',
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-03-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(2);
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
            nthWeekdayOfMonth: { weekday: 1, nth: 1 },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-05'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-04'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-01'));
        });

        it('should generate occurrences on the 2nd Wednesday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 3, nth: 2 },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-10'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-14'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-13'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-10'));
        });

        it('should generate occurrences on the 3rd Friday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 5, nth: 3 },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-19'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-16'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-15'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-19'));
        });

        it('should generate occurrences on the 4th Thursday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 4, nth: 4 },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-25'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-22'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-28'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-25'));
        });

        it('should generate occurrences on the last Sunday of every month', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 0, nth: 'last' },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-04-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-28'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-25'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-31'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-28'));
        });
      });

      describe('Edge cases', () => {
        it('should skip months where nth weekday does not exist', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 4 },
          });

          const range = {
            start: new UTCDateMini('2024-02-01'),
            end: new UTCDateMini('2024-02-29'),
          };

          const occurrences = rule.getAllOccurrences(range);

          // February 2024 has 4th Monday on Feb 26
          expect(occurrences).toHaveLength(1);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-02-26'));
        });

        it('should handle months where weekday does not occur enough times', () => {
          const startDate = new UTCDateMini('2024-03-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 4 },
          });

          const range = {
            start: new UTCDateMini('2024-03-01'),
            end: new UTCDateMini('2024-06-30'),
          };

          const occurrences = rule.getAllOccurrences(range);

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
            nthWeekdayOfMonth: { weekday: 1, nth: 1 },
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-05'));
        });

        it('should get next occurrence with last weekday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-15'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-26'));
        });

        it('should return next month when after date equals the nth weekday occurrence (bug fix)', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            nthWeekdayOfMonth: { weekday: 1, nth: 1 },
          });

          // Jan 1st 2024 is a Monday, so 1st Monday of Jan = Jan 1st
          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-01'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-02-05'));
        });
      });

      describe('Intervals with nth weekday', () => {
        it('should generate occurrences every 2 months on 1st Monday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            interval: 2,
            nthWeekdayOfMonth: { weekday: 1, nth: 1 },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-07-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-04'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-06'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-07-01'));
        });

        it('should generate occurrences every 3 months on last Friday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
            interval: 3,
            nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-10-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-26'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-04-26'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-07-26'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-10-25'));
        });
      });

      describe('Validation and error handling', () => {
        it('should throw error when nthWeekdayOfMonth is used with non-monthly recurrence', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'daily',
              nthWeekdayOfMonth: { weekday: 1, nth: 1 },
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
              nthWeekdayOfMonth: { weekday: 7, nth: 1 },
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
              nthWeekdayOfMonth: { weekday: 1, nth: 5 },
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
              nthWeekdayOfMonth: { weekday: 1, nth: 'first' },
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
            config.nth = 2;
          }

          const configAgain = rule.getNthWeekdayOfMonth();
          expect(configAgain?.nth).toBe(1);
        });
      });

      describe('Backward compatibility', () => {
        it('should work exactly as before when nthWeekdayOfMonth is not specified', () => {
          const startDate = new UTCDateMini('2024-01-15');
          const rule = new Quickurrence({
            startDate,
            rule: 'monthly',
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
        end: new UTCDateMini('2024-01-31'),
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

        let next = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
        expect(next).toEqual(new UTCDateMini('2024-01-03'));

        next = rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        expect(next).toEqual(new UTCDateMini('2024-01-05'));

        next = rule.getNextOccurrence(new UTCDateMini('2024-01-05'));
        expect(next).toEqual(new UTCDateMini('2024-01-07'));

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

        let next = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
        expect(next).toEqual(new UTCDateMini('2024-01-04'));

        next = rule.getNextOccurrence(new UTCDateMini('2024-01-04'));
        expect(next).toEqual(new UTCDateMini('2024-01-07'));

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

        let next = rule.getNextOccurrence(new UTCDateMini('2024-01-01'));
        expect(next).toEqual(new UTCDateMini('2024-01-08'));

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

        const nov8 = new TZDate(
          '2025-11-08T01:00:00.000+01:00',
          'Europe/Warsaw',
        );
        // Warsaw is CET (+01:00) in November, so each expected instant is that
        // day's Warsaw midnight, derived by hand rather than round-tripped
        // through a host-relative start-of-day.
        let next = rule.getNextOccurrence(nov8);
        expect(next.getTime()).toBe(Date.parse('2025-11-09T23:00:00.000Z'));

        const nov10 = new TZDate(
          '2025-11-10T01:00:00.000+01:00',
          'Europe/Warsaw',
        );
        next = rule.getNextOccurrence(nov10);
        expect(next.getTime()).toBe(Date.parse('2025-11-11T23:00:00.000Z'));
      });

      it('should not return same date when called on valid occurrence date', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

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

        const updated = Quickurrence.update(options, {
          startDate: new Date('2025-11-10T01:00:00.000+01:00'),
          timezone: 'Europe/Warsaw',
        });

        expect(updated).not.toBeNull();
        expect(updated?.interval).toBe(2);
        expect(updated?.rule).toBe('daily');
      });

      it('should align to interval grid even when dueDate is misaligned', () => {
        const startDate = new UTCDateMini('2024-11-08');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
        });

        const nov9 = new UTCDateMini('2024-11-09');
        const nextFromMisaligned = rule.getNextOccurrence(nov9);
        expect(nextFromMisaligned).toEqual(new UTCDateMini('2024-11-10'));

        const nov10 = new UTCDateMini('2024-11-10');
        const nextFromAligned = rule.getNextOccurrence(nov10);
        expect(nextFromAligned).toEqual(new UTCDateMini('2024-11-12'));

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

        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-02'))).toEqual(
          new UTCDateMini('2024-01-04'),
        );

        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-03'))).toEqual(
          new UTCDateMini('2024-01-04'),
        );

        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-05'))).toEqual(
          new UTCDateMini('2024-01-07'),
        );

        expect(rule.getNextOccurrence(new UTCDateMini('2024-01-06'))).toEqual(
          new UTCDateMini('2024-01-07'),
        );
      });
    });

    describe('Weekly recurrence with intervals', () => {
      it('should generate weekly occurrences with interval 2', () => {
        const startDate = new UTCDateMini('2024-01-01');
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
        const startDate = new UTCDateMini('2024-01-01');
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
          end: new UTCDateMini('2024-01-10'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should respect endDate in weekly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          endDate,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-02-01'),
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
          end: new UTCDateMini('2024-01-03'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should throw error when endDate is before startDate in constructor', () => {
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

      it('should allow endDate equal to startDate', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const endDate = new UTCDateMini('2024-01-01');

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
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-29'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-22'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
        });

        it('should generate occurrences on Wednesday only', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [3],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-03'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-10'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-17'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-24'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-31'));
        });

        it('should generate occurrences on Sunday only', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [0],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-28'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-07'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-14'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-21'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-28'));
        });
      });

      describe('Multiple weekdays selection', () => {
        it('should generate occurrences on Monday and Wednesday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-15'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(5);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-10'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-15'));
        });

        it('should generate occurrences on Monday, Wednesday, and Friday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3, 5],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-15'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(7);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-10'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-12'));
          expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-15'));
        });

        it('should generate weekend occurrences (Saturday and Sunday)', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [0, 6],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-21'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(6);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-20'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-21'));
        });

        it('should generate all weekday occurrences (Monday through Friday)', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 2, 3, 4, 5],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-12'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(10);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-09'));
          expect(occurrences[7]).toEqual(new UTCDateMini('2024-01-10'));
          expect(occurrences[8]).toEqual(new UTCDateMini('2024-01-11'));
          expect(occurrences[9]).toEqual(new UTCDateMini('2024-01-12'));
        });
      });

      describe('getNextOccurrence with weekdays', () => {
        it('should get next occurrence on the same weekday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1],
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-03'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-08'));
        });

        it('should get next occurrence with multiple weekdays', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3, 5],
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-02'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
        });

        it('should get next occurrence when current day is later in week', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 3],
          });

          const nextOccurrence = rule.getNextOccurrence(
            new UTCDateMini('2024-01-04'),
          );
          expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-08'));
        });
      });

      describe('Intervals with weekdays', () => {
        it('should generate occurrences every 2 weeks on Monday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            interval: 2,
            weekDays: [1],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-02-12'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-15'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-29'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-02-12'));
        });

        it('should generate occurrences every 2 weeks on Monday and Wednesday', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            interval: 2,
            weekDays: [1, 3],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-31'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(6);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-17'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-31'));
        });
      });

      describe('Edge cases and validation', () => {
        it('should throw error when weekDays is used with non-weekly recurrence', () => {
          const startDate = new UTCDateMini('2024-01-01');

          expect(() => {
            new Quickurrence({
              startDate,
              rule: 'daily',
              weekDays: [1],
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
              weekDays: [],
            });
          }).toThrow('weekDays cannot be empty when specified');
        });

        it('should handle weekDays in different order', () => {
          const startDate = new UTCDateMini('2024-01-01');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [5, 1, 3],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-12'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(6);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-10'));
          expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-12'));
        });

        it('should work when start date does not match any weekDay', () => {
          const startDate = new UTCDateMini('2024-01-02');
          const rule = new Quickurrence({
            startDate,
            rule: 'weekly',
            weekDays: [1, 5],
          });

          const range = {
            start: new UTCDateMini('2024-01-01'),
            end: new UTCDateMini('2024-01-15'),
          };

          const occurrences = rule.getAllOccurrences(range);

          expect(occurrences).toHaveLength(4);
          expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-05'));
          expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-08'));
          expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-12'));
          expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-15'));
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
            (weekDays as unknown as number[]).push(0);
          }

          const weekDaysAgain = rule.getWeekDays();
          expect(weekDaysAgain).toEqual([1, 3, 5]);
        });
      });

      describe('Backward compatibility', () => {
        it('should work exactly as before when weekDays is not specified', () => {
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
      expect(retrievedConfig).not.toBe(config);
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
          end: new UTCDateMini('2024-12-31'),
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
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
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
          end: new UTCDateMini('2024-12-31'),
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
          end: new UTCDateMini('2030-12-31'),
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
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5],
          count: 8,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(8);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-10'));
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-12'));
        expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[7]).toEqual(new UTCDateMini('2024-01-17'));
      });

      it('should generate N occurrences with weekdays and interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          interval: 2,
          weekDays: [1, 5],
          count: 6,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(6);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-19'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-29'));
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-02-02'));
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
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-29'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-31'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-30'));
      });
    });

    describe('Count with nth weekday of month', () => {
      it('should generate N occurrences on 1st Monday of each month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 1, nth: 1 },
          count: 4,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-05'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-04'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-04-01'));
      });

      it('should generate N occurrences on last Friday of each month', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 5, nth: 'last' },
          count: 3,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-26'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-23'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-03-29'));
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
          rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        }).toThrow('No more occurrences within the specified count limit');
      });

      it('should work with weekly weekdays and count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3],
          count: 4,
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-03'));
      });

      it('should throw error with weekly weekdays when beyond count', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3],
          count: 2,
        });

        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
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
          end: new UTCDateMini('2024-01-10'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
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
          end: new UTCDateMini('2024-01-03'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
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
          end: new UTCDateMini('2030-01-01'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(7);
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

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-06'));
      });

      it('should exclude specific dates from weekly recurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
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

        expect(occurrences).toHaveLength(3);
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

        expect(occurrences).toHaveLength(3);
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

        expect(occurrences).toHaveLength(2);
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

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-11'));
      });

      it('should exclude dates from weekly recurrence with interval', () => {
        const startDate = new UTCDateMini('2024-01-01');
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

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-29'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-02-12'));
      });
    });

    describe('Exclusions with weekly specific weekdays', () => {
      it('should exclude dates from weekly recurrence with specific weekdays', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5],
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

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-10'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-12'));
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

        expect(occurrences).toHaveLength(3);
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
          nthWeekdayOfMonth: { weekday: 1, nth: 1 },
          excludeDates: [new UTCDateMini('2024-02-05')],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-04-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-04'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-04-01'));
      });
    });

    describe('Exclusions with count limits', () => {
      it('should respect count limits when excluding dates', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          count: 5,
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

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
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
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
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

        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-04'));
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
        expect(nextOccurrence2).toEqual(new UTCDateMini('2024-01-03'));

        const nextOccurrence3 = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );
        expect(nextOccurrence3).toEqual(new UTCDateMini('2024-01-04'));

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
          excludeDates: [new Date('2024-01-02T15:30:00Z')],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-04'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
      });

      it('should work when no dates are excluded', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
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
          excludeDates: [startDate],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-04'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
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
          excludeDates.push(new UTCDateMini('2024-01-05'));
        }

        const excludeDatesAgain = rule.getExcludeDates();
        expect(excludeDatesAgain).toHaveLength(1);
        expect(excludeDatesAgain![0]).toEqual(new UTCDateMini('2024-01-03'));
      });
    });

    describe('Backward compatibility', () => {
      it('should work exactly as before when excludeDates is not specified', () => {
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
          condition: (_date, parts) => parts.day % 2 === 1,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-06'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with weekly recurrence and weekday conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5],
          condition: (_date, parts) => parts.day <= 15,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          expect(utcDayOfMonth(occurrence)).toBeLessThanOrEqual(15);
        });
      });

      it('should work with monthly recurrence and specific day conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 15,
          condition: (_date, parts) => parts.month % 2 === 0,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-06-30'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-05-15'));
      });

      it('should work with yearly recurrence and custom conditions', () => {
        const startDate = new UTCDateMini('2024-03-15');
        const rule = new Quickurrence({
          startDate,
          rule: 'yearly',
          condition: (_date, parts) => parts.year % 2 === 0,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2027-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(2);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-03-15'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2026-03-15'));
      });

      it('should receive rule-zone midnight parts in condition function', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const receivedEpochs: number[] = [];
        const receivedParts: ZonedParts[] = [];

        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          timezone: 'America/New_York',
          condition: (date, parts) => {
            receivedEpochs.push(date.getTime());
            receivedParts.push(parts);
            // The rule's calendar, not the host's: midnight in New York.
            expect(parts.hour).toBe(0);
            expect(parts.minute).toBe(0);
            expect(parts.second).toBe(0);
            expect(parts.ms).toBe(0);
            return true;
          },
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-03'),
        };

        rule.getAllOccurrences(range);

        // 2024-01-01T00:00Z is still 2023-12-31 in New York, so the rule's
        // first day is Dec 31 and every instant is EST midnight (05:00Z).
        expect(receivedEpochs).toEqual([
          Date.parse('2023-12-31T05:00:00.000Z'),
          Date.parse('2024-01-01T05:00:00.000Z'),
          Date.parse('2024-01-02T05:00:00.000Z'),
        ]);
        expect(receivedParts).toEqual([
          { year: 2023, month: 11, day: 31, weekday: 0, hour: 0, minute: 0, second: 0, ms: 0 },
          { year: 2024, month: 0, day: 1, weekday: 1, hour: 0, minute: 0, second: 0, ms: 0 },
          { year: 2024, month: 0, day: 2, weekday: 2, hour: 0, minute: 0, second: 0, ms: 0 },
        ]);
      });
    });

    describe('Conditions combined with other features', () => {
      it('should work with both excludeDates and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          excludeDates: [new UTCDateMini('2024-01-02')],
          condition: (_date, parts) => parts.day % 2 === 1,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-06'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
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
          condition: (_date, parts) => parts.day % 2 === 1,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
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
          condition: (_date, parts) => parts.day % 2 === 1,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with intervals and conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
          condition: (_date, parts) => parts.weekday !== 0,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-15'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          expect(utcWeekday(occurrence)).not.toBe(0);
        });
      });
    });

    describe('getNextOccurrence with conditions', () => {
      it('should skip dates that do not meet condition', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: (_date, parts) => parts.day % 2 === 1,
        });

        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

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
          condition: (_date, parts) => parts.day % 2 === 1,
        });

        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

        const secondOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(secondOccurrence).toEqual(new UTCDateMini('2024-01-03'));

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
          condition: (_date, parts) => parts.day > 5,
        });

        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2023-12-31'));
        }).toThrow('No more occurrences within the specified end date');
      });
    });

    describe('Complex condition scenarios', () => {
      it('should handle holiday exclusion example', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const holidays = [
          new UTCDateMini('2024-01-01'),
          new UTCDateMini('2024-01-15'),
        ];

        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1],
          condition: (date) => {
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

        expect(occurrences).toHaveLength(2);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-22'));
      });

      it('should handle business days only condition', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          condition: (_date, parts) => parts.weekday !== 0 && parts.weekday !== 6,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(10);
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day).not.toBe(0);
          expect(day).not.toBe(6);
        });
      });

      it('should handle seasonal conditions', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'monthly',
          monthDay: 1,
          condition: (_date, parts) => parts.month >= 5 && parts.month <= 7,
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(3);
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
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(10);
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(5);
        });

        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08'));
      });

      it('should work with weekly recurrence and business days preset', () => {
        const startDate = new UTCDateMini('2024-01-01');
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
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-08'));
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(5);
        });
      });

      it('should exclude weekends when starting on a weekend', () => {
        const startDate = new UTCDateMini('2024-01-06');
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

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-08'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-12'));
      });

      it('should work with count limit and business days', () => {
        const startDate = new UTCDateMini('2024-01-01');
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

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-03'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-05'));
      });

      it('should work with intervals and business days', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          interval: 2,
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-15'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(5);
        });
      });
    });

    describe('Weekends preset', () => {
      it('should include only weekends (Saturday and Sunday)', () => {
        const startDate = new UTCDateMini('2024-01-01');
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

        expect(occurrences).toHaveLength(6);
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day === 0 || day === 6).toBe(true);
        });

        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14'));
      });

      it('should work with weekly recurrence and weekends preset', () => {
        const startDate = new UTCDateMini('2024-01-06');
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
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-01-20'));
        expect(occurrences[5]).toEqual(new UTCDateMini('2024-01-21'));
        expect(occurrences[6]).toEqual(new UTCDateMini('2024-01-27'));
        expect(occurrences[7]).toEqual(new UTCDateMini('2024-01-28'));
        expect(occurrences[8]).toEqual(new UTCDateMini('2024-02-03'));
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day === 0 || day === 6).toBe(true);
        });
      });

      it('should exclude weekdays when starting on a weekday', () => {
        const startDate = new UTCDateMini('2024-01-01');
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

        expect(occurrences).toHaveLength(2);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
      });

      it('should work with count limit and weekends', () => {
        const startDate = new UTCDateMini('2024-01-01');
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

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14'));
      });
    });

    describe('getNextOccurrence with presets', () => {
      it('should get next business day occurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-04'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-05'));

        const nextAfterFriday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-05'),
        );
        expect(nextAfterFriday).toEqual(new UTCDateMini('2024-01-08'));
      });

      it('should get next weekend occurrence', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'weekends',
        });

        const nextOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-06'));

        const nextAfterSaturday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-06'),
        );
        expect(nextAfterSaturday).toEqual(new UTCDateMini('2024-01-07'));
      });

      it('should work with count limits and business days', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
          count: 3,
        });

        const firstOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2023-12-31'),
        );
        expect(firstOccurrence).toEqual(new UTCDateMini('2024-01-01'));

        const secondOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-01'),
        );
        expect(secondOccurrence).toEqual(new UTCDateMini('2024-01-02'));

        const thirdOccurrence = rule.getNextOccurrence(
          new UTCDateMini('2024-01-02'),
        );
        expect(thirdOccurrence).toEqual(new UTCDateMini('2024-01-03'));

        expect(() => {
          rule.getNextOccurrence(new UTCDateMini('2024-01-03'));
        }).toThrow('No more occurrences within the specified count limit');
      });
    });

    describe('Preset with other features', () => {
      it('should work with excludeDates and business days preset', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
          excludeDates: [
            new UTCDateMini('2024-01-03'),
            new UTCDateMini('2024-01-05'),
          ],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-12'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(8);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-01'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-02'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-04'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-08'));
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
          end: new UTCDateMini('2024-12-31'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(4);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-06'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-07'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-01-13'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-01-14'));
      });

      it('should work with monthly recurrence and business days preset', () => {
        const startDate = new UTCDateMini('2024-01-15');
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

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(5);
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

        expect(() => {
          new Quickurrence({
            startDate,
            rule: 'daily',
            preset: 'businessDays',
          });
        }).not.toThrow();

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
        expect(rule.getWeekDays()).toEqual([1, 2, 3, 4, 5]);
      });
    });

    describe('Edge cases', () => {
      it('should handle business days across month boundaries', () => {
        const startDate = new UTCDateMini('2024-01-30');
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

        expect(occurrences).toHaveLength(5);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-01-30'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-01-31'));
        expect(occurrences[2]).toEqual(new UTCDateMini('2024-02-01'));
        expect(occurrences[3]).toEqual(new UTCDateMini('2024-02-02'));
        expect(occurrences[4]).toEqual(new UTCDateMini('2024-02-05'));
      });

      it('should handle weekends across month boundaries', () => {
        const startDate = new UTCDateMini('2024-01-30');
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

        expect(occurrences).toHaveLength(2);
        expect(occurrences[0]).toEqual(new UTCDateMini('2024-02-03'));
        expect(occurrences[1]).toEqual(new UTCDateMini('2024-02-04'));
      });

      it('should work with business days preset when no business days exist in range', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
          preset: 'businessDays',
        });

        const range = {
          start: new UTCDateMini('2024-01-06'),
          end: new UTCDateMini('2024-01-07'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(0);
      });
    });

    describe('Backward compatibility', () => {
      it('should work exactly as before when preset is not specified', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'daily',
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-07'),
        };

        const occurrences = rule.getAllOccurrences(range);

        expect(occurrences).toHaveLength(7);
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
          weekDays: [1],
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Monday');
      });

      it('should generate text for weekly on multiple weekdays', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 3, 5],
        });

        const text = rule.toHumanText();
        expect(text).toBe('Weekly on Monday, Wednesday, Friday');
      });

      it('should generate text for weekly on weekend days', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [0, 6],
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
          weekDays: [2, 4],
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
        expect(text).toBe(
          `Weekly until ${endDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}`,
        );
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
          `Monthly on the 15th until ${endDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}`,
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
          `Every 2 weeks on Monday, Wednesday until ${endDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}`,
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
          `Every 2 months on the 15th until ${endDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}`,
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
        expect(updatedOptions!.rule).toBe('weekly');
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

      // `count: 0` used to be filtered out of the produced options and the
      // update silently succeeded. Filtering hid the illegal value from the
      // schema (and dropped legal ones), so the value now reaches the schema.
      it('should reject count 0 instead of dropping it', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
          count: 5,
        };

        const error = expectCode(
          () => Quickurrence.update(originalOptions, { count: 0 }),
          QuickurrenceErrorCode.INVALID_COUNT,
        );
        expect(error.context?.option).toBe('count');
        expect(error.context?.value).toBe(0);
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

      it('should reject a negative count instead of filtering it out', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        const error = expectCode(
          () => Quickurrence.update(originalOptions, { count: -1 }),
          QuickurrenceErrorCode.INVALID_COUNT,
        );
        expect(error.context?.option).toBe('count');
        expect(error.context?.value).toBe(-1);
      });

      it('should clean incompatible options when updating', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const originalOptions: QuickurrenceOptions = {
          startDate,
          rule: 'daily',
        };

        // The update method should clean incompatible options
        const updatedOptions = Quickurrence.update(originalOptions, {
          weekDays: [1, 2, 3] as WeekDay[],
        });

        expect(updatedOptions).toBeDefined();
        expect(updatedOptions!.weekDays).toBeUndefined();
        expect(updatedOptions!.rule).toBe('daily');

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
          weekDays: [1, 2, 3, 4, 5] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should detect business days preset with unsorted weekdays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [5, 1, 3, 2, 4] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('businessDays');
      });

      it('should not detect business days for partial weekdays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should not detect business days when weekends are included', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [0, 1, 2, 3, 4, 5, 6] as WeekDay[],
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
          weekDays: [0, 6] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('weekends');
      });

      it('should detect weekends preset with unsorted weekdays', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [6, 0] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBe('weekends');
      });

      it('should not detect weekends for partial weekend days', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [6] as WeekDay[],
        };

        const matchingPreset = Quickurrence.getMatchingPreset(options);
        expect(matchingPreset).toBeUndefined();
      });

      it('should not detect weekends when weekdays are included', () => {
        const options: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [0, 1, 6] as WeekDay[],
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
          weekDays: [1, 3, 5] as WeekDay[],
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
          weekStartsOn: 0,
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
        const rule = new Quickurrence({
          startDate: new UTCDateMini('2024-01-01'),
          preset: 'businessDays',
        });

        const modifiedOptions: QuickurrenceOptions = {
          ...rule.getOptions(),
          weekDays: [1, 2, 3] as WeekDay[],
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
          weekDays: [1, 2, 3, 4, 5],
          preset: 'businessDays',
        });

        const nextOccurrence = rule.getNextOccurrence(startDate);

        // Should return Wednesday (next business day), not the same date
        const expectedDate = new Date('2025-09-17T22:00:00.000Z'); // Wednesday at 22:00 UTC
        expect(nextOccurrence).toEqual(expectedDate);
        expect(nextOccurrence.getTime()).not.toBe(startDate.getTime());
      });

      it('should handle business days correctly when start date is on a business day', () => {
        const startDate = new Date('2025-09-16T22:00:00.000Z'); // Tuesday at 22:00 UTC (business day)
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          timezone: 'Europe/Warsaw',
          weekDays: [1, 2, 3, 4, 5],
          preset: 'businessDays',
        });

        const afterStartDate = new Date('2025-09-16T22:00:01.000Z'); // 1 second after start
        const nextOccurrence = rule.getNextOccurrence(afterStartDate);

        const expectedDate = new Date('2025-09-17T22:00:00.000Z');
        expect(nextOccurrence).toEqual(expectedDate);
      });

      it('should correctly identify day of week for timezone-aware business days', () => {
        const startDate = new Date('2025-09-16T22:00:00.000Z'); // Tuesday at 22:00 UTC
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          timezone: 'Europe/Warsaw',
          weekDays: [1, 2, 3, 4, 5],
          preset: 'businessDays',
        });

        // Verify that the start date is correctly identified as Tuesday (day 2)
        // in UTC (the comment above marks 22:00 UTC = Tuesday).
        const dayOfWeek = startDate.getUTCDay();
        expect(dayOfWeek).toBe(2);

        const weekDays = rule.getWeekDays();
        expect(weekDays).toContain(2);

        const range = {
          start: startDate,
          end: new Date('2025-09-21T21:59:00.000Z'), // Sunday 23:59 Europe/Warsaw time
        };

        const occurrences = rule.getAllOccurrences(range);
        expect(occurrences).toHaveLength(3);
        expect(occurrences[0]).toEqual(new Date('2025-09-16T22:00:00.000Z')); // Wednesday (start date)
        expect(occurrences[1]).toEqual(new Date('2025-09-17T22:00:00.000Z'));
        expect(occurrences[2]).toEqual(new Date('2025-09-18T22:00:00.000Z'));
      });
    });
  });

  describe('Weekdays preset bug reproduction', () => {
    describe('Task completion scenario', () => {
      it('should maintain weekdays-only pattern after task completion simulation', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
        });

        const nextAfterWednesday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-03'),
        );

        // Should be Thursday (next weekday), not Saturday or Sunday
        expect(nextAfterWednesday).toEqual(new UTCDateMini('2024-01-04'));

        const nextAfterFriday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-05'),
        );

        // Should be Monday (skip weekend), not Saturday
        expect(nextAfterFriday).toEqual(new UTCDateMini('2024-01-08'));
      });

      it('should never include weekends when weekdays preset is used', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-21'),
        };

        const occurrences = rule.getAllOccurrences(range);

        occurrences.forEach((occurrence) => {
          const dayOfWeek = utcWeekday(occurrence);
          expect(dayOfWeek).not.toBe(0);
          expect(dayOfWeek).not.toBe(6);
          expect(dayOfWeek).toBeGreaterThanOrEqual(1);
          expect(dayOfWeek).toBeLessThanOrEqual(5);
        });

        expect(occurrences).toHaveLength(15);
      });

      it('should detect bug when weekDays accidentally includes all 7 days', () => {
        const startDate = new UTCDateMini('2024-01-01');

        // This would be the buggy behavior - all 7 days instead of just weekdays
        const buggyRule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [0, 1, 2, 3, 4, 5, 6], // All days (BUG!)
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-07'),
        };

        const occurrences = buggyRule.getAllOccurrences(range);

        // This would show the bug - should be 7 occurrences (every day)
        expect(occurrences).toHaveLength(7);

        // Check that weekends ARE included (this would be the bug)
        const hasWeekends = occurrences.some((occurrence) => {
          const day = utcWeekday(occurrence);
          return day === 0 || day === 6;
        });
        expect(hasWeekends).toBe(true); // This shows the bug behavior
      });

      it('should correctly handle weekdays preset vs all-days behavior', () => {
        const startDate = new UTCDateMini('2024-01-01');

        // Correct weekdays preset
        const correctRule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
        });

        // Buggy behavior (all days)
        const buggyRule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [0, 1, 2, 3, 4, 5, 6],
        });

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'),
        };

        const correctOccurrences = correctRule.getAllOccurrences(range);
        const buggyOccurrences = buggyRule.getAllOccurrences(range);

        expect(correctOccurrences).toHaveLength(10);

        expect(buggyOccurrences).toHaveLength(14);

        expect(buggyOccurrences.length - correctOccurrences.length).toBe(4);
      });

      it('should maintain correct weekDays array after multiple getNextOccurrence calls', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
        });

        let currentDate = new UTCDateMini('2024-01-01');

        for (let i = 0; i < 10; i++) {
          const nextOccurrence = rule.getNextOccurrence(currentDate);
          const dayOfWeek = utcWeekday(nextOccurrence);

          expect(dayOfWeek).toBeGreaterThanOrEqual(1);
          expect(dayOfWeek).toBeLessThanOrEqual(5);
          expect(dayOfWeek).not.toBe(0);
          expect(dayOfWeek).not.toBe(6);

          currentDate = new UTCDateMini(nextOccurrence);
        }

        // Verify the rule's weekDays haven't been corrupted
        const weekDays = rule.getWeekDays();
        expect(weekDays).toEqual([1, 2, 3, 4, 5]);
        expect(weekDays).toHaveLength(5); // Should still be 5 days, not 7
      });

      it('should handle edge case of completing last weekday of week', () => {
        const startDate = new UTCDateMini('2024-01-01');
        const rule = new Quickurrence({
          startDate,
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
        });

        const nextAfterFriday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-05'),
        );

        expect(nextAfterFriday).toEqual(new UTCDateMini('2024-01-08'));
        expect(utcWeekday(nextAfterFriday)).toBe(1); // Should be Monday, not Saturday (6) or Sunday (0)

        const nextAfterMonday = rule.getNextOccurrence(
          new UTCDateMini('2024-01-08'),
        );

        expect(nextAfterMonday).toEqual(new UTCDateMini('2024-01-09'));
        expect(utcWeekday(nextAfterMonday)).toBe(2);
      });

      it('should work correctly with consistent timezone usage (fixed backend approach)', () => {
        // The fix: Use UTC consistently for both Quickurrence instance and dates
        const originalQuickurrence: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
          timezone: 'UTC',
        };

        // Fixed backend approach: Keep timezone as UTC for consistent calculations
        const quickurrence = new Quickurrence({
          ...originalQuickurrence,
          timezone: 'UTC', // Keep as UTC instead of overriding with user timezone
        });

        // Test with UTC dates (as stored in database)
        const testDate = new UTCDateMini('2024-01-03');

        const nextOccurrence = quickurrence.getNextOccurrence(testDate);

        expect(utcWeekday(nextOccurrence)).toBe(4);
        expect(nextOccurrence).toEqual(new UTCDateMini('2024-01-04'));

        const weekDays = quickurrence.getWeekDays();
        expect(weekDays).toEqual([1, 2, 3, 4, 5]);
      });

      it('should reproduce Quickurrence.update scenario from backend due date changes', () => {
        const originalQuickurrence: QuickurrenceOptions = {
          startDate: new UTCDateMini('2024-01-01'),
          rule: 'weekly',
          weekDays: [1, 2, 3, 4, 5],
          timezone: 'UTC',
        };

        const newStartDate = new Date('2024-01-08T00:00:00-05:00'); // Jan 8 midnight in NY time

        const updatedQuickurrence = Quickurrence.update(originalQuickurrence, {
          startDate: newStartDate,
          timezone: 'America/New_York',
        });

        expect(updatedQuickurrence).toBeDefined();
        if (updatedQuickurrence) {
          expect(updatedQuickurrence.weekDays).toEqual([1, 2, 3, 4, 5]);
          expect(updatedQuickurrence.weekDays).toHaveLength(5); // Should not be 7 days
          // The startDate should be normalized to start of day in America/New_York timezone
          // When we pass Jan 8 00:00 NY time and normalize it, it should stay as Jan 8 00:00 NY time
          const expectedDate = new Date('2024-01-08T00:00:00-05:00');
          expect(updatedQuickurrence.startDate?.getTime()).toBe(
            expectedDate.getTime(),
          );
          expect(updatedQuickurrence.timezone).toBe('America/New_York');

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
          weekDays: [1, 2, 3, 4, 5],
          timezone: 'UTC',
        };

        // Simulate JSON serialization (what happens when storing to JSONB)
        const serialized = JSON.stringify(originalQuickurrence);
        expect(serialized).toContain('[1,2,3,4,5]');

        // Simulate JSON deserialization (what happens when retrieving from JSONB)
        const deserialized = JSON.parse(serialized) as QuickurrenceOptions;

        // Dates need special handling in real JSON scenarios
        if (deserialized.startDate) {
          deserialized.startDate = new Date(deserialized.startDate);
        }

        expect(deserialized.weekDays).toEqual([1, 2, 3, 4, 5]);
        expect(deserialized.weekDays).toHaveLength(5);

        const quickurrence = new Quickurrence(deserialized);
        const weekDays = quickurrence.getWeekDays();
        expect(weekDays).toEqual([1, 2, 3, 4, 5]);
        expect(weekDays).toHaveLength(5);

        const range = {
          start: new UTCDateMini('2024-01-01'),
          end: new UTCDateMini('2024-01-14'),
        };
        const occurrences = quickurrence.getAllOccurrences(range);
        occurrences.forEach((occurrence) => {
          const day = utcWeekday(occurrence);
          expect(day).not.toBe(0);
          expect(day).not.toBe(6);
        });
      });
    });
  });

  describe('sortWeekDaysForDisplay static method', () => {
    it('should sort weekdays with Saturday before Sunday', () => {
      const weekdays: WeekDay[] = [0, 6];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([6, 0]);
    });

    it('should handle multiple weekdays with Saturday before Sunday', () => {
      const weekdays: WeekDay[] = [0, 1, 3, 6];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([6, 0, 1, 3]);
    });

    it('should handle all weekdays correctly', () => {
      const weekdays: WeekDay[] = [0, 1, 2, 3, 4, 5, 6];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([6, 0, 1, 2, 3, 4, 5]);
    });

    it('should return a new array without modifying the original', () => {
      const weekdays: WeekDay[] = [0, 6];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).not.toBe(weekdays);
      expect(weekdays).toEqual([0, 6]);
    });

    it('should handle empty array', () => {
      const weekdays: WeekDay[] = [];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([]);
    });

    it('should handle single weekday', () => {
      const weekdays: WeekDay[] = [3];
      const result = Quickurrence.sortWeekDaysForDisplay(weekdays);
      expect(result).toEqual([3]);
    });

    it('orders Saturday (6) before Sunday (0) when mixed with other days', () => {
      const sorted = Quickurrence.sortWeekDaysForDisplay([0, 6, 1, 5]);
      expect(sorted).toEqual([6, 0, 1, 5]);
    });
  });

  describe('update() schema-failure path', () => {
    const base: QuickurrenceOptions = {
      rule: 'daily',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      timezone: 'UTC',
    };

    // A non-Date startDate no longer reaches the schema — it is rejected before
    // normalization — so the branch is exercised with values that survive
    // `clean()` and genuinely fail the final `safeParse`.
    const schemaFailures: readonly [string, Partial<QuickurrenceOptions>, QuickurrenceErrorCode][] = [
      ['weekStartsOn', { weekStartsOn: 9 as unknown as 0 }, QuickurrenceErrorCode.INVALID_WEEK_STARTS_ON],
      ['interval', { interval: 0 }, QuickurrenceErrorCode.INVALID_INTERVAL],
      ['monthDay', { monthDay: 32 as unknown as MonthDay }, QuickurrenceErrorCode.INVALID_MONTH_DAY],
    ];

    schemaFailures.forEach(([option, updates, code]) => {
      it(`throws when produced options fail final schema validation (${option})`, () => {
        const rule = option === 'monthDay' ? 'monthly' : 'daily';
        const error = expectCode(
          () => Quickurrence.update({ ...base, rule }, updates),
          code,
        );
        expect(error.message).toMatch(/Invalid quickurrence options/);
        expect(error.context?.operation).toBe('update');
        expect(error.context?.option).toBe(option);
        expect(error.context?.details?.issues).toBeDefined();
      });
    });

    it('rejects a non-Date startDate before it can reach the schema', () => {
      const error = expectCode(
        () =>
          Quickurrence.update(base, {
            startDate: 'not-a-date' as unknown as Date,
          }),
        QuickurrenceErrorCode.INVALID_START_DATE,
      );
      expect(error.message).toBe('startDate must be a Date object');
      // Not the schema branch: no zod issues, because normalization would have
      // coerced the string into a real Date and hidden the host-timezone parse.
      expect(error.context?.details).toBeUndefined();
    });
  });

  describe('presetToOptions unknown preset', () => {
    it('throws on unknown preset', () => {
      const error = expectCode(
        () => Quickurrence.presetToOptions('mystery' as unknown as 'businessDays'),
        QuickurrenceErrorCode.UNSUPPORTED_PRESET,
      );
      // Wording is matched to QuickurrenceValidator.validatePreset so the two
      // layers report an unknown preset identically.
      expect(error.message).toBe('Unsupported preset: mystery');
      expect(error.context?.option).toBe('preset');
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
        startDate: new Date('2026-01-05T00:00:00Z'),
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
        nthWeekdayOfMonth: { weekday: 2, nth: 2 },
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

  // Non-UTC rules reproduce the host-calendar bug even on a UTC host, which the
  // UTC-rule cases above cannot cover. Expectations are written as absolute UTC
  // instants so they hold under every TZ the suite is run with.
  describe('nthWeekdayOfMonth — host-timezone independence', () => {
    it('emits every second Monday for a Europe/Warsaw rule', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new TZDate(2026, 0, 1, 'Europe/Warsaw'),
        timezone: 'Europe/Warsaw',
        nthWeekdayOfMonth: { weekday: 1, nth: 2 },
      });
      const occurrences = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-06-30T23:59:59Z'),
      });
      expect(occurrences.map((d) => d.toISOString())).toEqual([
        '2026-01-11T23:00:00.000Z', // Jan 12 Warsaw
        '2026-02-08T23:00:00.000Z',
        '2026-03-08T23:00:00.000Z',
        '2026-04-12T22:00:00.000Z',
        '2026-05-10T22:00:00.000Z',
        '2026-06-07T22:00:00.000Z',
      ]);
    });

    it('finds the last Saturday of January for an America/Los_Angeles rule', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new TZDate(2026, 0, 1, 'America/Los_Angeles'),
        timezone: 'America/Los_Angeles',
        nthWeekdayOfMonth: { weekday: 6, nth: 'last' },
      });
      const occurrences = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-31T23:59:59Z'),
      });
      expect(occurrences.map((d) => d.toISOString())).toEqual([
        '2026-01-31T08:00:00.000Z',
      ]);
    });

    it('finds the first Saturday of each month for an America/Los_Angeles rule', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new TZDate(2026, 0, 1, 'America/Los_Angeles'),
        timezone: 'America/Los_Angeles',
        nthWeekdayOfMonth: { weekday: 6, nth: 1 },
      });
      const occurrences = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-04-30T23:59:59Z'),
      });
      expect(occurrences.map((d) => d.toISOString())).toEqual([
        '2026-01-03T08:00:00.000Z',
        '2026-02-07T08:00:00.000Z',
        '2026-03-07T08:00:00.000Z',
        '2026-04-04T07:00:00.000Z',
      ]);
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

  // Every expectation below is an absolute UTC instant computed by hand, never
  // read back from the implementation, so any host timezone that leaks its own
  // DST gap into the rule timezone's wall clock turns these red. The chosen
  // dates are the spring-forward days of the hosts that have historically
  // broken this library (2026-03-08 for America/Havana, 2024-03-31 and
  // 2026-03-29 for Atlantic/Azores and Asia/Beirut, 2024-04-26 for
  // Africa/Cairo).
  describe('host-timezone independence — wall-clock primitive', () => {
    const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

    describe('monthly monthDay landing on a host spring-forward day', () => {
      it('resolves monthDay 8 on 2026-03-08 for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          monthDay: 8,
          startDate: new Date('2026-02-08T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2026-02-08T00:00:00.000Z')).toISOString(),
        ).toBe('2026-03-08T00:00:00.000Z');
      });

      it('resolves monthDay 31 on 2024-03-31 and 2026-03-29 for a UTC rule', () => {
        const in2024 = new Quickurrence({
          rule: 'monthly',
          monthDay: 31,
          startDate: new Date('2024-03-01T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          in2024.getNextOccurrence(new Date('2024-03-01T00:00:00.000Z')).toISOString(),
        ).toBe('2024-03-31T00:00:00.000Z');

        const in2026 = new Quickurrence({
          rule: 'monthly',
          monthDay: 29,
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          in2026.getNextOccurrence(new Date('2026-03-01T00:00:00.000Z')).toISOString(),
        ).toBe('2026-03-29T00:00:00.000Z');
      });

      it('clamps monthDay 31 to the last day of shorter months for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          monthDay: 31,
          startDate: new Date('2024-01-31T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          iso(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00.000Z'),
              end: new Date('2024-04-30T00:00:00.000Z'),
            }),
          ),
        ).toEqual([
          '2024-01-31T00:00:00.000Z',
          '2024-02-29T00:00:00.000Z',
          '2024-03-31T00:00:00.000Z',
          '2024-04-30T00:00:00.000Z',
        ]);
      });

      it('resolves monthDay 31 in the rule timezone across the CET->CEST switch', () => {
        const in2024 = new Quickurrence({
          rule: 'monthly',
          monthDay: 31,
          startDate: new Date('2024-03-01T00:00:00.000Z'),
          timezone: 'Europe/Warsaw',
        });
        // Warsaw is still CET (+01:00) at midnight on 2024-03-31.
        expect(in2024.getNextOccurrence(new Date('2024-03-01T00:00:00.000Z')).getTime()).toBe(
          Date.parse('2024-03-30T23:00:00.000Z'),
        );

        const in2026 = new Quickurrence({
          rule: 'monthly',
          monthDay: 31,
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          timezone: 'Europe/Warsaw',
        });
        // Warsaw is already CEST (+02:00) at midnight on 2026-03-31.
        expect(in2026.getNextOccurrence(new Date('2026-03-01T00:00:00.000Z')).getTime()).toBe(
          Date.parse('2026-03-30T22:00:00.000Z'),
        );
      });

      it('resolves monthDay 26 on 2024-04-26 for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          monthDay: 26,
          startDate: new Date('2024-03-26T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2024-03-26T00:00:00.000Z')).toISOString(),
        ).toBe('2024-04-26T00:00:00.000Z');
      });
    });

    describe("nthWeekdayOfMonth 'last'", () => {
      it('finds the last Sunday of March 2024 and March 2026 for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 0, nth: 'last' },
          startDate: new Date('2024-03-01T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2024-03-01T00:00:00.000Z')).toISOString(),
        ).toBe('2024-03-31T00:00:00.000Z');

        const later = new Quickurrence({
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 0, nth: 'last' },
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          later.getNextOccurrence(new Date('2026-03-01T00:00:00.000Z')).toISOString(),
        ).toBe('2026-03-29T00:00:00.000Z');
      });

      it('finds the last Sunday of April 2024 for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 0, nth: 'last' },
          startDate: new Date('2024-04-01T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2024-04-01T00:00:00.000Z')).toISOString(),
        ).toBe('2024-04-28T00:00:00.000Z');
      });
    });

    describe('timesOfDay expansion', () => {
      it('keeps a midnight slot at midnight on 2026-03-08 for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-03-08T00:00:00.000Z'),
          timezone: 'UTC',
          timesOfDay: ['00:00', '01:00'],
        });
        expect(
          iso(
            rule.getAllOccurrences({
              start: new Date('2026-03-08T00:00:00.000Z'),
              end: new Date('2026-03-08T23:59:59.999Z'),
            }),
          ).map((s) => Date.parse(s)),
        ).toEqual([
          Date.parse('2026-03-08T00:00:00.000Z'),
          Date.parse('2026-03-08T01:00:00.000Z'),
        ]);
      });

      it('resolves a slot inside the rule timezone gap with the post-transition offset', () => {
        // Warsaw skips 02:00->03:00 on 2026-03-29, so 02:30 does not exist that
        // day; the documented policy applies the post-transition offset, which
        // lands on 01:30 CET.
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-03-28T00:00:00.000Z'),
          timezone: 'Europe/Warsaw',
          timesOfDay: ['02:30'],
        });
        const slots = rule.getAllOccurrences({
          start: new Date('2026-03-28T00:00:00.000Z'),
          end: new Date('2026-03-30T00:00:00.000Z'),
        });
        expect(slots.map((d) => d.getTime())).toEqual([
          Date.parse('2026-03-28T01:30:00.000Z'),
          Date.parse('2026-03-29T00:30:00.000Z'),
        ]);
      });
    });

    describe('cursors across the Warsaw CET->CEST switch', () => {
      it('steps a daily cursor over 2026-03-29', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-03-26T23:00:00.000Z'),
          timezone: 'Europe/Warsaw',
        });
        const out = rule.getAllOccurrences({
          start: new Date('2026-03-26T23:00:00.000Z'),
          end: new Date('2026-03-30T22:00:00.000Z'),
        });
        expect(out.map((d) => d.getTime())).toEqual([
          Date.parse('2026-03-26T23:00:00.000Z'),
          Date.parse('2026-03-27T23:00:00.000Z'),
          Date.parse('2026-03-28T23:00:00.000Z'),
          Date.parse('2026-03-29T22:00:00.000Z'),
          Date.parse('2026-03-30T22:00:00.000Z'),
        ]);
      });

      it('steps a weekly cursor over 2026-03-29', () => {
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new Date('2026-03-14T23:00:00.000Z'),
          timezone: 'Europe/Warsaw',
        });
        const out = rule.getAllOccurrences({
          start: new Date('2026-03-14T23:00:00.000Z'),
          end: new Date('2026-04-04T22:00:00.000Z'),
        });
        expect(out.map((d) => d.getTime())).toEqual([
          Date.parse('2026-03-14T23:00:00.000Z'),
          Date.parse('2026-03-21T23:00:00.000Z'),
          Date.parse('2026-03-28T23:00:00.000Z'),
          Date.parse('2026-04-04T22:00:00.000Z'),
        ]);
      });
    });

    describe('month arithmetic clamping', () => {
      it('clamps a 2-month step from Jan 31 onto Mar 31', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          interval: 2,
          startDate: new Date('2024-01-31T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2024-01-31T00:00:00.000Z')).getTime(),
        ).toBe(Date.parse('2024-03-31T00:00:00.000Z'));
      });

      it('clamps repeated 1-month steps from Jan 31', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new Date('2024-01-31T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule
            .getAllOccurrences({
              start: new Date('2024-01-01T00:00:00.000Z'),
              end: new Date('2024-04-30T00:00:00.000Z'),
            })
            .map((d) => d.toISOString()),
        ).toEqual([
          '2024-01-31T00:00:00.000Z',
          '2024-02-29T00:00:00.000Z',
          '2024-03-29T00:00:00.000Z',
          '2024-04-29T00:00:00.000Z',
        ]);
      });

      it('clamps a 200-month step from 2024-03-31 onto 2040-11-30', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          interval: 200,
          startDate: new Date('2024-03-31T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2024-03-31T00:00:00.000Z')).getTime(),
        ).toBe(Date.parse('2040-11-30T00:00:00.000Z'));
      });

      it('clamps a yearly step from Feb 29 onto Feb 28', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new Date('2024-02-29T00:00:00.000Z'),
          timezone: 'UTC',
        });
        expect(
          rule.getNextOccurrence(new Date('2024-02-29T00:00:00.000Z')).toISOString(),
        ).toBe('2025-02-28T00:00:00.000Z');
      });
    });

    describe('serialization of returned dates', () => {
      it('keeps a trailing Z on the raw monthDay escape path for a UTC rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          monthDay: 15,
          startDate: new Date('2026-06-10T00:00:00.000Z'),
          timezone: 'UTC',
        });
        const before = new Date('2026-01-01T00:00:00.000Z');
        expect(rule.getNextOccurrence(before).toISOString().endsWith('Z')).toBe(
          true,
        );
        expect(rule.getNextOccurrence(before).toISOString()).toBe(
          '2026-06-15T00:00:00.000Z',
        );
      });

      it('serializes END_DATE_EXCEEDED endDate metadata as UTC for a UTC timesOfDay rule', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          timezone: 'UTC',
          timesOfDay: ['09:00'],
          endDate: new Date('2026-01-03T23:59:59.999Z'),
        });
        try {
          rule.getNextOccurrence(new Date('2026-01-10T00:00:00.000Z'));
          throw new Error('should have thrown');
        } catch (error) {
          const details = (error as { context?: { details?: { endDate?: Date } } })
            .context?.details;
          expect(JSON.stringify(details?.endDate)).toMatch(/Z"$/);
        }
      });
    });

    describe('toHumanText endDate formatting', () => {
      const endDate = new Date('2026-03-15T00:00:00.000Z');
      const rule = new Quickurrence({
        rule: 'weekly',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        timezone: 'UTC',
        endDate,
      });

      it('formats endDate in the rule timezone using the host locale', () => {
        expect(rule.toHumanText().endsWith(
          endDate.toLocaleDateString(undefined, { timeZone: 'UTC' }),
        )).toBe(true);
      });

      // Whether the locale is hardcoded cannot be decided in-process on an
      // en-US host, so that half is covered by the CI job that runs the suite
      // under LC_ALL=de_DE.UTF-8: there, the test above fails if 'en-US' is
      // pinned. What IS decidable here is the timezone half — the calendar day
      // must come from the rule timezone, not from UTC or from the host.
      it('renders the endDate calendar day of the rule timezone', () => {
        const newYorkRule = new Quickurrence({
          rule: 'weekly',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          timezone: 'America/New_York',
          endDate,
        });
        // 2026-03-15T00:00Z is still 2026-03-14 in New York.
        expect(
          newYorkRule
            .toHumanText()
            .endsWith(
              endDate.toLocaleDateString(undefined, {
                timeZone: 'America/New_York',
              }),
            ),
        ).toBe(true);
        expect(
          newYorkRule
            .toHumanText()
            .endsWith(
              endDate.toLocaleDateString(undefined, { timeZone: 'UTC' }),
            ),
        ).toBe(false);
      });
    });
  });

  describe('Timezone identifier validation', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    // Syntactically a valid IANA name, so string-shape checks accept it; only
    // the runtime's tz database knows it does not exist.
    const unknownZone = 'Mars/Phobos';

    it('rejects a well-formed but nonexistent timezone', () => {
      expect(
        () => new Quickurrence({ rule: 'daily', startDate, timezone: unknownZone }),
      ).toThrow(QuickurrenceError);
    });

    it('reports INVALID_TIMEZONE instead of leaking a bare RangeError', () => {
      try {
        new Quickurrence({ rule: 'daily', startDate, timezone: unknownZone });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(QuickurrenceError);
        expect(err).not.toBeInstanceOf(RangeError);
        expect((err as QuickurrenceError).code).toBe(
          QuickurrenceErrorCode.INVALID_TIMEZONE,
        );
      }
    });

    it('rejects it on the default-startDate path with the same code', () => {
      try {
        new Quickurrence({ rule: 'daily', timezone: unknownZone });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(QuickurrenceError);
        expect(err).not.toBeInstanceOf(RangeError);
        // Blaming startDate here would send the caller after the wrong option.
        expect((err as QuickurrenceError).code).toBe(
          QuickurrenceErrorCode.INVALID_TIMEZONE,
        );
      }
    });

    it('rejects it when occurrences are generated', () => {
      expect(() => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate,
          timezone: unknownZone,
        });
        rule.getAllOccurrences({
          start: startDate,
          end: new Date('2026-01-03T00:00:00.000Z'),
        });
      }).toThrow(QuickurrenceError);
    });
  });

  describe('Years 0-99', () => {
    // Date.UTC remaps years 0-99 onto 1900-1999, so a year-50 rule is the
    // regression fixture for any wall-clock-to-epoch conversion that forgot it.
    const startDate = new Date('0050-01-01T00:00:00.000Z');
    const iso = (date: Date) => new Date(date.getTime()).toISOString();

    it('parses the fixture as year 50, not 1950', () => {
      expect(startDate.getUTCFullYear()).toBe(50);
    });

    it('keeps daily occurrences in year 50', () => {
      const rule = new Quickurrence({ rule: 'daily', startDate, timezone: 'UTC' });
      const occurrences = rule.getAllOccurrences({
        start: startDate,
        end: new Date('0050-01-03T00:00:00.000Z'),
      });
      expect(occurrences.map(iso)).toEqual([
        '0050-01-01T00:00:00.000Z',
        '0050-01-02T00:00:00.000Z',
        '0050-01-03T00:00:00.000Z',
      ]);
    });

    it('keeps timesOfDay expansion in year 50', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate,
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      const occurrences = rule.getAllOccurrences({
        start: startDate,
        end: new Date('0050-01-02T23:59:59.999Z'),
      });
      expect(occurrences.map(iso)).toEqual([
        '0050-01-01T09:00:00.000Z',
        '0050-01-02T09:00:00.000Z',
      ]);
    });

    it('keeps a monthly step in year 50', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate,
        monthDay: 1,
        timezone: 'UTC',
      });
      expect(iso(rule.getNextOccurrence(startDate))).toBe(
        '0050-02-01T00:00:00.000Z',
      );
    });

    it('keeps a yearly step in year 99 without rolling into 1900', () => {
      const year99 = new Date('0099-03-15T00:00:00.000Z');
      const rule = new Quickurrence({
        rule: 'yearly',
        startDate: year99,
        timezone: 'UTC',
      });
      expect(iso(rule.getNextOccurrence(year99))).toBe(
        '0100-03-15T00:00:00.000Z',
      );
    });
  });

  // Everything below uses a NON-UTC rule timezone. A UTC-rule assertion is
  // satisfied by any implementation that happens to agree with UTC, so the
  // 421-zone host sweep proves nothing about the rule-zone wall clock; only a
  // rule whose zone differs from UTC can catch an offset applied in the wrong
  // direction. Every expected instant is an absolute epoch derived by hand from
  // the rule zone's offset at that date (comments give the rule-zone wall
  // clock), never read back from the implementation, and `getTime()` is compared
  // rather than `toISOString()` because a TZDate renders in its own zone and can
  // print the same string for two different epochs.
  describe('Non-UTC rule timezone coverage', () => {
    const WARSAW = 'Europe/Warsaw';
    const NY = 'America/New_York';
    const CHATHAM = 'Pacific/Chatham';
    const epochs = (dates: Date[]) => dates.map((date) => date.getTime());

    describe('yearly', () => {
      it('anchors a Warsaw July yearly rule to CEST midnight every year', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 6, 15, WARSAW),
          timezone: WARSAW,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2027-12-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-07-14T22:00:00.000Z'), // 2024-07-15 00:00 +02:00
          Date.parse('2025-07-14T22:00:00.000Z'), // 2025-07-15 00:00 +02:00
          Date.parse('2026-07-14T22:00:00.000Z'), // 2026-07-15 00:00 +02:00
          Date.parse('2027-07-14T22:00:00.000Z'), // 2027-07-15 00:00 +02:00
        ]);
      });

      it('anchors a Warsaw January yearly rule to CET midnight every year', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 0, 15, WARSAW),
          timezone: WARSAW,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2026-12-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-01-14T23:00:00.000Z'), // 2024-01-15 00:00 +01:00
          Date.parse('2025-01-14T23:00:00.000Z'), // 2025-01-15 00:00 +01:00
          Date.parse('2026-01-14T23:00:00.000Z'), // 2026-01-15 00:00 +01:00
        ]);
      });

      it('honours interval 2 for a Warsaw yearly rule', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 6, 15, WARSAW),
          timezone: WARSAW,
          interval: 2,
        });
        expect(
          rule.getNextOccurrence(new TZDate(2024, 6, 15, WARSAW)).getTime(),
        ).toBe(Date.parse('2026-07-14T22:00:00.000Z')); // 2026-07-15 00:00
      });

      it('anchors a Pacific/Chatham yearly rule to +12:45 midnight', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 6, 15, CHATHAM),
          timezone: CHATHAM,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2026-12-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-07-14T11:15:00.000Z'), // 2024-07-15 00:00 +12:45
          Date.parse('2025-07-14T11:15:00.000Z'), // 2025-07-15 00:00 +12:45
          Date.parse('2026-07-14T11:15:00.000Z'), // 2026-07-15 00:00 +12:45
        ]);
      });
    });

    describe('count', () => {
      it('counts five Warsaw days across the CET->CEST switch', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          count: 5,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-03-01T00:00:00Z'),
              end: new Date('2026-04-30T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-03-26T23:00:00.000Z'), // 2026-03-27 00:00 +01:00
          Date.parse('2026-03-27T23:00:00.000Z'), // 2026-03-28 00:00 +01:00
          Date.parse('2026-03-28T23:00:00.000Z'), // 2026-03-29 00:00 +01:00
          Date.parse('2026-03-29T22:00:00.000Z'), // 2026-03-30 00:00 +02:00
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00
        ]);
      });

      it('counts three New York weeks across the EST->EDT switch', () => {
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 2, 2, NY),
          timezone: NY,
          count: 3,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-03-01T00:00:00Z'),
              end: new Date('2026-04-30T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-03-02T05:00:00.000Z'), // 2026-03-02 00:00 -05:00
          Date.parse('2026-03-09T04:00:00.000Z'), // 2026-03-09 00:00 -04:00
          Date.parse('2026-03-16T04:00:00.000Z'), // 2026-03-16 00:00 -04:00
        ]);
      });

      it('throws COUNT_LIMIT_EXCEEDED past a Warsaw rule count', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          count: 2,
        });
        try {
          rule.getNextOccurrence(new TZDate(2026, 2, 29, WARSAW));
          throw new Error('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(QuickurrenceError);
          expect((err as QuickurrenceError).code).toBe(
            QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
          );
        }
      });

      it('reports the count through the getter for a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          count: 5,
        });
        expect(rule.getCount()).toBe(5);
      });
    });

    describe('excludeDates', () => {
      const warsawDaily = (excludeDates?: Date[]) =>
        new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          excludeDates,
        });
      const range = {
        start: new Date('2026-03-26T23:00:00Z'),
        end: new Date('2026-03-31T21:00:00Z'),
      };

      it('emits every Warsaw day when nothing is excluded', () => {
        expect(epochs(warsawDaily().getAllOccurrences(range))).toEqual([
          Date.parse('2026-03-26T23:00:00.000Z'), // 2026-03-27 00:00 +01:00
          Date.parse('2026-03-27T23:00:00.000Z'), // 2026-03-28 00:00 +01:00
          Date.parse('2026-03-28T23:00:00.000Z'), // 2026-03-29 00:00 +01:00
          Date.parse('2026-03-29T22:00:00.000Z'), // 2026-03-30 00:00 +02:00
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00
        ]);
      });

      it('matches an excluded mid-day instant at Warsaw day level', () => {
        // 12:00Z on 2026-03-29 is mid-afternoon in Warsaw, so a day-level
        // exclusion has to drop the whole Warsaw day, not an exact instant.
        const rule = warsawDaily([new Date('2026-03-29T12:00:00Z')]);
        expect(epochs(rule.getAllOccurrences(range))).toEqual([
          Date.parse('2026-03-26T23:00:00.000Z'), // 2026-03-27 00:00
          Date.parse('2026-03-27T23:00:00.000Z'), // 2026-03-28 00:00
          Date.parse('2026-03-29T22:00:00.000Z'), // 2026-03-30 00:00
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00
        ]);
      });

      it('normalizes excludeDates to Warsaw midnight, not UTC midnight', () => {
        const rule = warsawDaily([new Date('2026-03-29T12:00:00Z')]);
        expect(epochs(rule.getExcludeDates() ?? [])).toEqual([
          Date.parse('2026-03-28T23:00:00.000Z'), // 2026-03-29 00:00 +01:00
        ]);
      });

      it('skips the excluded Warsaw day in getNextOccurrence', () => {
        const rule = warsawDaily([new Date('2026-03-29T12:00:00Z')]);
        expect(
          rule.getNextOccurrence(new TZDate(2026, 2, 28, WARSAW)).getTime(),
        ).toBe(Date.parse('2026-03-29T22:00:00.000Z')); // 2026-03-30 00:00
      });

      it('resolves the excluded day in the rule zone, not in UTC', () => {
        // 2026-01-05T23:00Z is 18:00 on Jan 5 in New York but already Jan 6 in
        // UTC; a UTC-day match would drop the wrong occurrence.
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 0, 1, NY),
          timezone: NY,
          excludeDates: [new Date('2026-01-05T23:00:00Z')],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-01-08T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-01T05:00:00.000Z'), // 2026-01-01 00:00 -05:00
          Date.parse('2026-01-02T05:00:00.000Z'), // 2026-01-02 00:00
          Date.parse('2026-01-03T05:00:00.000Z'), // 2026-01-03 00:00
          Date.parse('2026-01-04T05:00:00.000Z'), // 2026-01-04 00:00
          // 2026-01-05 excluded
          Date.parse('2026-01-06T05:00:00.000Z'), // 2026-01-06 00:00
          Date.parse('2026-01-07T05:00:00.000Z'), // 2026-01-07 00:00
        ]);
      });
    });

    // weekStartsOn only becomes observable once the interval skips weeks: it
    // decides which rule-zone day the alternating week buckets start on, so a
    // Sunday-start and a Monday-start rule select different dates from the same
    // weekDays list.
    describe('weekStartsOn', () => {
      const warsawFortnightly = (weekStartsOn: 0 | 1) =>
        new Quickurrence({
          rule: 'weekly',
          interval: 2,
          startDate: new TZDate(2026, 0, 7, WARSAW), // Wed 2026-01-07
          timezone: WARSAW,
          weekStartsOn,
          weekDays: [0, 3], // Sunday, Wednesday
        }).getAllOccurrences({
          start: new Date('2026-01-01T00:00:00Z'),
          end: new Date('2026-02-10T00:00:00Z'),
        });

      it('buckets alternating Warsaw weeks from Sunday', () => {
        expect(epochs(warsawFortnightly(0))).toEqual([
          Date.parse('2026-01-06T23:00:00.000Z'), // Wed 2026-01-07 00:00 +01:00
          Date.parse('2026-01-17T23:00:00.000Z'), // Sun 2026-01-18 00:00
          Date.parse('2026-01-20T23:00:00.000Z'), // Wed 2026-01-21 00:00
          Date.parse('2026-01-31T23:00:00.000Z'), // Sun 2026-02-01 00:00
          Date.parse('2026-02-03T23:00:00.000Z'), // Wed 2026-02-04 00:00
        ]);
      });

      it('buckets alternating Warsaw weeks from Monday', () => {
        expect(epochs(warsawFortnightly(1))).toEqual([
          Date.parse('2026-01-06T23:00:00.000Z'), // Wed 2026-01-07 00:00 +01:00
          Date.parse('2026-01-10T23:00:00.000Z'), // Sun 2026-01-11 00:00
          Date.parse('2026-01-20T23:00:00.000Z'), // Wed 2026-01-21 00:00
          Date.parse('2026-01-24T23:00:00.000Z'), // Sun 2026-01-25 00:00
          Date.parse('2026-02-03T23:00:00.000Z'), // Wed 2026-02-04 00:00
          Date.parse('2026-02-07T23:00:00.000Z'), // Sun 2026-02-08 00:00
        ]);
      });

      it('defaults to Monday for a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 0, 7, WARSAW),
          timezone: WARSAW,
        });
        expect(rule.getWeekStartsOn()).toBe(1);
      });

      const chathamFortnightly = (weekStartsOn: 0 | 1) =>
        new Quickurrence({
          rule: 'weekly',
          interval: 2,
          startDate: new TZDate(2026, 3, 1, CHATHAM), // Wed 2026-04-01
          timezone: CHATHAM,
          weekStartsOn,
          weekDays: [0, 3],
        }).getAllOccurrences({
          start: new Date('2026-03-25T00:00:00Z'),
          end: new Date('2026-05-01T00:00:00Z'),
        });

      it('buckets alternating Chatham weeks from Sunday across the DST end', () => {
        expect(epochs(chathamFortnightly(0))).toEqual([
          Date.parse('2026-03-31T10:15:00.000Z'), // Wed 2026-04-01 00:00 +13:45
          Date.parse('2026-04-11T11:15:00.000Z'), // Sun 2026-04-12 00:00 +12:45
          Date.parse('2026-04-14T11:15:00.000Z'), // Wed 2026-04-15 00:00 +12:45
          Date.parse('2026-04-25T11:15:00.000Z'), // Sun 2026-04-26 00:00 +12:45
          Date.parse('2026-04-28T11:15:00.000Z'), // Wed 2026-04-29 00:00 +12:45
        ]);
      });

      it('buckets alternating Chatham weeks from Monday across the DST end', () => {
        expect(epochs(chathamFortnightly(1))).toEqual([
          Date.parse('2026-03-31T10:15:00.000Z'), // Wed 2026-04-01 00:00 +13:45
          Date.parse('2026-04-04T10:15:00.000Z'), // Sun 2026-04-05 00:00 +13:45
          Date.parse('2026-04-14T11:15:00.000Z'), // Wed 2026-04-15 00:00 +12:45
          Date.parse('2026-04-18T11:15:00.000Z'), // Sun 2026-04-19 00:00 +12:45
          Date.parse('2026-04-28T11:15:00.000Z'), // Wed 2026-04-29 00:00 +12:45
        ]);
      });
    });

    describe('nthWeekdayOfMonth nth 3 and nth 4', () => {
      it('finds the 3rd Wednesday of each month for a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 1, WARSAW),
          timezone: WARSAW,
          nthWeekdayOfMonth: { weekday: 3, nth: 3 },
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-06-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-20T23:00:00.000Z'), // 2026-01-21 00:00 +01:00
          Date.parse('2026-02-17T23:00:00.000Z'), // 2026-02-18 00:00 +01:00
          Date.parse('2026-03-17T23:00:00.000Z'), // 2026-03-18 00:00 +01:00
          Date.parse('2026-04-14T22:00:00.000Z'), // 2026-04-15 00:00 +02:00
          Date.parse('2026-05-19T22:00:00.000Z'), // 2026-05-20 00:00 +02:00
          Date.parse('2026-06-16T22:00:00.000Z'), // 2026-06-17 00:00 +02:00
        ]);
      });

      it('finds the 4th Sunday of each month for a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 1, WARSAW),
          timezone: WARSAW,
          nthWeekdayOfMonth: { weekday: 0, nth: 4 },
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-06-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-24T23:00:00.000Z'), // 2026-01-25 00:00 +01:00
          Date.parse('2026-02-21T23:00:00.000Z'), // 2026-02-22 00:00 +01:00
          Date.parse('2026-03-21T23:00:00.000Z'), // 2026-03-22 00:00 +01:00
          Date.parse('2026-04-25T22:00:00.000Z'), // 2026-04-26 00:00 +02:00
          Date.parse('2026-05-23T22:00:00.000Z'), // 2026-05-24 00:00 +02:00
          Date.parse('2026-06-27T22:00:00.000Z'), // 2026-06-28 00:00 +02:00
        ]);
      });

      it('finds the 4th Tuesday of each month for a Chatham rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 2, 1, CHATHAM),
          timezone: CHATHAM,
          nthWeekdayOfMonth: { weekday: 2, nth: 4 },
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-03-01T00:00:00Z'),
              end: new Date('2026-05-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-03-23T10:15:00.000Z'), // 2026-03-24 00:00 +13:45
          Date.parse('2026-04-27T11:15:00.000Z'), // 2026-04-28 00:00 +12:45
          Date.parse('2026-05-25T11:15:00.000Z'), // 2026-05-26 00:00 +12:45
        ]);
      });
    });

    describe('condition', () => {
      // The predicate receives the occurrence instant, so a Warsaw day-level
      // occurrence is 23:00Z in winter and 22:00Z in summer. Filtering on the
      // UTC hour therefore selects exactly the CEST days.
      const isCestMidnight = (date: Date) => date.getUTCHours() === 22;
      const range = {
        start: new Date('2026-03-27T00:00:00Z'),
        end: new Date('2026-04-02T00:00:00Z'),
      };

      it('passes the rule-zone instant to a function condition', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          condition: isCestMidnight,
        });
        expect(epochs(rule.getAllOccurrences(range))).toEqual([
          Date.parse('2026-03-29T22:00:00.000Z'), // 2026-03-30 00:00 +02:00
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00
          Date.parse('2026-03-31T22:00:00.000Z'), // 2026-04-01 00:00 +02:00
          Date.parse('2026-04-01T22:00:00.000Z'), // 2026-04-02 00:00 +02:00
        ]);
      });

      it('yields nothing for a false condition on a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          condition: false,
        });
        expect(rule.getAllOccurrences(range)).toEqual([]);
      });

      it('skips condition-rejected Warsaw days in getNextOccurrence', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 2, 27, WARSAW),
          timezone: WARSAW,
          condition: isCestMidnight,
        });
        expect(
          rule.getNextOccurrence(new TZDate(2026, 2, 27, WARSAW)).getTime(),
        ).toBe(Date.parse('2026-03-29T22:00:00.000Z')); // 2026-03-30 00:00
      });
    });

    describe('monthDay', () => {
      it('skips months without day 29 for a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 29, WARSAW),
          timezone: WARSAW,
          monthDay: 29,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-05-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-28T23:00:00.000Z'), // 2026-01-29 00:00 +01:00
          Date.parse('2026-02-27T23:00:00.000Z'), // 2026-02-28 00:00 +01:00
          Date.parse('2026-03-28T23:00:00.000Z'), // 2026-03-29 00:00 +01:00
          Date.parse('2026-04-28T22:00:00.000Z'), // 2026-04-29 00:00 +02:00
          Date.parse('2026-05-28T22:00:00.000Z'), // 2026-05-29 00:00 +02:00
        ]);
      });

      it("clamps monthDay 31 with mode 'last' for a Warsaw rule", () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 31, WARSAW),
          timezone: WARSAW,
          monthDay: 31,
          monthDayMode: 'last',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-04-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-30T23:00:00.000Z'), // 2026-01-31 00:00 +01:00
          Date.parse('2026-02-27T23:00:00.000Z'), // 2026-02-28 00:00 +01:00
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00
          Date.parse('2026-04-29T22:00:00.000Z'), // 2026-04-30 00:00 +02:00
        ]);
      });

      it('resolves monthDay 15 for a Chatham rule across the DST end', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 2, 15, CHATHAM),
          timezone: CHATHAM,
          monthDay: 15,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-03-01T00:00:00Z'),
              end: new Date('2026-05-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-03-14T10:15:00.000Z'), // 2026-03-15 00:00 +13:45
          Date.parse('2026-04-14T11:15:00.000Z'), // 2026-04-15 00:00 +12:45
          Date.parse('2026-05-14T11:15:00.000Z'), // 2026-05-15 00:00 +12:45
        ]);
      });
    });

    // `skip` is the only monthDay mode that DROPS a month, so the month length
    // it consults has to be the one seen from the rule timezone. Havana is the
    // sharpest probe: it is west of UTC, so a local midnight always lands on a
    // LATER UTC instant, and its DST jump happens at local midnight itself.
    // Warsaw is east of UTC, so its local midnight lands on the PREVIOUS UTC
    // day — the opposite sign of the same mistake.
    describe("monthDayMode 'skip'", () => {
      const HAVANA = 'America/Havana';

      it('drops exactly the sub-31-day months for a Havana rule across a year', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 31, HAVANA),
          timezone: HAVANA,
          monthDay: 31,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-12-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-31T05:00:00.000Z'), // 2026-01-31 00:00 -05:00 CST
          Date.parse('2026-03-31T04:00:00.000Z'), // 2026-03-31 00:00 -04:00 CDT
          Date.parse('2026-05-31T04:00:00.000Z'), // 2026-05-31 00:00 -04:00 CDT
          Date.parse('2026-07-31T04:00:00.000Z'), // 2026-07-31 00:00 -04:00 CDT
          Date.parse('2026-08-31T04:00:00.000Z'), // 2026-08-31 00:00 -04:00 CDT
          Date.parse('2026-10-31T04:00:00.000Z'), // 2026-10-31 00:00 -04:00 CDT
          Date.parse('2026-12-31T05:00:00.000Z'), // 2026-12-31 00:00 -05:00 CST
        ]);
      });

      it('drops exactly the sub-31-day months for a Warsaw rule across a year', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 31, WARSAW),
          timezone: WARSAW,
          monthDay: 31,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-12-31T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-30T23:00:00.000Z'), // 2026-01-31 00:00 +01:00 CET
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00 CEST
          Date.parse('2026-05-30T22:00:00.000Z'), // 2026-05-31 00:00 +02:00 CEST
          Date.parse('2026-07-30T22:00:00.000Z'), // 2026-07-31 00:00 +02:00 CEST
          Date.parse('2026-08-30T22:00:00.000Z'), // 2026-08-31 00:00 +02:00 CEST
          Date.parse('2026-10-30T23:00:00.000Z'), // 2026-10-31 00:00 +01:00 CET
          Date.parse('2026-12-30T23:00:00.000Z'), // 2026-12-31 00:00 +01:00 CET
        ]);
      });

      it('drops February for monthDay 30 under a Havana rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 30, HAVANA),
          timezone: HAVANA,
          monthDay: 30,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-04-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-30T05:00:00.000Z'), // 2026-01-30 00:00 -05:00 CST
          Date.parse('2026-03-30T04:00:00.000Z'), // 2026-03-30 00:00 -04:00 CDT
          Date.parse('2026-04-30T04:00:00.000Z'), // 2026-04-30 00:00 -04:00 CDT
        ]);
      });

      it('drops February for monthDay 30 under a Warsaw rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 30, WARSAW),
          timezone: WARSAW,
          monthDay: 30,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-04-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-29T23:00:00.000Z'), // 2026-01-30 00:00 +01:00 CET
          Date.parse('2026-03-29T22:00:00.000Z'), // 2026-03-30 00:00 +02:00 CEST
          Date.parse('2026-04-29T22:00:00.000Z'), // 2026-04-30 00:00 +02:00 CEST
        ]);
      });

      it('keeps February for monthDay 29 in a leap year under a Havana rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2024, 0, 29, HAVANA),
          timezone: HAVANA,
          monthDay: 29,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2024-04-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-01-29T05:00:00.000Z'), // 2024-01-29 00:00 -05:00 CST
          Date.parse('2024-02-29T05:00:00.000Z'), // 2024-02-29 00:00 -05:00 CST
          Date.parse('2024-03-29T04:00:00.000Z'), // 2024-03-29 00:00 -04:00 CDT
          Date.parse('2024-04-29T04:00:00.000Z'), // 2024-04-29 00:00 -04:00 CDT
        ]);
      });

      it('drops February for monthDay 29 in a non-leap year under a Havana rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 29, HAVANA),
          timezone: HAVANA,
          monthDay: 29,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-04-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-29T05:00:00.000Z'), // 2026-01-29 00:00 -05:00 CST
          Date.parse('2026-03-29T04:00:00.000Z'), // 2026-03-29 00:00 -04:00 CDT
          Date.parse('2026-04-29T04:00:00.000Z'), // 2026-04-29 00:00 -04:00 CDT
        ]);
      });

      it('keeps then drops February for monthDay 29 across a Warsaw leap boundary', () => {
        const leap = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2024, 1, 1, WARSAW),
          timezone: WARSAW,
          monthDay: 29,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            leap.getAllOccurrences({
              start: new Date('2024-02-01T00:00:00Z'),
              end: new Date('2024-02-29T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-02-28T23:00:00.000Z'), // 2024-02-29 00:00 +01:00 CET
        ]);

        const nonLeap = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 1, 1, WARSAW),
          timezone: WARSAW,
          monthDay: 29,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            nonLeap.getAllOccurrences({
              start: new Date('2026-02-01T00:00:00Z'),
              end: new Date('2026-02-28T23:59:59Z'),
            }),
          ),
        ).toEqual([]);
      });

      it("resolves the first existing instant of the day when Havana's DST jump removes local midnight", () => {
        // Havana starts DST at 00:00 local on 2026-03-08: the clock goes
        // straight from 23:59:59 -05:00 to 01:00:00 -04:00, so 00:00 never
        // occurs and the day's first instant is 01:00 CDT = 05:00Z.
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 8, HAVANA),
          timezone: HAVANA,
          monthDay: 8,
          monthDayMode: 'skip',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-04-30T23:59:59Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-08T05:00:00.000Z'), // 2026-01-08 00:00 -05:00 CST
          Date.parse('2026-02-08T05:00:00.000Z'), // 2026-02-08 00:00 -05:00 CST
          Date.parse('2026-03-08T05:00:00.000Z'), // 2026-03-08 01:00 -04:00 CDT
          Date.parse('2026-04-08T04:00:00.000Z'), // 2026-04-08 00:00 -04:00 CDT
        ]);
      });

      it('jumps over February from getNextOccurrence under a Havana rule', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 31, HAVANA),
          timezone: HAVANA,
          monthDay: 31,
          monthDayMode: 'skip',
        });
        expect(
          rule.getNextOccurrence(new TZDate(2026, 1, 15, HAVANA)).getTime(),
        ).toBe(Date.parse('2026-03-31T04:00:00.000Z')); // 2026-03-31 00:00 -04:00
      });

      // The pair below is the whole point of the option: identical input, one
      // character of difference in the mode, two different answers.
      it("differs from 'last' on the same Havana input", () => {
        const options = {
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 31, HAVANA),
          timezone: HAVANA,
          monthDay: 31,
        } as const;
        const range = {
          start: new Date('2026-01-01T00:00:00Z'),
          end: new Date('2026-04-30T23:59:59Z'),
        };

        expect(
          epochs(
            new Quickurrence({
              ...options,
              monthDayMode: 'skip',
            }).getAllOccurrences(range),
          ),
        ).toEqual([
          Date.parse('2026-01-31T05:00:00.000Z'), // 2026-01-31 00:00 -05:00 CST
          Date.parse('2026-03-31T04:00:00.000Z'), // 2026-03-31 00:00 -04:00 CDT
        ]);

        expect(
          epochs(
            new Quickurrence({
              ...options,
              monthDayMode: 'last',
            }).getAllOccurrences(range),
          ),
        ).toEqual([
          Date.parse('2026-01-31T05:00:00.000Z'), // 2026-01-31 00:00 -05:00 CST
          Date.parse('2026-02-28T05:00:00.000Z'), // 2026-02-28 00:00 -05:00 CST
          Date.parse('2026-03-31T04:00:00.000Z'), // 2026-03-31 00:00 -04:00 CDT
          Date.parse('2026-04-30T04:00:00.000Z'), // 2026-04-30 00:00 -04:00 CDT
        ]);
      });

      it("differs from 'last' on the same Warsaw input", () => {
        const options = {
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 31, WARSAW),
          timezone: WARSAW,
          monthDay: 31,
        } as const;
        const range = {
          start: new Date('2026-01-01T00:00:00Z'),
          end: new Date('2026-04-30T23:59:59Z'),
        };

        expect(
          epochs(
            new Quickurrence({
              ...options,
              monthDayMode: 'skip',
            }).getAllOccurrences(range),
          ),
        ).toEqual([
          Date.parse('2026-01-30T23:00:00.000Z'), // 2026-01-31 00:00 +01:00 CET
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00 CEST
        ]);

        expect(
          epochs(
            new Quickurrence({
              ...options,
              monthDayMode: 'last',
            }).getAllOccurrences(range),
          ),
        ).toEqual([
          Date.parse('2026-01-30T23:00:00.000Z'), // 2026-01-31 00:00 +01:00 CET
          Date.parse('2026-02-27T23:00:00.000Z'), // 2026-02-28 00:00 +01:00 CET
          Date.parse('2026-03-30T22:00:00.000Z'), // 2026-03-31 00:00 +02:00 CEST
          Date.parse('2026-04-29T22:00:00.000Z'), // 2026-04-30 00:00 +02:00 CEST
        ]);
      });
    });

    describe('weekDays', () => {
      it('emits Mon/Wed/Fri across the Warsaw spring-forward weekend', () => {
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 2, 23, WARSAW), // Mon 2026-03-23
          timezone: WARSAW,
          weekDays: [1, 3, 5],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-03-23T00:00:00Z'),
              end: new Date('2026-04-04T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-03-22T23:00:00.000Z'), // Mon 2026-03-23 00:00 +01:00
          Date.parse('2026-03-24T23:00:00.000Z'), // Wed 2026-03-25 00:00 +01:00
          Date.parse('2026-03-26T23:00:00.000Z'), // Fri 2026-03-27 00:00 +01:00
          Date.parse('2026-03-29T22:00:00.000Z'), // Mon 2026-03-30 00:00 +02:00
          Date.parse('2026-03-31T22:00:00.000Z'), // Wed 2026-04-01 00:00 +02:00
          Date.parse('2026-04-02T22:00:00.000Z'), // Fri 2026-04-03 00:00 +02:00
        ]);
      });

      it('emits Sundays across the New York fall-back weekend', () => {
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 9, 25, NY), // Sun 2026-10-25
          timezone: NY,
          weekDays: [0],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-10-25T00:00:00Z'),
              end: new Date('2026-11-16T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-10-25T04:00:00.000Z'), // 2026-10-25 00:00 -04:00
          Date.parse('2026-11-01T04:00:00.000Z'), // 2026-11-01 00:00 -04:00
          Date.parse('2026-11-08T05:00:00.000Z'), // 2026-11-08 00:00 -05:00
          Date.parse('2026-11-15T05:00:00.000Z'), // 2026-11-15 00:00 -05:00
        ]);
      });

      it('emits Tue/Sat across the Lord Howe 30-minute DST end', () => {
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 2, 31, 'Australia/Lord_Howe'), // Tue
          timezone: 'Australia/Lord_Howe',
          weekDays: [2, 6],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-03-30T00:00:00Z'),
              end: new Date('2026-04-12T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-03-30T13:00:00.000Z'), // Tue 2026-03-31 00:00 +11:00
          Date.parse('2026-04-03T13:00:00.000Z'), // Sat 2026-04-04 00:00 +11:00
          Date.parse('2026-04-06T13:30:00.000Z'), // Tue 2026-04-07 00:00 +10:30
          Date.parse('2026-04-10T13:30:00.000Z'), // Sat 2026-04-11 00:00 +10:30
        ]);
      });
    });

    describe('toHumanText', () => {
      it('renders endDate in the Warsaw rule zone, not in UTC', () => {
        // 23:30Z on 2026-03-15 is already 2026-03-16 in Warsaw, so a UTC
        // rendering names the wrong day.
        const endDate = new Date('2026-03-15T23:30:00Z');
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 0, 1, WARSAW),
          timezone: WARSAW,
          endDate,
        });
        const inWarsaw = endDate.toLocaleDateString(undefined, {
          timeZone: WARSAW,
        });
        const inUtc = endDate.toLocaleDateString(undefined, {
          timeZone: 'UTC',
        });
        expect(inWarsaw).not.toBe(inUtc);
        expect(rule.toHumanText()).toBe(`Daily until ${inWarsaw}`);
      });

      it('renders endDate in a Pacific/Kiritimati rule zone', () => {
        const endDate = new Date('2026-03-15T11:00:00Z');
        const rule = new Quickurrence({
          rule: 'weekly',
          startDate: new TZDate(2026, 0, 1, 'Pacific/Kiritimati'),
          timezone: 'Pacific/Kiritimati',
          weekDays: [2, 4],
          endDate,
        });
        const inKiritimati = endDate.toLocaleDateString(undefined, {
          timeZone: 'Pacific/Kiritimati',
        });
        expect(inKiritimati).not.toBe(
          endDate.toLocaleDateString(undefined, { timeZone: 'UTC' }),
        );
        expect(rule.toHumanText()).toBe(
          `Weekly on Tuesday, Thursday until ${inKiritimati}`,
        );
      });

      it('describes an nth-weekday Lord Howe rule with a count terminator', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 1, 'Australia/Lord_Howe'),
          timezone: 'Australia/Lord_Howe',
          nthWeekdayOfMonth: { weekday: 4, nth: 3 },
          count: 6,
        });
        expect(rule.toHumanText()).toBe('Monthly on the 3rd Thursday, 6 times');
      });
    });

    // Rule zones whose offset is not a whole number of hours: an implementation
    // that rounds to hours, or that reuses the host's minute field, lands 15 or
    // 30 minutes off. Lord Howe additionally shifts by only 30 minutes for DST.
    describe('non-integral rule-timezone offsets', () => {
      it('keeps a 09:00 Lord Howe slot across the +11:00 -> +10:30 switch', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-04-03T00:00:00Z'),
          timezone: 'Australia/Lord_Howe',
          timesOfDay: ['09:00'],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-04-03T00:00:00Z'),
              end: new Date('2026-04-07T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-04-03T22:00:00.000Z'), // 2026-04-04 09:00 +11:00
          Date.parse('2026-04-04T22:30:00.000Z'), // 2026-04-05 09:00 +10:30
          Date.parse('2026-04-05T22:30:00.000Z'), // 2026-04-06 09:00 +10:30
          Date.parse('2026-04-06T22:30:00.000Z'), // 2026-04-07 09:00 +10:30
        ]);
      });

      it('keeps Lord Howe day-level midnights across the DST end', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 3, 3, 'Australia/Lord_Howe'),
          timezone: 'Australia/Lord_Howe',
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-04-02T00:00:00Z'),
              end: new Date('2026-04-07T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-04-02T13:00:00.000Z'), // 2026-04-03 00:00 +11:00
          Date.parse('2026-04-03T13:00:00.000Z'), // 2026-04-04 00:00 +11:00
          Date.parse('2026-04-04T13:00:00.000Z'), // 2026-04-05 00:00 +11:00
          Date.parse('2026-04-05T13:30:00.000Z'), // 2026-04-06 00:00 +10:30
          Date.parse('2026-04-06T13:30:00.000Z'), // 2026-04-07 00:00 +10:30
        ]);
      });

      it('keeps a 09:00 Chatham slot across the +13:45 -> +12:45 switch', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-04-03T00:00:00Z'),
          timezone: CHATHAM,
          timesOfDay: ['09:00'],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-04-03T00:00:00Z'),
              end: new Date('2026-04-07T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-04-03T19:15:00.000Z'), // 2026-04-04 09:00 +13:45
          Date.parse('2026-04-04T20:15:00.000Z'), // 2026-04-05 09:00 +12:45
          Date.parse('2026-04-05T20:15:00.000Z'), // 2026-04-06 09:00 +12:45
          Date.parse('2026-04-06T20:15:00.000Z'), // 2026-04-07 09:00 +12:45
        ]);
      });

      it('keeps Chatham day-level midnights across the DST end', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new TZDate(2026, 3, 3, CHATHAM),
          timezone: CHATHAM,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-04-02T00:00:00Z'),
              end: new Date('2026-04-07T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-04-02T10:15:00.000Z'), // 2026-04-03 00:00 +13:45
          Date.parse('2026-04-03T10:15:00.000Z'), // 2026-04-04 00:00 +13:45
          Date.parse('2026-04-04T10:15:00.000Z'), // 2026-04-05 00:00 +13:45
          Date.parse('2026-04-05T11:15:00.000Z'), // 2026-04-06 00:00 +12:45
          Date.parse('2026-04-06T11:15:00.000Z'), // 2026-04-07 00:00 +12:45
        ]);
      });

      it('resolves monthDay 15 at the Kathmandu +05:45 offset', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2026, 0, 15, 'Asia/Kathmandu'),
          timezone: 'Asia/Kathmandu',
          monthDay: 15,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-04-30T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-14T18:15:00.000Z'), // 2026-01-15 00:00 +05:45
          Date.parse('2026-02-14T18:15:00.000Z'), // 2026-02-15 00:00 +05:45
          Date.parse('2026-03-14T18:15:00.000Z'), // 2026-03-15 00:00 +05:45
          Date.parse('2026-04-14T18:15:00.000Z'), // 2026-04-15 00:00 +05:45
        ]);
      });

      it('orders Kathmandu slots that straddle UTC midnight by rule-zone day', () => {
        const rule = new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-01-01T00:00:00Z'),
          timezone: 'Asia/Kathmandu',
          timesOfDay: ['00:15', '23:45'],
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2026-01-01T00:00:00Z'),
              end: new Date('2026-01-03T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2026-01-01T18:00:00.000Z'), // 2026-01-01 23:45 +05:45
          Date.parse('2026-01-01T18:30:00.000Z'), // 2026-01-02 00:15 +05:45
          Date.parse('2026-01-02T18:00:00.000Z'), // 2026-01-02 23:45 +05:45
          Date.parse('2026-01-02T18:30:00.000Z'), // 2026-01-03 00:15 +05:45
        ]);
      });
    });

    // The leap-year cases elsewhere in this file all use a UTC rule, so nothing
    // pinned the clamp under a zone whose offset changes between the anchor
    // month and the clamped one.
    describe('leap year under a DST rule timezone', () => {
      it('clamps a Feb 29 Warsaw yearly rule onto Feb 28 forever', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 1, 29, WARSAW),
          timezone: WARSAW,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2029-01-01T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-02-28T23:00:00.000Z'), // 2024-02-29 00:00 +01:00
          Date.parse('2025-02-27T23:00:00.000Z'), // 2025-02-28 00:00 +01:00
          Date.parse('2026-02-27T23:00:00.000Z'), // 2026-02-28 00:00 +01:00
          Date.parse('2027-02-27T23:00:00.000Z'), // 2027-02-28 00:00 +01:00
          // 2028 is a leap year, but the clamped anchor stays on Feb 28.
          Date.parse('2028-02-27T23:00:00.000Z'), // 2028-02-28 00:00 +01:00
        ]);
      });

      it('clamps the first step of a Feb 29 Warsaw yearly rule', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 1, 29, WARSAW),
          timezone: WARSAW,
        });
        expect(
          rule.getNextOccurrence(new TZDate(2024, 1, 29, WARSAW)).getTime(),
        ).toBe(Date.parse('2025-02-27T23:00:00.000Z')); // 2025-02-28 00:00
      });

      it('walks a Feb 29 Warsaw monthly rule through the CET->CEST switch', () => {
        const rule = new Quickurrence({
          rule: 'monthly',
          startDate: new TZDate(2024, 1, 29, WARSAW),
          timezone: WARSAW,
          monthDay: 29,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2024-06-01T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-02-28T23:00:00.000Z'), // 2024-02-29 00:00 +01:00
          Date.parse('2024-03-28T23:00:00.000Z'), // 2024-03-29 00:00 +01:00
          Date.parse('2024-04-28T22:00:00.000Z'), // 2024-04-29 00:00 +02:00
          Date.parse('2024-05-28T22:00:00.000Z'), // 2024-05-29 00:00 +02:00
        ]);
      });

      it('clamps a Feb 29 Chatham yearly rule at +13:45', () => {
        const rule = new Quickurrence({
          rule: 'yearly',
          startDate: new TZDate(2024, 1, 29, CHATHAM),
          timezone: CHATHAM,
        });
        expect(
          epochs(
            rule.getAllOccurrences({
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2027-01-01T00:00:00Z'),
            }),
          ),
        ).toEqual([
          Date.parse('2024-02-28T10:15:00.000Z'), // 2024-02-29 00:00 +13:45
          Date.parse('2025-02-27T10:15:00.000Z'), // 2025-02-28 00:00 +13:45
          Date.parse('2026-02-27T10:15:00.000Z'), // 2026-02-28 00:00 +13:45
        ]);
      });
    });
  });

  // Non-finite instants used to reach Intl.DateTimeFormat.formatToParts and
  // surface as a bare `RangeError: Invalid time value`. The invariant this
  // block exists to protect is that no bare RangeError ever escapes, and every
  // test below asserts it. What happens instead splits by input kind: an
  // Invalid *Date* is a real Date and degrades (collection yields nothing,
  // getNextOccurrence returns an invalid Date or a coded error), while
  // malformed *options* are rejected with a coded QuickurrenceError up front.
  describe('Invalid instants degrade instead of throwing RangeError', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const invalid = new Date('not-a-date');
    const daily = (extra: Partial<QuickurrenceOptions> = {}) =>
      new Quickurrence({ rule: 'daily', startDate, timezone: 'UTC', ...extra });
    const wideRange = {
      start: startDate,
      end: new Date('2026-01-31T00:00:00.000Z'),
    };

    it('returns [] when range.end is an Invalid Date', () => {
      expect(
        daily().getAllOccurrences({ start: startDate, end: invalid }),
      ).toEqual([]);
    });

    it('returns [] when range.start is an Invalid Date', () => {
      expect(
        daily().getAllOccurrences({
          start: invalid,
          end: new Date('2026-01-05T00:00:00.000Z'),
        }),
      ).toEqual([]);
    });

    it('returns [] when both range bounds are Invalid Dates', () => {
      expect(
        daily().getAllOccurrences({ start: invalid, end: invalid }),
      ).toEqual([]);
    });

    it('returns [] for an Invalid range.end under a non-UTC rule too', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new TZDate(2026, 0, 1, 'Europe/Warsaw'),
        timezone: 'Europe/Warsaw',
      });
      expect(
        rule.getAllOccurrences({ start: startDate, end: invalid }),
      ).toEqual([]);
    });

    it('does not throw a RangeError for an Invalid range.end', () => {
      expect(() =>
        daily().getAllOccurrences({ start: startDate, end: invalid }),
      ).not.toThrow();
    });

    // Malformed OPTIONS are a different case from an Invalid Date, and the two
    // are deliberately split: an Invalid Date is a legitimate `Date` and
    // degrades (above), while a weekday that is not a weekday is a broken rule
    // and is now rejected at construction with a code, instead of silently
    // producing nothing. Both halves still guarantee no bare RangeError.
    it('rejects non-numeric weekDays entries at construction', () => {
      expectCode(
        () =>
          new Quickurrence({
            rule: 'weekly',
            startDate,
            timezone: 'UTC',
            weekDays: ['Monday', 'Wednesday', 'Friday'] as unknown as WeekDay[],
          }),
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
    });

    it('rejects non-numeric weekDays before getNextOccurrence is reachable', () => {
      const build = () =>
        new Quickurrence({
          rule: 'weekly',
          startDate,
          timezone: 'UTC',
          weekDays: ['Monday', 'Wednesday', 'Friday'] as unknown as WeekDay[],
        });

      const error = expectCode(build, QuickurrenceErrorCode.INVALID_WEEKDAYS);
      expect(error.message).toBe(
        'Invalid weekDays values: Monday, Wednesday, Friday. Values must be between 0-6',
      );
      // The instance never exists, so the old END_DATE_EXCEEDED fallback that
      // stood in for "the engine produced nothing" is now unreachable.
      expect(error.code).not.toBe(QuickurrenceErrorCode.END_DATE_EXCEEDED);
    });

    it('rejects a NaN weekDays entry at construction', () => {
      expectCode(
        () =>
          new Quickurrence({
            rule: 'weekly',
            startDate,
            timezone: 'UTC',
            weekDays: [Number.NaN] as unknown as WeekDay[],
          }),
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
    });

    it('rejects non-numeric weekDays combined with timesOfDay at construction', () => {
      expectCode(
        () =>
          new Quickurrence({
            rule: 'weekly',
            startDate,
            timezone: 'UTC',
            weekDays: ['Monday'] as unknown as WeekDay[],
            timesOfDay: ['09:00'],
          }),
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
    });

    it('rejects a non-numeric nthWeekdayOfMonth.weekday at construction', () => {
      const error = expectCode(
        () =>
          new Quickurrence({
            rule: 'monthly',
            startDate,
            timezone: 'UTC',
            nthWeekdayOfMonth: { weekday: 'Mon' as unknown as WeekDay, nth: 1 },
          }),
        QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
      );
      expect(error.context?.option).toBe('nthWeekdayOfMonth.weekday');
    });

    it('rejects a non-numeric nthWeekdayOfMonth.weekday before getNextOccurrence is reachable', () => {
      const error = expectCode(
        () =>
          new Quickurrence({
            rule: 'monthly',
            startDate,
            timezone: 'UTC',
            nthWeekdayOfMonth: { weekday: 'Mon' as unknown as WeekDay, nth: 1 },
          }),
        QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
      );
      expect(error.message).toBe(
        'Invalid weekday in nthWeekdayOfMonth: Mon. Weekday must be between 0-6',
      );
      expect(error.code).not.toBe(QuickurrenceErrorCode.END_DATE_EXCEEDED);
    });

    it('returns an invalid Date for getNextOccurrence(Invalid Date)', () => {
      const next = daily().getNextOccurrence(invalid);
      expect(next).toBeInstanceOf(Date);
      expect(Number.isNaN(next.getTime())).toBe(true);
    });

    it('reports INVALID_EXCLUDE_DATES for an Invalid Date in excludeDates', () => {
      try {
        daily({ excludeDates: [invalid] }).getAllOccurrences({
          start: startDate,
          end: new Date('2026-01-04T00:00:00.000Z'),
        });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(QuickurrenceError);
        expect(err).not.toBeInstanceOf(RangeError);
        expect((err as QuickurrenceError).code).toBe(
          QuickurrenceErrorCode.INVALID_EXCLUDE_DATES,
        );
      }
    });
  });

  // `@date-fns/tz` no longer reaches the public surface: every returned value
  // and every Date inside an error's context is a plain `Date`. `instanceof
  // Date` is not enough to prove that — a TZDate subclasses Date and passes it
  // — so the constructor identity is compared instead.
  describe('Every public value is a plain Date', () => {
    const WARSAW = 'Europe/Warsaw';
    const startDate = new Date('2026-06-10T00:00:00.000Z');
    const before = new Date('2026-01-01T00:00:00.000Z');

    // The shapes below all used to return a TZDate from getNextOccurrence.
    const dayLevelShapes: Array<[string, QuickurrenceOptions]> = [
      ['daily', { rule: 'daily', startDate, timezone: 'UTC' }],
      ['daily under a non-UTC rule', { rule: 'daily', startDate, timezone: WARSAW }],
      ['weekly without weekDays', { rule: 'weekly', startDate, timezone: 'UTC' }],
      [
        'weekly without weekDays under a non-UTC rule',
        { rule: 'weekly', startDate, timezone: WARSAW },
      ],
      ['monthly without monthDay', { rule: 'monthly', startDate, timezone: 'UTC' }],
      [
        'monthly without monthDay under a non-UTC rule',
        { rule: 'monthly', startDate, timezone: WARSAW },
      ],
      ['yearly', { rule: 'yearly', startDate, timezone: 'UTC' }],
      ['yearly under a non-UTC rule', { rule: 'yearly', startDate, timezone: WARSAW }],
    ];

    for (const [label, options] of dayLevelShapes) {
      it(`returns a plain Date from getNextOccurrence for ${label}`, () => {
        const next = new Quickurrence(options).getNextOccurrence(before);
        expect(next.constructor).toBe(Date);
        expect(next.toISOString().endsWith('Z')).toBe(true);
      });
    }

    // `after` before the rule's startDate short-circuits to the start date (or
    // to the first matching day in its month), a separate return path per shape.
    describe('the after-before-startDate early return', () => {
      const futureStart = new Date('2030-06-10T00:00:00.000Z');
      const wayBefore = new Date('2029-01-01T00:00:00.000Z');
      const earlyReturnShapes: Array<[string, QuickurrenceOptions]> = [
        ['daily', { rule: 'daily', startDate: futureStart, timezone: 'UTC' }],
        [
          'daily under a non-UTC rule',
          { rule: 'daily', startDate: futureStart, timezone: WARSAW },
        ],
        [
          'weekly with weekDays',
          { rule: 'weekly', startDate: futureStart, timezone: 'UTC', weekDays: [1, 3] },
        ],
        [
          'weekly with weekDays under a non-UTC rule',
          { rule: 'weekly', startDate: futureStart, timezone: WARSAW, weekDays: [1, 3] },
        ],
        [
          'monthly with monthDay',
          { rule: 'monthly', startDate: futureStart, timezone: 'UTC', monthDay: 15 },
        ],
        [
          'monthly with monthDay under a non-UTC rule',
          { rule: 'monthly', startDate: futureStart, timezone: WARSAW, monthDay: 15 },
        ],
        [
          'monthly with nthWeekdayOfMonth',
          {
            rule: 'monthly',
            startDate: futureStart,
            timezone: 'UTC',
            nthWeekdayOfMonth: { weekday: 1, nth: 2 },
          },
        ],
        [
          'monthly with nthWeekdayOfMonth under a non-UTC rule',
          {
            rule: 'monthly',
            startDate: futureStart,
            timezone: WARSAW,
            nthWeekdayOfMonth: { weekday: 1, nth: 2 },
          },
        ],
        ['yearly', { rule: 'yearly', startDate: futureStart, timezone: 'UTC' }],
        [
          'yearly under a non-UTC rule',
          { rule: 'yearly', startDate: futureStart, timezone: WARSAW },
        ],
      ];

      for (const [label, options] of earlyReturnShapes) {
        it(`returns a plain Date for ${label}`, () => {
          const next = new Quickurrence(options).getNextOccurrence(wayBefore);
          expect(next.constructor).toBe(Date);
          expect(next.toISOString().endsWith('Z')).toBe(true);
        });
      }
    });

    it('returns plain Dates from getAllOccurrences under a non-UTC rule', () => {
      const occurrences = new Quickurrence({
        rule: 'daily',
        startDate,
        timezone: WARSAW,
      }).getAllOccurrences({
        start: startDate,
        end: new Date('2026-06-14T00:00:00.000Z'),
      });

      expect(occurrences.length).toBeGreaterThan(0);
      occurrences.forEach((occurrence) => {
        expect(occurrence.constructor).toBe(Date);
        expect(occurrence.toISOString().endsWith('Z')).toBe(true);
      });
    });

    it('serializes a non-UTC rule occurrence with a trailing Z', () => {
      // 2026-06-11 00:00 CEST is 2026-06-10T22:00Z: the offset must show up in
      // the epoch, never in the rendered suffix.
      const next = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-06-10T22:00:00.000Z'),
        timezone: WARSAW,
      }).getNextOccurrence(new Date('2026-06-10T22:00:00.000Z'));

      expect(next.toISOString()).toBe('2026-06-11T22:00:00.000Z');
    });

    it('carries a plain Date in the day-level end-date guard details', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate,
        timezone: WARSAW,
        endDate: new Date('2026-06-20T00:00:00.000Z'),
      });

      try {
        rule.getNextOccurrence(new Date('2026-07-01T00:00:00.000Z'));
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(QuickurrenceError);
        expect((error as QuickurrenceError).code).toBe(
          QuickurrenceErrorCode.END_DATE_EXCEEDED,
        );
        const details = (error as QuickurrenceError).context?.details as {
          endDate: Date;
          currentDate: Date;
        };
        expect(details.currentDate.constructor).toBe(Date);
        expect(details.endDate.constructor).toBe(Date);
        expect(JSON.stringify(details.currentDate)).toMatch(/Z"$/);
        expect(JSON.stringify(details.endDate)).toMatch(/Z"$/);
      }
    });
  });

  // The predicate's second argument always describes the RULE timezone, so a
  // condition written against it must select the same instants on every host.
  // Expectations are exact epochs and the weekday is derived from
  // Intl.DateTimeFormat with an explicit timeZone, never read back from the
  // library.
  describe('condition contract is host-independent', () => {
    const CHATHAM = 'Pacific/Chatham';
    const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const zoneWeekday = (date: Date, timeZone: string) =>
      WEEKDAY_NAMES.indexOf(
        new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(
          date,
        ),
      );

    // Chatham runs at +13:45 through March 2026, so its midnight is the
    // previous UTC day at 10:15Z. 2026-03-20 is a Friday there.
    const chathamMidnight = (utcDay: string) =>
      new Date(`${utcDay}T10:15:00.000Z`);

    it('selects the rule zone business days regardless of host', () => {
      const seenWeekdays: number[] = [];
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: chathamMidnight('2026-03-19'),
        timezone: CHATHAM,
        condition: (date, parts) => {
          expect(parts.weekday).toBe(zoneWeekday(date, CHATHAM));
          seenWeekdays.push(parts.weekday);
          return parts.weekday !== 0 && parts.weekday !== 6;
        },
      });

      const occurrences = rule.getAllOccurrences({
        start: chathamMidnight('2026-03-19'),
        end: chathamMidnight('2026-03-27'),
      });

      expect(occurrences.map((occurrence) => occurrence.getTime())).toEqual([
        Date.parse('2026-03-19T10:15:00.000Z'), // Fri 2026-03-20 +13:45
        Date.parse('2026-03-22T10:15:00.000Z'), // Mon 2026-03-23
        Date.parse('2026-03-23T10:15:00.000Z'), // Tue 2026-03-24
        Date.parse('2026-03-24T10:15:00.000Z'), // Wed 2026-03-25
        Date.parse('2026-03-25T10:15:00.000Z'), // Thu 2026-03-26
        Date.parse('2026-03-26T10:15:00.000Z'), // Fri 2026-03-27
      ]);
      expect(seenWeekdays).toContain(0);
      expect(seenWeekdays).toContain(6);
    });

    it('skips rule-zone weekends in getNextOccurrence regardless of host', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: chathamMidnight('2026-03-19'),
        timezone: CHATHAM,
        condition: (_date, parts) => parts.weekday !== 0 && parts.weekday !== 6,
      });

      // After Chatham Friday 2026-03-20 the next weekday is Monday 2026-03-23.
      expect(
        rule.getNextOccurrence(chathamMidnight('2026-03-19')).getTime(),
      ).toBe(Date.parse('2026-03-22T10:15:00.000Z'));
    });

    it('still honours a one-argument condition', () => {
      let calls = 0;
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        timezone: 'UTC',
        condition: (date) => {
          calls++;
          return date.getTime() !== Date.parse('2026-01-02T00:00:00.000Z');
        },
      });

      const occurrences = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-01-03T00:00:00.000Z'),
      });

      expect(calls).toBeGreaterThan(0);
      expect(occurrences.map((occurrence) => occurrence.getTime())).toEqual([
        Date.parse('2026-01-01T00:00:00.000Z'),
        Date.parse('2026-01-03T00:00:00.000Z'),
      ]);
    });

    it('exports ZonedParts as a usable type from the package entry point', () => {
      const captured: ZonedParts[] = [];
      const collect = (_date: Date, parts: ZonedParts) => {
        captured.push(parts);
        return true;
      };
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        timezone: 'UTC',
        condition: collect,
      });

      rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-01-01T00:00:00.000Z'),
      });

      expect(captured[0]).toEqual({
        year: 2026,
        month: 0,
        day: 1,
        weekday: 4,
        hour: 0,
        minute: 0,
        second: 0,
        ms: 0,
      });
    });
  });
});

describe('exported zod schemas', () => {
  // Not exported, but reachable through the options schema, which is the only
  // way a consumer can hit it.
  const NthWeekdayConfigSchema =
    QuickurrenceOptionsSchema.shape.nthWeekdayOfMonth.unwrap();

  const allWeekdays = [0, 1, 2, 3, 4, 5, 6] as const;
  const allMonthDays = Array.from({ length: 31 }, (_, index) => index + 1);

  const schemaCases: readonly {
    name: string;
    schema: { safeParse: (value: unknown) => { success: boolean } };
    valid: readonly unknown[];
    invalid: readonly unknown[];
  }[] = [
    {
      name: 'RecurrenceRuleSchema',
      schema: RecurrenceRuleSchema,
      valid: ['daily', 'weekly', 'monthly', 'yearly'],
      invalid: ['hourly', 'Daily', '', 1, null, undefined],
    },
    {
      name: 'DateRangeSchema',
      schema: DateRangeSchema,
      valid: [
        { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-02-01T00:00:00.000Z') },
      ],
      invalid: [
        { start: '2026-01-01', end: '2026-02-01' },
        { start: new Date('2026-01-01T00:00:00.000Z') },
        { start: new Date('nonsense'), end: new Date('2026-02-01T00:00:00.000Z') },
        'not-a-range',
        null,
      ],
    },
    {
      name: 'WeekStartsOnSchema',
      schema: WeekStartsOnSchema,
      valid: allWeekdays,
      invalid: [-1, 7, 99, 1.5, '1', 'nope', null, true, {}],
    },
    {
      name: 'WeekDaySchema',
      schema: WeekDaySchema,
      valid: allWeekdays,
      invalid: [-1, 7, 99, 1.5, '1', 'nope', null, true, []],
    },
    {
      name: 'MonthDaySchema',
      schema: MonthDaySchema,
      valid: allMonthDays,
      invalid: [0, -1, 32, 99, 15.5, '15', 'last', null, {}],
    },
    {
      name: 'NthWeekdayOfMonthSchema',
      schema: NthWeekdayOfMonthSchema,
      valid: [1, 2, 3, 4, 'last'],
      invalid: [0, -1, 5, 99, 2.5, '1', 'first', 'Last', null, {}],
    },
    {
      name: 'NthWeekdayConfigSchema',
      schema: NthWeekdayConfigSchema,
      valid: [
        { weekday: 0, nth: 1 },
        { weekday: 6, nth: 'last' },
        { weekday: 3, nth: 4 },
      ],
      invalid: [
        { weekday: 7, nth: 1 },
        { weekday: -1, nth: 1 },
        { weekday: 1, nth: 5 },
        { weekday: 1, nth: 'first' },
        { weekday: 1 },
        { nth: 1 },
        {},
        'monday',
        null,
      ],
    },
    {
      name: 'CountSchema',
      schema: CountSchema,
      valid: [1, 2, 1000],
      invalid: [0, -1, 1.5, '5', null, Number.NaN],
    },
    {
      name: 'IntervalSchema',
      schema: IntervalSchema,
      valid: [1, 3, 52],
      invalid: [0, -2, 2.5, '2', null, Number.NaN],
    },
    {
      name: 'TimeOfDaySchema',
      schema: TimeOfDaySchema,
      valid: ['00:00', '09:30', '23:59'],
      invalid: ['24:00', '09:60', '9:30', '0930', '', '09:30:00', 930, null],
    },
    {
      name: 'TimesOfDaySchema',
      schema: TimesOfDaySchema,
      valid: [['09:00'], ['00:00', '12:30', '23:59']],
      invalid: [[], ['9:00'], ['09:00', '24:00'], '09:00', null],
    },
    {
      name: 'QuickurrenceOptionsSchema',
      schema: QuickurrenceOptionsSchema,
      valid: [
        {},
        {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          rule: 'weekly',
          timezone: 'Europe/Warsaw',
          interval: 2,
          count: 10,
          weekStartsOn: 1,
          weekDays: [1, 3, 5],
          excludeDates: [new Date('2026-03-01T00:00:00.000Z')],
          condition: true,
          timesOfDay: ['09:00', '17:30'],
        },
        { rule: 'monthly', monthDay: 31, monthDayMode: 'last' },
        { rule: 'monthly', nthWeekdayOfMonth: { weekday: 1, nth: 'last' } },
        { condition: () => true },
      ],
      invalid: [
        { rule: 'hourly' },
        { startDate: '2026-01-01' },
        { interval: 0 },
        { count: 0 },
        { monthDayMode: 'first' },
        { preset: 'holidays' },
        { timesOfDay: [] },
        { condition: 'always' },
      ],
    },
  ];

  schemaCases.forEach(({ name, schema, valid, invalid }) => {
    describe(name, () => {
      it.each(valid.map((value) => [value]))('accepts %o', (value) => {
        expect(schema.safeParse(value).success).toBe(true);
      });

      it.each(invalid.map((value) => [value]))('rejects %o', (value) => {
        expect(schema.safeParse(value).success).toBe(false);
      });
    });
  });

  describe('QuickurrenceOptionsSchema nested validation', () => {
    it('rejects an out-of-range weekDays entry', () => {
      expect(
        QuickurrenceOptionsSchema.safeParse({ rule: 'weekly', weekDays: [99] })
          .success,
      ).toBe(false);
    });

    it('rejects a wrongly typed weekDays entry', () => {
      expect(
        QuickurrenceOptionsSchema.safeParse({
          rule: 'weekly',
          weekDays: ['monday'],
        }).success,
      ).toBe(false);
    });

    it('rejects an out-of-range monthDay', () => {
      expect(
        QuickurrenceOptionsSchema.safeParse({ rule: 'monthly', monthDay: 32 })
          .success,
      ).toBe(false);
    });

    it('rejects a bad nthWeekdayOfMonth weekday', () => {
      expect(
        QuickurrenceOptionsSchema.safeParse({
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 9, nth: 1 },
        }).success,
      ).toBe(false);
    });

    it('rejects a bad nthWeekdayOfMonth nth', () => {
      expect(
        QuickurrenceOptionsSchema.safeParse({
          rule: 'monthly',
          nthWeekdayOfMonth: { weekday: 1, nth: 5 },
        }).success,
      ).toBe(false);
    });

    it('reports the offending nested path', () => {
      const result = QuickurrenceOptionsSchema.safeParse({
        rule: 'weekly',
        weekDays: [1, 99],
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['weekDays', 1]);
    });
  });

  describe('Quickurrence.update schema rejection', () => {
    const baseOptions: QuickurrenceOptions = {
      rule: 'weekly',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      timezone: 'UTC',
      weekDays: [1],
    };

    it('throws a coded QuickurrenceError for an illegal weekDays value', () => {
      let thrown: unknown;
      try {
        Quickurrence.update(baseOptions, {
          weekDays: [99 as unknown as WeekDay],
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(QuickurrenceError);
      expect((thrown as QuickurrenceError).code).toBe(
        QuickurrenceErrorCode.INVALID_WEEKDAYS,
      );
      expect((thrown as QuickurrenceError).context?.option).toBe('weekDays');
      expect(
        (thrown as QuickurrenceError).context?.details?.issues,
      ).toBeDefined();
    });

    it('throws INVALID_MONTH_DAY for an illegal monthDay', () => {
      expect(() =>
        Quickurrence.update(
          { ...baseOptions, rule: 'monthly', weekDays: undefined },
          { monthDay: 32 as unknown as MonthDay },
        ),
      ).toThrowError(
        expect.objectContaining({
          name: 'QuickurrenceError',
          code: QuickurrenceErrorCode.INVALID_MONTH_DAY,
        }),
      );
    });

    it('throws INVALID_NTH_WEEKDAY for an illegal nthWeekdayOfMonth', () => {
      expect(() =>
        Quickurrence.update(
          { ...baseOptions, rule: 'monthly', weekDays: undefined },
          {
            nthWeekdayOfMonth: { weekday: 1, nth: 9 } as unknown as {
              weekday: WeekDay;
              nth: 1;
            },
          },
        ),
      ).toThrowError(
        expect.objectContaining({
          code: QuickurrenceErrorCode.INVALID_NTH_WEEKDAY,
        }),
      );
    });

    it('does not write to the console when rejecting', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        Quickurrence.update(baseOptions, {
          weekDays: [99 as unknown as WeekDay],
        }),
      ).toThrow(QuickurrenceError);
      expect(consoleError).not.toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});

// Regression coverage for the defects reconciled in the 0.4.0 validation work.
// Each block below pins behaviour that was measurably wrong before it.
describe('0.4.0 regressions', () => {
  const START = new Date('2026-01-01T00:00:00.000Z');
  const base: QuickurrenceOptions = {
    rule: 'daily',
    startDate: START,
    timezone: 'UTC',
  };
  // START is a UTC midnight and every rule below is a UTC rule, so whole-day ms
  // arithmetic lands on a UTC midnight exactly.
  const windowOf = (days: number) => ({
    start: START,
    end: new Date(START.getTime() + days * 86_400_000),
  });
  const wideRange = windowOf(1050);

  describe('an unknown preset is rejected identically from every entry point', () => {
    const badPreset = 'mystery' as unknown as 'businessDays';

    const entryPoints: readonly [string, () => unknown][] = [
      ['new Quickurrence', () => new Quickurrence({ ...base, preset: badPreset })],
      ['Quickurrence.update', () => Quickurrence.update(base, { preset: badPreset })],
      [
        'Quickurrence.toHumanText',
        () => Quickurrence.toHumanText({ ...base, preset: badPreset }),
      ],
    ];

    entryPoints.forEach(([name, call]) => {
      it(`throws UNSUPPORTED_PRESET from ${name}`, () => {
        const error = expectCode(call, QuickurrenceErrorCode.UNSUPPORTED_PRESET);
        expect(error.message).toBe('Unsupported preset: mystery');
        expect(error.context?.option).toBe('preset');
        expect(error.context?.value).toBe('mystery');
      });
    });

    it('agrees with the validator on the same preset', () => {
      const error = expectCode(
        () =>
          QuickurrenceValidator.validateOptions({
            ...base,
            preset: badPreset,
          }),
        QuickurrenceErrorCode.UNSUPPORTED_PRESET,
      );
      expect(error.message).toBe('Unsupported preset: mystery');
    });
  });

  describe('update() round-trips the options it is given', () => {
    it('preserves weekStartsOn, which used to be dropped', () => {
      const updated = Quickurrence.update(base, {
        weekStartsOn: 3 as unknown as 0,
      });

      expect(updated?.weekStartsOn).toBe(3);
    });

    it('preserves every legal weekStartsOn value', () => {
      const legalValues = [0, 1, 2, 3, 4, 5, 6] as const;

      legalValues.forEach((weekStartsOn) => {
        expect(
          Quickurrence.update(base, { weekStartsOn })?.weekStartsOn,
        ).toBe(weekStartsOn);
      });
    });

    it('preserves monthDayMode without an accompanying monthDay', () => {
      const updated = Quickurrence.update(
        { ...base, rule: 'monthly' },
        { monthDayMode: 'skip' },
      );

      expect(updated?.monthDayMode).toBe('skip');
      expect(updated?.monthDay).toBeUndefined();
    });

    it('preserves monthDayMode alongside a monthDay', () => {
      const updated = Quickurrence.update(
        { ...base, rule: 'monthly' },
        { monthDay: 15, monthDayMode: 'skip' },
      );

      expect(updated?.monthDay).toBe(15);
      expect(updated?.monthDayMode).toBe('skip');
    });

    // Not a loss: clean() strips the default so the produced options stay
    // minimal, and interval 1 is what an absent interval already means.
    it('still drops interval 1 as clean()\'s default removal', () => {
      const updated = Quickurrence.update({ ...base, interval: 2 }, { interval: 1 });

      expect(updated).not.toBeNull();
      expect(updated?.interval).toBeUndefined();
    });

    it('keeps a non-default interval', () => {
      expect(Quickurrence.update(base, { interval: 4 })?.interval).toBe(4);
    });

    it('rejects an illegal weekStartsOn, which used to be unreachable here', () => {
      const error = expectCode(
        () => Quickurrence.update(base, { weekStartsOn: 9 as unknown as 0 }),
        QuickurrenceErrorCode.INVALID_WEEK_STARTS_ON,
      );
      expect(error.context?.option).toBe('weekStartsOn');
    });
  });

  describe('the occurrence cap is exactly 1000', () => {
    // `days` is the smallest window that overruns the cap for that shape, with
    // a little slack: a day-level rule needs 1000 days, an N-slot timesOfDay
    // rule 1000/N, and weekly-on-5-weekdays 1000/5*7 = 1400. Sized per shape
    // because a single wide window would make each run collect its own 1000-day
    // internal maximum whether the shape needs it or not.
    const cappedShapes: readonly [string, number, QuickurrenceOptions][] = [
      ['a day-level rule', 1050, base],
      [
        'a rule with one timesOfDay slot',
        1050,
        { ...base, timesOfDay: ['09:00'] },
      ],
      [
        'a rule with two timesOfDay slots',
        550,
        { ...base, timesOfDay: ['09:00', '18:00'] },
      ],
      [
        'a rule with three timesOfDay slots',
        400,
        { ...base, timesOfDay: ['09:00', '12:30', '18:00'] },
      ],
      [
        'a weekly rule with weekDays',
        1450,
        { rule: 'weekly', startDate: START, timezone: 'UTC', weekDays: [1, 2, 3, 4, 5] },
      ],
    ];

    // Generating a full 1000 occurrences is by design the heaviest work in the
    // suite, and the TZ sweep runs several zones concurrently on one machine,
    // so the default 5s per-test budget is raised rather than the assertion
    // weakened.
    const CAP_TEST_TIMEOUT_MS = 30_000;

    cappedShapes.forEach(([label, days, options]) => {
      it(
        `returns exactly 1000 occurrences for ${label}`,
        () => {
          expect(
            new Quickurrence(options).getAllOccurrences(windowOf(days)),
          ).toHaveLength(1000);
        },
        CAP_TEST_TIMEOUT_MS,
      );
    });

    it('honours a small count exactly', () => {
      expect(
        new Quickurrence({ ...base, count: 5 }).getAllOccurrences(wideRange),
      ).toHaveLength(5);
    });

    it('honours a small count exactly with timesOfDay', () => {
      expect(
        new Quickurrence({
          ...base,
          count: 5,
          timesOfDay: ['09:00', '18:00'],
        }).getAllOccurrences(wideRange),
      ).toHaveLength(5);
    });

    it(
      'does not let a count above the cap raise it',
      () => {
        expect(
          new Quickurrence({ ...base, count: 5000 }).getAllOccurrences(wideRange),
        ).toHaveLength(1000);
      },
      CAP_TEST_TIMEOUT_MS,
    );
  });

  describe('non-Date input is a coded error, not a bare TypeError', () => {
    const rule = () => new Quickurrence(base);
    const asDate = (value: string) => value as unknown as Date;

    it('rejects a string range from getAllOccurrences', () => {
      const error = expectCode(
        () =>
          rule().getAllOccurrences({
            start: asDate('2026-01-01'),
            end: asDate('2026-02-01'),
          }),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('range.start');
      expect(error.context?.operation).toBe('getAllOccurrences');
    });

    it('rejects a non-Date range.start', () => {
      const error = expectCode(
        () =>
          rule().getAllOccurrences({
            start: asDate('2026-01-01'),
            end: new Date('2026-02-01T00:00:00.000Z'),
          }),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('range.start');
    });

    it('rejects a non-Date range.end', () => {
      const error = expectCode(
        () =>
          rule().getAllOccurrences({
            start: new Date('2026-01-01T00:00:00.000Z'),
            end: asDate('2026-02-01'),
          }),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('range.end');
    });

    it('rejects a non-object range', () => {
      const error = expectCode(
        () => rule().getAllOccurrences(null as unknown as { start: Date; end: Date }),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('range');
    });

    it('rejects a string argument to getNextOccurrence', () => {
      const error = expectCode(
        () => rule().getNextOccurrence(asDate('2026-01-01')),
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );
      expect(error.context?.option).toBe('after');
    });

    it('rejects a string startDate in the constructor', () => {
      const error = expectCode(
        () => new Quickurrence({ ...base, startDate: asDate('2026-01-01') }),
        QuickurrenceErrorCode.INVALID_START_DATE,
      );
      expect(error.context?.operation).toBe('constructor');
    });

    // The whole point of the distinction: a real Date whose time is NaN is a
    // valid argument with no occurrences, not a type error.
    it('still degrades to [] for a genuine Invalid Date', () => {
      expect(
        rule().getAllOccurrences({ start: START, end: new Date('not-a-date') }),
      ).toEqual([]);
    });

    it('still returns an Invalid Date from getNextOccurrence(Invalid Date)', () => {
      const next = rule().getNextOccurrence(new Date('not-a-date'));

      expect(next.constructor).toBe(Date);
      expect(Number.isNaN(next.getTime())).toBe(true);
    });
  });

  describe('a consumer condition is never invoked during validation', () => {
    const buildCounter = () => {
      let calls = 0;
      const condition = () => {
        calls++;
        return true;
      };
      return { condition, callCount: () => calls };
    };

    const validationOnlyPaths: readonly [string, (condition: () => boolean) => unknown][] = [
      ['new Quickurrence', (condition) => new Quickurrence({ ...base, condition })],
      ['Quickurrence.update', (condition) => Quickurrence.update(base, { condition })],
      [
        'QuickurrenceOptionsSchema.safeParse',
        (condition) => QuickurrenceOptionsSchema.safeParse({ ...base, condition }),
      ],
      ['Quickurrence.clean', (condition) => Quickurrence.clean({ ...base, condition })],
      [
        'QuickurrenceValidator.validateOptions',
        (condition) =>
          QuickurrenceValidator.validateOptions({ ...base, condition }),
      ],
    ];

    validationOnlyPaths.forEach(([name, run]) => {
      it(`does not call the predicate from ${name}`, () => {
        const { condition, callCount } = buildCounter();

        run(condition);

        expect(callCount()).toBe(0);
      });
    });

    it('calls the predicate only once generation runs', () => {
      const { condition, callCount } = buildCounter();
      const rule = new Quickurrence({ ...base, condition });

      expect(callCount()).toBe(0);

      const occurrences = rule.getAllOccurrences({
        start: START,
        end: new Date('2026-01-05T00:00:00.000Z'),
      });

      expect(occurrences).toHaveLength(5);
      expect(callCount()).toBe(5);
    });

    // The regression the removal fixed: smoke-testing the predicate on a
    // fabricated date sank rules whose predicate is only defined over the data
    // it actually knows about.
    it('accepts a predicate with a bounded domain at construction', () => {
      const knownYearsOnly = (_date: Date, parts: ZonedParts) => {
        if (parts.year !== 2026) {
          throw new Error(`no data for ${parts.year}`);
        }
        return parts.day % 2 === 1;
      };

      const rule = new Quickurrence({ ...base, condition: knownYearsOnly });

      expect(
        rule
          .getAllOccurrences({
            start: START,
            end: new Date('2026-01-05T00:00:00.000Z'),
          })
          .map((occurrence) => occurrence.getTime()),
      ).toEqual([
        Date.parse('2026-01-01T00:00:00.000Z'),
        Date.parse('2026-01-03T00:00:00.000Z'),
        Date.parse('2026-01-05T00:00:00.000Z'),
      ]);
    });
  });

  describe('the schema and the validator agree', () => {
    type LayerVerdicts = {
      schema: boolean;
      validator: boolean;
      constructor: boolean;
      update: boolean;
    };

    const accepts = (call: () => unknown) => caughtError(call) === undefined;

    const verdicts = (options: QuickurrenceOptions): LayerVerdicts => ({
      schema: QuickurrenceOptionsSchema.safeParse(options).success,
      validator: accepts(() => QuickurrenceValidator.validateOptions(options)),
      constructor: accepts(() => new Quickurrence(options)),
      update: accepts(() =>
        Quickurrence.update(
          { rule: options.rule, startDate: START, timezone: 'UTC' },
          options,
        ),
      ),
    });

    const allReject: LayerVerdicts = {
      schema: false,
      validator: false,
      constructor: false,
      update: false,
    };

    // Inputs where the two layers used to disagree. Every layer must now return
    // the same verdict for each.
    const agreedRejections: readonly [string, QuickurrenceOptions][] = [
      ['a fractional weekDays entry', { rule: 'weekly', startDate: START, weekDays: [3.5] as unknown as WeekDay[] }],
      ['an out-of-range weekDays entry', { rule: 'weekly', startDate: START, weekDays: [7] as unknown as WeekDay[] }],
      ['a string weekDays entry', { rule: 'weekly', startDate: START, weekDays: ['1'] as unknown as WeekDay[] }],
      ['duplicate weekDays entries', { rule: 'weekly', startDate: START, weekDays: [1, 1] }],
      [
        'a string nthWeekdayOfMonth.weekday',
        {
          rule: 'monthly',
          startDate: START,
          nthWeekdayOfMonth: { weekday: 'Mon' as unknown as WeekDay, nth: 1 },
        },
      ],
      ['monthDay 0', { rule: 'monthly', startDate: START, monthDay: 0 as unknown as MonthDay }],
      ['monthDay 32', { rule: 'monthly', startDate: START, monthDay: 32 as unknown as MonthDay }],
    ];

    agreedRejections.forEach(([label, options]) => {
      it(`rejects ${label} from all four layers`, () => {
        expect(verdicts(options)).toEqual(allReject);
      });
    });

    it('accepts the legal counterparts from all four layers', () => {
      const legal: readonly QuickurrenceOptions[] = [
        { rule: 'weekly', startDate: START, weekDays: [0, 6] },
        { rule: 'monthly', startDate: START, monthDay: 1 },
        { rule: 'monthly', startDate: START, monthDay: 31 },
        {
          rule: 'monthly',
          startDate: START,
          nthWeekdayOfMonth: { weekday: 1, nth: 'last' },
        },
      ];

      legal.forEach((options) => {
        expect(verdicts(options)).toEqual({
          schema: true,
          validator: true,
          constructor: true,
          update: true,
        });
      });
    });

    describe('deliberate disagreements', () => {
      // Neither the schema nor the validator performs an Intl timezone lookup:
      // doing so would make a pure shape check depend on the host's ICU data.
      // Only the constructor (and update(), which must normalize a start date
      // in the zone) resolves the identifier, so only they can reject it.
      it('pins that only the resolving layers reject an unknown timezone', () => {
        const options: QuickurrenceOptions = {
          rule: 'daily',
          startDate: START,
          timezone: 'Not/AZone',
        };

        expect(verdicts(options)).toEqual({
          schema: true,
          validator: true,
          constructor: false,
          update: false,
        });
        expectCode(
          () => new Quickurrence(options),
          QuickurrenceErrorCode.INVALID_TIMEZONE,
        );
      });

      // An empty timezone is mapped to UTC before validation runs, so the two
      // entry points accept it. The validator sees the raw '' and rejects it —
      // it is never handed a '' by either entry point.
      it('pins that an empty timezone is mapped to UTC before validation', () => {
        const options: QuickurrenceOptions = {
          rule: 'daily',
          startDate: START,
          timezone: '',
        };

        expect(verdicts(options)).toEqual({
          schema: true,
          validator: false,
          constructor: true,
          update: true,
        });
        expect(new Quickurrence(options).getOptions().timezone).toBe('UTC');
        expect(Quickurrence.update(options, {})?.timezone).toBe('UTC');
      });

      // The schema validates fields independently, so it cannot see a
      // cross-field conflict. update() never reaches one either, because
      // clean() resolves the conflict (it drops endDate in favour of count)
      // before the schema runs.
      it('pins that only the validator and constructor catch count + endDate', () => {
        const options: QuickurrenceOptions = {
          rule: 'daily',
          startDate: START,
          count: 3,
          endDate: new Date('2027-01-01T00:00:00.000Z'),
        };

        expect(verdicts(options)).toEqual({
          schema: true,
          validator: false,
          constructor: false,
          update: true,
        });
        expect(Quickurrence.update(options, {})?.endDate).toBeUndefined();
        expectCode(
          () => new Quickurrence(options),
          QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        );
      });

      // clean() deletes an empty weekDays array before update()'s schema can
      // see it, so update() accepts an input the other three reject.
      it('pins that clean() drops an empty weekDays before update()\'s schema', () => {
        const options: QuickurrenceOptions = {
          rule: 'weekly',
          startDate: START,
          weekDays: [],
        };

        expect(verdicts(options)).toEqual({
          schema: false,
          validator: false,
          constructor: false,
          update: true,
        });
        expect(Quickurrence.clean(options).weekDays).toBeUndefined();
        expect(Quickurrence.update(options, {})?.weekDays).toBeUndefined();
      });
    });
  });

  // The entry point's runtime exports are the package's public surface: adding
  // a name here is a semver-relevant public-API decision, not a refactor. An
  // internal helper and five internal constants leaked out during the 0.4.0
  // migration and only a manual diff caught it, so the set is pinned exactly.
  describe('public export surface', () => {
    const PUBLIC_RUNTIME_EXPORTS = [
      'CountSchema',
      'DateRangeSchema',
      'IntervalSchema',
      'MonthDaySchema',
      'NthWeekdayOfMonthSchema',
      'Quickurrence',
      'QuickurrenceError',
      'QuickurrenceErrorCode',
      'QuickurrenceErrorType',
      'QuickurrenceMerge',
      'QuickurrenceOptionsSchema',
      'QuickurrenceValidator',
      'RecurrenceRuleSchema',
      'TimeOfDaySchema',
      'TimesOfDaySchema',
      'WeekDaySchema',
      'WeekStartsOnSchema',
      'recurrenceRulesOptions',
    ] as const;

    it('exports exactly the pinned set of runtime names', () => {
      expect(Object.keys(publicApi).sort()).toEqual([...PUBLIC_RUNTIME_EXPORTS]);
    });

    it('leaks no internal option constants or helpers', () => {
      const internals = [
        'dayOptions',
        'monthDayOptions',
        'monthDayModeOptions',
        'nthWeekdayOfMonthOptions',
        'presetOptions',
        'isOneOf',
        'MAX_NEXT_OCCURENCES',
      ];

      internals.forEach((name) => {
        expect(Object.keys(publicApi)).not.toContain(name);
      });
    });
  });
});
