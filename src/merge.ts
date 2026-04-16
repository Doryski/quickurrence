import {
  Quickurrence,
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

export class QuickurrenceMerge {
  public rules: Quickurrence[];

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

    this.rules = [...rules]; // Copy the array
  }

  /**
   * Get all occurrences within the given date range from all merged rules (union)
   */
  getAllOccurrences(range: DateRange): Date[] {
    const allOccurrences: Date[] = [];

    // Get occurrences from all rules
    for (const rule of this.rules) {
      const occurrences = rule.getAllOccurrences(range);
      allOccurrences.push(...occurrences);
    }

    // Sort and deduplicate by timestamp
    const uniqueOccurrences = Array.from(
      new Set(allOccurrences.map((d) => d.getTime())),
    )
      .map((time) => new Date(time))
      .sort((a, b) => a.getTime() - b.getTime());

    return uniqueOccurrences;
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

    // Get occurrences from all rules
    const allRuleOccurrences = this.rules.map((rule) => {
      const occurrences = rule.getAllOccurrences(range);
      return new Set(occurrences.map((d) => d.getTime()));
    });

    // Find intersection of all occurrence sets
    const firstRuleOccurrences = allRuleOccurrences[0];
    if (!firstRuleOccurrences) {
      return [];
    }
    const commonOccurrenceTimestamps = Array.from(firstRuleOccurrences).filter(
      (timestamp) => {
        // Check if this timestamp exists in all other rule occurrence sets
        return allRuleOccurrences
          .slice(1)
          .every((ruleOccurrences) => ruleOccurrences.has(timestamp));
      },
    );

    // Convert back to dates and sort
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
      } catch {
        // Ignore rules that have no more occurrences
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

    // Return the earliest next occurrence
    const sortedOccurrences = nextOccurrences.sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    const earliestOccurrence = sortedOccurrences[0];
    if (!earliestOccurrence) {
      throw QuickurrenceError.runtime(
        'No valid next occurrence found',
        QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
        {
          operation: 'getNextOccurrence',
          details: { sortedOccurrencesLength: sortedOccurrences.length },
        },
      );
    }
    return earliestOccurrence;
  }

  /**
   * Get the earliest start date among all merged rules
   */
  getStartDate(): Date {
    const startDates = this.rules.map((rule) => rule.getStartDate());
    const sortedStartDates = startDates.sort(
      (a, b) => a.getTime() - b.getTime(),
    );
    const earliestStartDate = sortedStartDates[0];
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

    return endDates.sort((a, b) => b.getTime() - a.getTime())[0];
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
        allExcludeDates.push(...excludeDates);
        hasAnyExcludeDates = true;
      }
    }

    if (!hasAnyExcludeDates) {
      return undefined;
    }

    // Deduplicate by timestamp
    const uniqueExcludeDates = Array.from(
      new Set(allExcludeDates.map((d) => d.getTime())),
    ).map((time) => new Date(time));

    return uniqueExcludeDates.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Not supported for merged rules - throws error
   */
  getCondition(): boolean | ((date: Date) => boolean) | undefined {
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
