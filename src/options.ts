/**
 * Internal shared constants. NOT part of the package's public surface — the
 * entry point must never re-export this module, or these become semver-locked.
 *
 * It exists so `./index` (zod schemas) and `./validator` (imperative checks)
 * read the same enumerated values without importing each other. Widening an
 * option means editing exactly one array here.
 */

export const recurrenceRulesOptions = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

export const presetOptions = ['businessDays', 'weekends'] as const;

export const dayOptions = [0, 1, 2, 3, 4, 5, 6] as const;

export const monthDayOptions = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31,
] as const;

export const monthDayModeOptions = ['skip', 'last'] as const;

export const nthWeekdayOfMonthOptions = [1, 2, 3, 4, 'last'] as const;

export const isOneOf =
  <const T extends readonly unknown[]>(options: T) =>
  (value: unknown): value is T[number] =>
    options.includes(value);

/**
 * Safety cap on the number of occurrences RETURNED by a single call. Rules
 * without a count/endDate are effectively infinite, so collection is truncated
 * at this many matches to bound memory and runtime. Sparse rules (heavy
 * exclusions or restrictive conditions) are additionally bounded by an
 * iteration cap so that scanning a range can never loop unbounded.
 *
 * The cap is on the returned array's length, so it holds after `timesOfDay`
 * slot expansion and after a `QuickurrenceMerge` union, not merely on the
 * number of candidate days collected. An explicit `count` larger than this cap
 * does not raise it.
 */
export const MAX_NEXT_OCCURENCES = 1000;
