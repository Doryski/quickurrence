import { MAX_NEXT_OCCURENCES } from './options';
import {
  Quickurrence,
  type Condition,
  type QuickurrenceOptions,
  type RecurrenceRule,
  type DateRange,
  type WeekStartsOn,
  type WeekDay,
  type MonthDay,
  type MonthDayMode,
  type NthWeekdayConfig,
  type Preset,
} from './index';
import { QuickurrenceError, QuickurrenceErrorCode } from './error';

const EXHAUSTION_CODES = [
  QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
  QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
  QuickurrenceErrorCode.END_DATE_EXCEEDED,
] as const;

export class QuickurrenceMerge {
  public rules: Quickurrence[];

  /** A rule reporting it has nothing left, as opposed to a real failure. */
  private static isExhaustionError(error: unknown): boolean {
    return EXHAUSTION_CODES.some((code) =>
      QuickurrenceError.hasCode(error, code),
    );
  }

  constructor(rules: Quickurrence[]) {
    if (!rules || rules.length === 0) {
      throw QuickurrenceError.validation(
        'At least one rule is required for merging',
        QuickurrenceErrorCode.EMPTY_REQUIRED_ARRAY,
        {
          option: 'rules',
          value: rules,
          expected: 'Non-empty array of Quickurrence instances',
        },
      );
    }

    this.rules = [...rules];
  }

  /**
   * Get all occurrences within the given date range from all merged rules (union).
   *
   * Each rule is individually capped at {@link MAX_NEXT_OCCURENCES}, so the
   * union of N rules would otherwise return up to N times the documented cap.
   * The same cap is applied to the merged result, keeping it a bound on
   * returned occurrences: the earliest {@link MAX_NEXT_OCCURENCES} instants.
   */
  getAllOccurrences(range: DateRange): Date[] {
    const allOccurrences: Date[] = [];

    for (const rule of this.rules) {
      const occurrences = rule.getAllOccurrences(range);
      for (const occurrence of occurrences) {
        allOccurrences.push(occurrence);
      }
    }

    const uniqueOccurrences = Array.from(
      new Set(allOccurrences.map((d) => d.getTime())),
    )
      .map((time) => new Date(time))
      .sort((a, b) => a.getTime() - b.getTime());

    return uniqueOccurrences.slice(0, MAX_NEXT_OCCURENCES);
  }

  /**
   * Get occurrences that are common to ALL merged rules within the given date range (intersection)
   */
  getCommonOccurrences(range: DateRange): Date[] {
    if (this.rules.length === 0) {
      return [];
    }

    if (this.rules.length === 1) {
      return this.rules[0]?.getAllOccurrences(range) || [];
    }

    const allRuleOccurrences = this.rules.map((rule) => {
      const occurrences = rule.getAllOccurrences(range);
      return new Set(occurrences.map((d) => d.getTime()));
    });

    const firstRuleOccurrences = allRuleOccurrences[0];
    if (!firstRuleOccurrences) {
      return [];
    }
    const otherRuleOccurrences = allRuleOccurrences.slice(1);
    const commonOccurrenceTimestamps = Array.from(firstRuleOccurrences).filter(
      (timestamp) =>
        otherRuleOccurrences.every((ruleOccurrences) =>
          ruleOccurrences.has(timestamp),
        ),
    );

    return commonOccurrenceTimestamps
      .map((time) => new Date(time))
      .sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get the next occurrence after the given date from any of the merged rules
   */
  getNextOccurrence(after: Date = new Date()): Date {
    const nextOccurrences: Date[] = [];

    for (const rule of this.rules) {
      try {
        const nextOccurrence = rule.getNextOccurrence(after);
        nextOccurrences.push(nextOccurrence);
      } catch (error) {
        // Only exhaustion is expected and ignorable here. Swallowing everything
        // reported a bad `after` argument as NO_MORE_OCCURRENCES, hiding the
        // real cause behind an error that says the rules are simply used up.
        if (!QuickurrenceMerge.isExhaustionError(error)) {
          throw error;
        }
        continue;
      }
    }

    if (nextOccurrences.length === 0) {
      throw QuickurrenceError.runtime(
        'No more occurrences from any of the merged rules',
        QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
        {
          operation: 'getNextOccurrence',
          details: { mergedRuleCount: this.rules.length },
        },
      );
    }

    let earliestOccurrence = nextOccurrences[0];
    if (!earliestOccurrence) {
      throw QuickurrenceError.runtime(
        'No valid next occurrence found',
        QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
        {
          operation: 'getNextOccurrence',
          details: { sortedOccurrencesLength: nextOccurrences.length },
        },
      );
    }
    for (const occurrence of nextOccurrences) {
      if (occurrence.getTime() < earliestOccurrence.getTime()) {
        earliestOccurrence = occurrence;
      }
    }
    return earliestOccurrence;
  }

  /**
   * Get the earliest start date among all merged rules
   */
  getStartDate(): Date {
    const startDates = this.rules.map((rule) => rule.getStartDate());
    let earliestStartDate = startDates[0];
    if (!earliestStartDate) {
      throw QuickurrenceError.runtime(
        'No valid start date found',
        QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
        {
          operation: 'getStartDate',
          details: { mergedRuleCount: this.rules.length },
        },
      );
    }
    for (const startDate of startDates) {
      if (startDate.getTime() < earliestStartDate.getTime()) {
        earliestStartDate = startDate;
      }
    }
    return earliestStartDate;
  }

  /**
   * Not supported for merged rules - throws error
   */
  getRule(): RecurrenceRule {
    throw QuickurrenceError.unsupportedOperation(
      'getRule() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getRule',
        rule: 'merged',
      },
    );
  }

  /**
   * Get the latest end date among all merged rules, or undefined if any rule has no end date
   */
  getEndDate(): Date | undefined {
    const endDates: Date[] = [];

    for (const rule of this.rules) {
      const endDate = rule.getEndDate();
      if (endDate === undefined) {
        return undefined; // At least one rule has no end date
      }
      endDates.push(endDate);
    }

    let latestEndDate = endDates[0];
    if (!latestEndDate) {
      return undefined;
    }
    for (const endDate of endDates) {
      if (endDate.getTime() > latestEndDate.getTime()) {
        latestEndDate = endDate;
      }
    }
    return latestEndDate;
  }

  /**
   * Not supported for merged rules - throws error
   */
  getWeekStartsOn(): WeekStartsOn {
    throw QuickurrenceError.unsupportedOperation(
      'getWeekStartsOn() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getWeekStartsOn',
        rule: 'merged',
      },
    );
  }

  /**
   * Not supported for merged rules - throws error
   */
  getWeekDays(): WeekDay[] | undefined {
    throw QuickurrenceError.unsupportedOperation(
      'getWeekDays() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getWeekDays',
        rule: 'merged',
      },
    );
  }

  /**
   * Not supported for merged rules - throws error
   */
  getMonthDay(): MonthDay | undefined {
    throw QuickurrenceError.unsupportedOperation(
      'getMonthDay() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getMonthDay',
        rule: 'merged',
      },
    );
  }

  /**
   * Not supported for merged rules - throws error
   */
  getMonthDayMode(): MonthDayMode {
    throw QuickurrenceError.unsupportedOperation(
      'getMonthDayMode() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getMonthDayMode',
        rule: 'merged',
      },
    );
  }

  /**
   * Not supported for merged rules - throws error
   */
  getNthWeekdayOfMonth(): NthWeekdayConfig | undefined {
    throw QuickurrenceError.unsupportedOperation(
      'getNthWeekdayOfMonth() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getNthWeekdayOfMonth',
        rule: 'merged',
      },
    );
  }

  /**
   * Get the sum of all counts, or undefined if any rule has no count limit
   */
  getCount(): number | undefined {
    const counts: number[] = [];

    for (const rule of this.rules) {
      const count = rule.getCount();
      if (count === undefined) {
        return undefined; // At least one rule has no count limit
      }
      counts.push(count);
    }

    return counts.reduce((sum, count) => sum + count, 0);
  }

  /**
   * Get the union of all exclude dates from merged rules
   */
  getExcludeDates(): Date[] | undefined {
    const allExcludeDates: Date[] = [];
    let hasAnyExcludeDates = false;

    for (const rule of this.rules) {
      const excludeDates = rule.getExcludeDates();
      if (excludeDates && excludeDates.length > 0) {
        for (const excludeDate of excludeDates) {
          allExcludeDates.push(excludeDate);
        }
        hasAnyExcludeDates = true;
      }
    }

    if (!hasAnyExcludeDates) {
      return undefined;
    }

    const uniqueExcludeDates = Array.from(
      new Set(allExcludeDates.map((d) => d.getTime())),
    ).map((time) => new Date(time));

    return uniqueExcludeDates.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Not supported for merged rules - throws error
   */
  getCondition(): Condition | undefined {
    throw QuickurrenceError.unsupportedOperation(
      'getCondition() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getCondition',
        rule: 'merged',
      },
    );
  }

  /**
   * Not supported for merged rules - throws error
   */
  getPreset(): Preset | undefined {
    throw QuickurrenceError.unsupportedOperation(
      'getPreset() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getPreset',
        rule: 'merged',
      },
    );
  }

  /**
   * Not supported for merged rules - throws error
   */
  getOptions(): QuickurrenceOptions {
    throw QuickurrenceError.unsupportedOperation(
      'getOptions() is not supported for merged rules',
      QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      {
        operation: 'getOptions',
        rule: 'merged',
      },
    );
  }

  /**
   * Get the number of merged rules
   */
  getRuleCount(): number {
    return this.rules.length;
  }

  /**
   * Get a copy of the merged rules
   */
  getRules(): Quickurrence[] {
    return [...this.rules];
  }
}
