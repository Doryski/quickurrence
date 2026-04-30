import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { Quickurrence, QuickurrenceError, QuickurrenceErrorCode } from './index';

const fmtUTC = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm", { in: tz('UTC') });
const fmtTZ = (d: Date, t: string) => format(d, "yyyy-MM-dd'T'HH:mm", { in: tz(t) });

describe('timesOfDay', () => {
  describe('basic generation', () => {
    it('expands a daily rule with two times into datetimes', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
      });

      const range = {
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-03T23:59:59Z'),
      };
      const out = rule.getAllOccurrences(range);
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-01T09:00',
        '2026-01-01T14:30',
        '2026-01-02T09:00',
        '2026-01-02T14:30',
        '2026-01-03T09:00',
        '2026-01-03T14:30',
      ]);
    });

    it('sorts timesOfDay input ascending', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['14:30', '09:00'],
      });
      expect(rule.getTimesOfDay()).toEqual(['09:00', '14:30']);
    });

    it('counts each datetime as one occurrence under count', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
        count: 5,
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-31T23:59:59Z'),
      });
      expect(out).toHaveLength(5);
      expect(fmtUTC(out[4])).toBe('2026-01-03T09:00');
    });
  });

  describe('weekly with weekDays + timesOfDay', () => {
    it('expands two weekdays into four datetimes per week', () => {
      const rule = new Quickurrence({
        rule: 'weekly',
        startDate: new Date('2026-01-05T00:00:00Z'), // Mon
        timezone: 'UTC',
        weekDays: [1, 3], // Mon, Wed
        timesOfDay: ['09:00', '17:00'],
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-05T00:00:00Z'),
        end: new Date('2026-01-11T23:59:59Z'),
      });
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-05T09:00',
        '2026-01-05T17:00',
        '2026-01-07T09:00',
        '2026-01-07T17:00',
      ]);
    });
  });

  describe('getNextOccurrence', () => {
    it('returns the next datetime after a given timestamp', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T10:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-01-01T14:30');
    });

    it('crosses day boundary correctly', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T15:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-01-02T09:00');
    });

    it('throws END_DATE_EXCEEDED when after exhausts available datetimes', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-02T10:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2026-01-05T00:00:00Z')),
      ).toThrowError(/end date|END_DATE_EXCEEDED/i);
    });

    it('uses startDate as window reference when after < startDate', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-06-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T00:00:00Z'));
      expect(next.getTime()).toBe(new Date('2026-06-01T09:00:00Z').getTime());
    });

    it('throws COUNT_LIMIT_EXCEEDED when exhausted', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
        count: 2,
      });
      expect(() =>
        rule.getNextOccurrence(new Date('2026-01-01T15:00:00Z')),
      ).toThrowError(/count limit|COUNT_LIMIT_EXCEEDED/i);
    });
  });

  describe('range filtering', () => {
    it('excludes datetimes before range.start', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-01T10:00:00Z'),
        end: new Date('2026-01-02T10:00:00Z'),
      });
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-01T14:30',
        '2026-01-02T09:00',
      ]);
    });
  });

  describe('endDate', () => {
    it('treats endDate as exact upper bound when timesOfDay is set', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
        endDate: new Date('2026-01-02T10:00:00Z'),
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-31T23:59:59Z'),
      });
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-01T09:00',
        '2026-01-01T14:30',
        '2026-01-02T09:00',
      ]);
    });
  });

  describe('excludeDates', () => {
    it('matches exact datetime exclusions when timesOfDay is set', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00', '14:30'],
        excludeDates: [new Date('2026-01-02T09:00:00Z')],
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-03T23:59:59Z'),
      });
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-01T09:00',
        '2026-01-01T14:30',
        '2026-01-02T14:30',
        '2026-01-03T09:00',
        '2026-01-03T14:30',
      ]);
    });
  });

  describe('timezone', () => {
    it('produces the configured wall-clock time in the rule timezone', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'America/New_York',
        timesOfDay: ['09:00'],
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-02T23:59:59Z'),
      });
      // 09:00 New York time on 2026-01-01 = 14:00 UTC (EST = UTC-5)
      expect(fmtTZ(out[0], 'America/New_York')).toBe('2026-01-01T09:00');
      expect(fmtUTC(out[0])).toBe('2026-01-01T14:00');
    });

    it('preserves wall-clock across DST spring-forward (Europe/Warsaw)', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-03-28T00:00:00Z'),
        timezone: 'Europe/Warsaw',
        timesOfDay: ['09:00'],
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-03-28T00:00:00Z'),
        end: new Date('2026-03-30T23:59:59Z'),
      });
      // Warsaw springs forward on 2026-03-29; 09:00 wall-clock should hold both days
      expect(fmtTZ(out[0], 'Europe/Warsaw')).toBe('2026-03-28T09:00');
      expect(fmtTZ(out[1], 'Europe/Warsaw')).toBe('2026-03-29T09:00');
      expect(fmtTZ(out[2], 'Europe/Warsaw')).toBe('2026-03-30T09:00');
    });
  });

  describe('backward compatibility', () => {
    it('without timesOfDay, behavior is unchanged (midnight-aligned)', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
      });
      const out = rule.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-03T00:00:00Z'),
      });
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-01T00:00',
        '2026-01-02T00:00',
        '2026-01-03T00:00',
      ]);
    });
  });

  describe('validation', () => {
    it('rejects invalid HH:MM strings', () => {
      expect(
        () =>
          new Quickurrence({
            rule: 'daily',
            startDate: new Date('2026-01-01T00:00:00Z'),
            timesOfDay: ['9:00'],
          }),
      ).toThrowError(/timesOfDay|INVALID_TIMES_OF_DAY/);
    });

    it('rejects out-of-range hours/minutes', () => {
      expect(
        () =>
          new Quickurrence({
            rule: 'daily',
            startDate: new Date('2026-01-01T00:00:00Z'),
            timesOfDay: ['24:00'],
          }),
      ).toThrowError();
      expect(
        () =>
          new Quickurrence({
            rule: 'daily',
            startDate: new Date('2026-01-01T00:00:00Z'),
            timesOfDay: ['09:60'],
          }),
      ).toThrowError();
    });

    it('rejects empty array', () => {
      expect(
        () =>
          new Quickurrence({
            rule: 'daily',
            startDate: new Date('2026-01-01T00:00:00Z'),
            timesOfDay: [],
          }),
      ).toThrowError();
    });

    it('rejects duplicates', () => {
      expect(
        () =>
          new Quickurrence({
            rule: 'daily',
            startDate: new Date('2026-01-01T00:00:00Z'),
            timesOfDay: ['09:00', '09:00'],
          }),
      ).toThrowError();
    });

    it('error has INVALID_TIMES_OF_DAY code', () => {
      try {
        new Quickurrence({
          rule: 'daily',
          startDate: new Date('2026-01-01T00:00:00Z'),
          timesOfDay: ['nope'],
        });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(QuickurrenceError);
        expect((err as QuickurrenceError).code).toBe(
          QuickurrenceErrorCode.INVALID_TIMES_OF_DAY,
        );
      }
    });
  });

  describe('toHumanText', () => {
    it('mentions configured times', () => {
      const rule = new Quickurrence({
        rule: 'weekly',
        startDate: new Date('2026-01-05T00:00:00Z'),
        weekDays: [1, 3],
        timesOfDay: ['09:00', '14:30'],
      });
      expect(rule.toHumanText()).toMatch(/09:00, 14:30/);
    });
  });

  describe('clean', () => {
    it('drops empty timesOfDay arrays', () => {
      const cleaned = Quickurrence.clean({
        rule: 'daily',
        timesOfDay: [],
      });
      expect(cleaned.timesOfDay).toBeUndefined();
    });

    it('preserves valid timesOfDay', () => {
      const cleaned = Quickurrence.clean({
        rule: 'daily',
        timesOfDay: ['09:00'],
      });
      expect(cleaned.timesOfDay).toEqual(['09:00']);
    });
  });

  describe('merge', () => {
    it('unions datetimes from rules with different timesOfDay', async () => {
      const { QuickurrenceMerge } = await import('./merge');
      const r1 = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      const r2 = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['14:30'],
      });
      const merged = new QuickurrenceMerge([r1, r2]);
      const out = merged.getAllOccurrences({
        start: new Date('2026-01-01T00:00:00Z'),
        end: new Date('2026-01-02T23:59:59Z'),
      });
      expect(out.map(fmtUTC)).toEqual([
        '2026-01-01T09:00',
        '2026-01-01T14:30',
        '2026-01-02T09:00',
        '2026-01-02T14:30',
      ]);
    });
  });
});
