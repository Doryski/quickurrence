import { TZDate, tz } from '@date-fns/tz';
import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { Quickurrence, QuickurrenceError, QuickurrenceErrorCode } from './index';

const fmtUTC = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm", { in: tz('UTC') });
const fmtTZ = (d: Date, t: string) => format(d, "yyyy-MM-dd'T'HH:mm", { in: tz(t) });
const epochsOf = (dates: Date[]) => dates.map((d) => d.getTime());

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

    it('resolves a far-future query on an infinite daily rule without a full window', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2020-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      const next = rule.getNextOccurrence(new Date('2050-06-15T12:00:00Z'));
      expect(fmtUTC(next)).toBe('2050-06-16T09:00');
    });

    it('picks the earliest time on the same day when after precedes it', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['14:30', '09:00'],
      });
      const next = rule.getNextOccurrence(new Date('2026-06-10T06:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-06-10T09:00');
    });

    it('skips a day whose only time is excluded and returns the next day', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
        excludeDates: [new Date('2026-01-02T09:00:00Z')],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T12:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-01-03T09:00');
    });

    it('advances across an interval > 1 daily rule', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        interval: 3,
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-04T10:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-01-07T09:00');
    });

    it('walks weekly weekDays rules', () => {
      const rule = new Quickurrence({
        rule: 'weekly',
        startDate: new Date('2026-01-05T00:00:00Z'), // Mon
        timezone: 'UTC',
        weekDays: [1, 3], // Mon, Wed
        timesOfDay: ['09:00', '17:00'],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-05T10:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-01-05T17:00');
      const acrossWeekday = rule.getNextOccurrence(
        new Date('2026-01-05T18:00:00Z'),
      );
      expect(fmtUTC(acrossWeekday)).toBe('2026-01-07T09:00');
    });

    it('walks monthly specific-day rules', () => {
      const rule = new Quickurrence({
        rule: 'monthly',
        startDate: new Date('2026-01-15T00:00:00Z'),
        monthDay: 15,
        timezone: 'UTC',
        timesOfDay: ['09:00'],
      });
      const next = rule.getNextOccurrence(new Date('2026-01-15T12:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-02-15T09:00');
    });

    it('honors a day-level condition on the lazy path', () => {
      const rule = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-01-01T00:00:00Z'),
        timezone: 'UTC',
        timesOfDay: ['09:00'],
        condition: (date) => date.getUTCDate() % 2 === 0,
      });
      const next = rule.getNextOccurrence(new Date('2026-01-01T12:00:00Z'));
      expect(fmtUTC(next)).toBe('2026-01-02T09:00');
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

  // The timesOfDay path used to hand back TZDate instances from both
  // occurrence methods. A TZDate passes `instanceof Date` and renders in its
  // own zone, so the constructor identity and the trailing `Z` are what pin the
  // plain-Date contract.
  describe('returns plain Dates', () => {
    const WARSAW = 'Europe/Warsaw';
    const rule = (timezone: string) =>
      new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-06-10T00:00:00Z'),
        timezone,
        timesOfDay: ['09:00', '14:30'],
      });

    for (const timezone of ['UTC', WARSAW]) {
      it(`returns plain Dates from getAllOccurrences for a ${timezone} rule`, () => {
        const out = rule(timezone).getAllOccurrences({
          start: new Date('2026-06-10T00:00:00Z'),
          end: new Date('2026-06-12T23:59:59Z'),
        });

        expect(out.length).toBeGreaterThan(0);
        out.forEach((datetime) => {
          expect(datetime.constructor).toBe(Date);
          expect(datetime.toISOString().endsWith('Z')).toBe(true);
        });
      });

      it(`returns a plain Date from getNextOccurrence for a ${timezone} rule`, () => {
        const next = rule(timezone).getNextOccurrence(
          new Date('2026-06-10T00:00:00Z'),
        );

        expect(next.constructor).toBe(Date);
        expect(next.toISOString().endsWith('Z')).toBe(true);
      });
    }

    it('renders a Warsaw slot with a trailing Z rather than an offset', () => {
      // 2026-06-10 09:00 CEST is 07:00Z.
      expect(
        rule(WARSAW).getNextOccurrence(new Date('2026-06-10T00:00:00Z')).toISOString(),
      ).toBe('2026-06-10T07:00:00.000Z');
    });

    it('carries plain Dates in the END_DATE_EXCEEDED details', () => {
      const bounded = new Quickurrence({
        rule: 'daily',
        startDate: new Date('2026-06-10T00:00:00Z'),
        timezone: WARSAW,
        timesOfDay: ['09:00'],
        endDate: new Date('2026-06-12T23:59:59Z'),
      });

      try {
        bounded.getNextOccurrence(new Date('2026-06-20T00:00:00Z'));
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
        expect(details.endDate.constructor).toBe(Date);
        expect(details.currentDate.constructor).toBe(Date);
        expect(JSON.stringify(details.endDate)).toMatch(/Z"$/);
        expect(JSON.stringify(details.currentDate)).toMatch(/Z"$/);
      }
    });

    it('carries a plain afterDate in the monthly END_DATE_EXCEEDED details', () => {
      const bounded = new Quickurrence({
        rule: 'monthly',
        monthDay: 15,
        startDate: new Date('2026-01-15T00:00:00Z'),
        timezone: WARSAW,
        timesOfDay: ['09:00'],
        endDate: new Date('2026-07-01T00:00:00Z'),
      });

      try {
        bounded.getNextOccurrence(new Date('2026-08-01T00:00:00Z'));
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(QuickurrenceError);
        expect((error as QuickurrenceError).code).toBe(
          QuickurrenceErrorCode.END_DATE_EXCEEDED,
        );
        const details = (error as QuickurrenceError).context?.details as {
          afterDate: Date;
        };
        expect(details.afterDate.constructor).toBe(Date);
        expect(JSON.stringify(details.afterDate)).toMatch(/Z"$/);
      }
    });
  });

  describe('range & endDate boundary semantics', () => {
    const TZ = 'Europe/Warsaw';
    // January in Warsaw is CET, and the explicit offset is required: passing a
    // bare `2026-01-15T12:00:00` to TZDate parses it as UTC, not as local time.
    const warsaw = (dayAndTime: string) =>
      new TZDate(`2026-01-${dayAndTime}+01:00`, TZ);
    // Boundary instants are spelled out rather than derived via
    // startOfDay/endOfDay: those helpers round-trip the wall clock through the
    // host zone, so on a host whose own DST gap swallows the target wall clock
    // they return a different epoch and the boundary under test moves.
    const jan15Midnight = warsaw('15T00:00:00.000');
    const jan15LastMs = warsaw('15T23:59:59.999');
    const jan31LastMs = warsaw('31T23:59:59.999');
    const base = {
      rule: 'daily' as const,
      startDate: warsaw('12T00:00:00.000'),
      timezone: TZ,
    };
    const times = ['08:00', '20:00'];
    const withTimes = (opts: Record<string, unknown> = {}) =>
      new Quickurrence({ ...base, ...opts, timesOfDay: times });
    const dayLevel = (opts: Record<string, unknown> = {}) =>
      new Quickurrence({ ...base, ...opts });
    const slots = (out: Date[]) => out.map((d) => fmtTZ(d, TZ));
    // `days()` collapses the output to one entry per day, which is what the
    // boundary assertions below are about. Asserting the raw stamps first means a
    // day emitted twice fails here instead of disappearing into the Set.
    const days = (out: Date[]) => {
      const stamps = out.map((d) => fmtTZ(d, TZ).slice(0, 10));
      expect(stamps).toEqual([...new Set(stamps)]);
      return [...new Set(stamps)];
    };

    describe('range.end', () => {
      const range = {
        start: warsaw('14T00:00:00.000'),
        end: jan15Midnight,
      };

      it('at midnight covers only that instant for timesOfDay rules', () => {
        expect(slots(withTimes().getAllOccurrences(range))).toEqual([
          '2026-01-14T08:00',
          '2026-01-14T20:00',
        ]);
      });

      it('at midnight covers the whole day for day-level rules', () => {
        expect(days(dayLevel().getAllOccurrences(range))).toEqual([
          '2026-01-14',
          '2026-01-15',
        ]);
      });

      it('mid-day keeps only the slots up to that instant', () => {
        const midDay = {
          start: warsaw('14T00:00:00.000'),
          end: warsaw('15T12:00:00.000'),
        };
        expect(slots(withTimes().getAllOccurrences(midDay))).toEqual([
          '2026-01-14T08:00',
          '2026-01-14T20:00',
          '2026-01-15T08:00',
        ]);
        expect(days(dayLevel().getAllOccurrences(midDay))).toEqual([
          '2026-01-14',
          '2026-01-15',
        ]);
      });
    });

    describe('range.start', () => {
      const range = {
        start: warsaw('14T12:00:00.000'),
        end: jan15LastMs,
      };

      it('mid-day drops the earlier slots of that day for timesOfDay rules', () => {
        expect(slots(withTimes().getAllOccurrences(range))).toEqual([
          '2026-01-14T20:00',
          '2026-01-15T08:00',
          '2026-01-15T20:00',
        ]);
      });

      it('mid-day still yields the whole day for day-level rules', () => {
        expect(slots(dayLevel().getAllOccurrences(range))).toEqual([
          '2026-01-14T00:00',
          '2026-01-15T00:00',
        ]);
      });
    });

    describe('endDate', () => {
      const wide = {
        start: warsaw('12T00:00:00.000'),
        end: jan31LastMs,
      };

      it('at midnight ends a timesOfDay rule before that day', () => {
        expect(slots(withTimes({ endDate: jan15Midnight }).getAllOccurrences(wide)))
          .toEqual([
            '2026-01-12T08:00',
            '2026-01-12T20:00',
            '2026-01-13T08:00',
            '2026-01-13T20:00',
            '2026-01-14T08:00',
            '2026-01-14T20:00',
          ]);
      });

      it('at midnight still includes that day for day-level rules', () => {
        expect(days(dayLevel({ endDate: jan15Midnight }).getAllOccurrences(wide)))
          .toEqual(['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15']);
      });

      it('at end of day includes that day for timesOfDay rules', () => {
        const out = withTimes({ endDate: jan15LastMs }).getAllOccurrences(wide);
        expect(slots(out).slice(-2)).toEqual([
          '2026-01-15T08:00',
          '2026-01-15T20:00',
        ]);
        expect(out).toHaveLength(8);
      });
    });

    describe('getNextOccurrence agrees with getAllOccurrences', () => {
      const wide = {
        start: warsaw('12T00:00:00.000'),
        end: jan31LastMs,
      };
      const after = warsaw('14T21:00:00.000');

      it('reports the rule exhausted when endDate is at midnight', () => {
        const rule = withTimes({ endDate: jan15Midnight });
        const all = rule.getAllOccurrences(wide);
        expect(slots(all).at(-1)).toBe('2026-01-14T20:00');
        try {
          rule.getNextOccurrence(after);
          throw new Error('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(QuickurrenceError);
          expect((err as QuickurrenceError).code).toBe(
            QuickurrenceErrorCode.END_DATE_EXCEEDED,
          );
        }
      });

      it('returns the same last occurrence when endDate is at end of day', () => {
        const rule = withTimes({ endDate: jan15LastMs });
        const remaining = rule
          .getAllOccurrences(wide)
          .filter((d) => d.getTime() > after.getTime());
        expect(fmtTZ(rule.getNextOccurrence(after), TZ)).toBe(
          fmtTZ(remaining[0], TZ),
        );
        expect(slots(remaining)).toEqual([
          '2026-01-15T08:00',
          '2026-01-15T20:00',
        ]);
      });
    });

    it('applies the same boundaries on a DST spring-forward day', () => {
      const dstBase = {
        rule: 'daily' as const,
        startDate: new TZDate('2026-03-28T00:00:00.000+01:00', TZ),
        timezone: TZ,
      };
      // Warsaw springs forward on 2026-03-29
      const range = {
        start: new TZDate('2026-03-28T00:00:00.000+01:00', TZ),
        end: new TZDate('2026-03-29T00:00:00.000+01:00', TZ),
      };
      expect(
        slots(
          new Quickurrence({
            ...dstBase,
            timesOfDay: times,
          }).getAllOccurrences(range),
        ),
      ).toEqual(['2026-03-28T08:00', '2026-03-28T20:00']);
      expect(days(new Quickurrence(dstBase).getAllOccurrences(range))).toEqual([
        '2026-03-28',
        '2026-03-29',
      ]);
    });

    it('applies the same boundaries to merged rules', async () => {
      const { QuickurrenceMerge } = await import('./merge');
      const merged = new QuickurrenceMerge([
        withTimes(),
        new Quickurrence({ ...base, timesOfDay: ['12:00'] }),
      ]);
      const out = merged.getAllOccurrences({
        start: warsaw('14T00:00:00.000'),
        end: jan15Midnight,
      });
      expect(slots(out)).toEqual([
        '2026-01-14T08:00',
        '2026-01-14T12:00',
        '2026-01-14T20:00',
      ]);
    });

    it('emits each day-level occurrence exactly once', () => {
      // Guards the assertions that go through days(): without this a rule that
      // emitted a day twice would still satisfy them, because deduplication
      // happens before the comparison.
      const out = dayLevel().getAllOccurrences({
        start: warsaw('12T00:00:00.000'),
        end: jan31LastMs,
      });
      expect(out).toHaveLength(20);
      expect(epochsOf(out)).toEqual([...new Set(epochsOf(out))]);
      expect(slots(out)).toEqual([...new Set(slots(out))]);
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

  // A DST transition makes some wall clocks ambiguous (a fall-back overlap
  // repeats an hour) and some nonexistent (a spring-forward gap skips one).
  // Which instant a timesOfDay slot lands on is a documented contract, and it is
  // NOT the same for every zone: the resolution depends on the offsets on either
  // side of the transition, so the assertions below pin the measured instant per
  // zone rather than a single global rule. Epochs are compared, never formatted
  // strings, because two different instants can render identically in the rule
  // zone during an overlap.
  describe('DST transitions with timesOfDay', () => {
    const WARSAW = 'Europe/Warsaw';
    const NY = 'America/New_York';
    const LORD_HOWE = 'Australia/Lord_Howe';
    const slotsFor = (
      timezone: string,
      timeOfDay: string,
      start: string,
      end: string,
    ) =>
      epochsOf(
        new Quickurrence({
          rule: 'daily',
          startDate: new Date(start),
          timezone,
          timesOfDay: [timeOfDay],
        }).getAllOccurrences({ start: new Date(start), end: new Date(end) }),
      );

    describe('fall-back overlap (ambiguous wall clock)', () => {
      it('leaves Warsaw 01:30 on 2026-10-25 unambiguous, outside the overlap', () => {
        // Control case, not an overlap: Warsaw rewinds 03:00 CEST -> 02:00 CET,
        // so the repeated hour is 02:00-03:00 and 01:30 occurs once, at +02:00.
        // The genuinely ambiguous 02:30 slot is pinned in the test below.
        expect(
          slotsFor(
            WARSAW,
            '01:30',
            '2026-10-24T00:00:00Z',
            '2026-10-26T12:00:00Z',
          ),
        ).toEqual([
          Date.parse('2026-10-24T23:30:00.000Z'), // 2026-10-25 01:30 +02:00
          Date.parse('2026-10-26T00:30:00.000Z'), // 2026-10-26 01:30 +01:00
        ]);
      });

      it('resolves the ambiguous Warsaw 02:30 on 2026-10-25 to the later, CET instant', () => {
        // 02:30 falls inside the repeated hour, so it exists twice: once at
        // +02:00 (CEST) and once at +01:00 (CET). This is the case the
        // zonedWallClockToInstant docstring documents, and the LATER instant
        // wins here — the opposite of New York below.
        expect(
          slotsFor(
            WARSAW,
            '02:30',
            '2026-10-25T00:00:00Z',
            '2026-10-25T23:59:59.999Z',
          ),
        ).toEqual([
          Date.parse('2026-10-25T01:30:00.000Z'), // 2026-10-25 02:30 +01:00 (CET)
        ]);
      });

      it('resolves New York 01:30 on 2026-11-01 to the earlier, EDT instant', () => {
        // New York rewinds 02:00 EDT -> 01:00 EST, so 01:30 occurs twice. The
        // first (EDT, -04:00) occurrence is the one selected.
        expect(
          slotsFor(NY, '01:30', '2026-10-31T00:00:00Z', '2026-11-02T12:00:00Z'),
        ).toEqual([
          Date.parse('2026-10-31T05:30:00.000Z'), // 2026-10-31 01:30 -04:00
          Date.parse('2026-11-01T05:30:00.000Z'), // 2026-11-01 01:30 -04:00 (EDT)
          Date.parse('2026-11-02T06:30:00.000Z'), // 2026-11-02 01:30 -05:00
        ]);
      });

      it('resolves Lord Howe 01:45 on 2026-04-05 to the later, standard instant', () => {
        // Lord Howe rewinds 02:00 (+11:00) -> 01:30 (+10:30), so 01:30-02:00
        // occurs twice. Here the LATER (+10:30) occurrence wins — the opposite
        // choice from New York above, which is why zone-by-zone pinning is
        // needed instead of one global rule.
        expect(
          slotsFor(
            LORD_HOWE,
            '01:45',
            '2026-04-04T00:00:00Z',
            '2026-04-07T00:00:00Z',
          ),
        ).toEqual([
          Date.parse('2026-04-04T15:15:00.000Z'), // 2026-04-05 01:45 +10:30
          Date.parse('2026-04-05T15:15:00.000Z'), // 2026-04-06 01:45 +10:30
          Date.parse('2026-04-06T15:15:00.000Z'), // 2026-04-07 01:45 +10:30
        ]);
      });
    });

    describe('spring-forward gap (nonexistent wall clock)', () => {
      it('maps New York 02:30 on 2026-03-08 FORWARD to 03:30 EDT', () => {
        expect(
          slotsFor(NY, '02:30', '2026-03-07T00:00:00Z', '2026-03-09T12:00:00Z'),
        ).toEqual([
          Date.parse('2026-03-07T07:30:00.000Z'), // 2026-03-07 02:30 -05:00
          Date.parse('2026-03-08T07:30:00.000Z'), // 2026-03-08 03:30 -04:00
          Date.parse('2026-03-09T06:30:00.000Z'), // 2026-03-09 02:30 -04:00
        ]);
      });

      it('maps Warsaw 02:30 on 2026-03-29 BACKWARD to 01:30 CET', () => {
        expect(
          slotsFor(
            WARSAW,
            '02:30',
            '2026-03-28T00:00:00Z',
            '2026-03-30T12:00:00Z',
          ),
        ).toEqual([
          Date.parse('2026-03-28T01:30:00.000Z'), // 2026-03-28 02:30 +01:00
          Date.parse('2026-03-29T00:30:00.000Z'), // 2026-03-29 01:30 +01:00
          Date.parse('2026-03-30T00:30:00.000Z'), // 2026-03-30 02:30 +02:00
        ]);
      });

      it('maps Lord Howe 02:15 on 2026-10-04 BACKWARD to 01:45 (+10:30)', () => {
        // Lord Howe advances 02:00 -> 02:30, so only 02:00-02:30 is missing;
        // a 30-minute gap, not the usual hour.
        expect(
          slotsFor(
            LORD_HOWE,
            '02:15',
            '2026-10-03T00:00:00Z',
            '2026-10-06T00:00:00Z',
          ),
        ).toEqual([
          Date.parse('2026-10-03T15:15:00.000Z'), // 2026-10-04 01:45 +10:30
          Date.parse('2026-10-04T15:15:00.000Z'), // 2026-10-05 02:15 +11:00
          Date.parse('2026-10-05T15:15:00.000Z'), // 2026-10-06 02:15 +11:00
        ]);
      });

      it('maps Chatham 03:00 on 2026-09-27 BACKWARD to 02:00 (+12:45)', () => {
        expect(
          slotsFor(
            'Pacific/Chatham',
            '03:00',
            '2026-09-25T00:00:00Z',
            '2026-09-29T00:00:00Z',
          ),
        ).toEqual([
          Date.parse('2026-09-25T14:15:00.000Z'), // 2026-09-26 03:00 +12:45
          Date.parse('2026-09-26T13:15:00.000Z'), // 2026-09-27 02:00 +12:45
          Date.parse('2026-09-27T13:15:00.000Z'), // 2026-09-28 03:00 +13:45
          Date.parse('2026-09-28T13:15:00.000Z'), // 2026-09-29 03:00 +13:45
        ]);
      });
    });
  });
});
