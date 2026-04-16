import { describe, expect, it } from 'vitest';
import {
  QuickurrenceError,
  QuickurrenceErrorType,
  QuickurrenceErrorCode,
  type QuickurrenceErrorContext,
} from './error';

describe('QuickurrenceError', () => {
  describe('Basic functionality', () => {
    it('should create a basic error', () => {
      const error = new QuickurrenceError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(QuickurrenceError);
      expect(error.name).toBe('QuickurrenceError');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(QuickurrenceErrorType.RUNTIME);
      expect(error.code).toBe(QuickurrenceErrorCode.UNKNOWN);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create an error with type and code', () => {
      const error = new QuickurrenceError(
        'Validation failed',
        QuickurrenceErrorType.VALIDATION,
        QuickurrenceErrorCode.INVALID_START_DATE,
      );

      expect(error.type).toBe(QuickurrenceErrorType.VALIDATION);
      expect(error.code).toBe(QuickurrenceErrorCode.INVALID_START_DATE);
    });

    it('should create an error with context', () => {
      const context: QuickurrenceErrorContext = {
        option: 'startDate',
        value: 'invalid-date',
        expected: 'Valid Date object',
        operation: 'validation',
      };

      const error = new QuickurrenceError(
        'Invalid start date',
        QuickurrenceErrorType.VALIDATION,
        QuickurrenceErrorCode.INVALID_START_DATE,
        context,
      );

      expect(error.context).toEqual(context);
      expect(error.context?.option).toBe('startDate');
      expect(error.context?.value).toBe('invalid-date');
    });

    it('should have proper prototype chain', () => {
      const error = new QuickurrenceError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof QuickurrenceError).toBe(true);
    });
  });

  describe('Static factory methods', () => {
    it('should create validation error', () => {
      const error = QuickurrenceError.validation(
        'Invalid value',
        QuickurrenceErrorCode.INVALID_START_DATE,
      );

      expect(error.type).toBe(QuickurrenceErrorType.VALIDATION);
      expect(error.code).toBe(QuickurrenceErrorCode.INVALID_START_DATE);
      expect(error.message).toBe('Invalid value');
    });

    it('should create configuration error', () => {
      const error = QuickurrenceError.configuration(
        'Unsupported rule',
        QuickurrenceErrorCode.UNSUPPORTED_RULE,
      );

      expect(error.type).toBe(QuickurrenceErrorType.CONFIGURATION);
      expect(error.code).toBe(QuickurrenceErrorCode.UNSUPPORTED_RULE);
    });

    it('should create runtime error', () => {
      const error = QuickurrenceError.runtime(
        'No more occurrences',
        QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
      );

      expect(error.type).toBe(QuickurrenceErrorType.RUNTIME);
      expect(error.code).toBe(QuickurrenceErrorCode.NO_MORE_OCCURRENCES);
    });

    it('should create unsupported operation error', () => {
      const error = QuickurrenceError.unsupportedOperation(
        'Operation not supported',
        QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      );

      expect(error.type).toBe(QuickurrenceErrorType.UNSUPPORTED_OPERATION);
      expect(error.code).toBe(
        QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      );
    });

    it('should create date/time error', () => {
      const error = QuickurrenceError.dateTime(
        'Invalid date range',
        QuickurrenceErrorCode.INVALID_DATE_RANGE,
      );

      expect(error.type).toBe(QuickurrenceErrorType.DATE_TIME);
      expect(error.code).toBe(QuickurrenceErrorCode.INVALID_DATE_RANGE);
    });

    it('should create recurrence rule error', () => {
      const error = QuickurrenceError.recurrenceRule(
        'Invalid rule configuration',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
      );

      expect(error.type).toBe(QuickurrenceErrorType.RECURRENCE_RULE);
      expect(error.code).toBe(QuickurrenceErrorCode.CONFLICTING_OPTIONS);
    });

    it('should create error with context using factory methods', () => {
      const context: QuickurrenceErrorContext = {
        option: 'interval',
        value: -1,
        expected: 'Positive integer',
      };

      const error = QuickurrenceError.validation(
        'Invalid interval',
        QuickurrenceErrorCode.INVALID_INTERVAL,
        context,
      );

      expect(error.context).toEqual(context);
    });
  });

  describe('Static utility methods', () => {
    it('should check if error is QuickurrenceError', () => {
      const quickError = new QuickurrenceError('Test');
      const normalError = new Error('Test');
      const notError = { message: 'Test' };

      expect(QuickurrenceError.isQuickurrenceError(quickError)).toBe(true);
      expect(QuickurrenceError.isQuickurrenceError(normalError)).toBe(false);
      expect(QuickurrenceError.isQuickurrenceError(notError)).toBe(false);
      expect(QuickurrenceError.isQuickurrenceError(null)).toBe(false);
      expect(QuickurrenceError.isQuickurrenceError(undefined)).toBe(false);
    });

    it('should check if error is of specific type', () => {
      const validationError = QuickurrenceError.validation(
        'Test',
        QuickurrenceErrorCode.INVALID_START_DATE,
      );
      const runtimeError = QuickurrenceError.runtime(
        'Test',
        QuickurrenceErrorCode.NO_MORE_OCCURRENCES,
      );
      const normalError = new Error('Test');

      expect(
        QuickurrenceError.isType(
          validationError,
          QuickurrenceErrorType.VALIDATION,
        ),
      ).toBe(true);
      expect(
        QuickurrenceError.isType(
          validationError,
          QuickurrenceErrorType.RUNTIME,
        ),
      ).toBe(false);
      expect(
        QuickurrenceError.isType(runtimeError, QuickurrenceErrorType.RUNTIME),
      ).toBe(true);
      expect(
        QuickurrenceError.isType(normalError, QuickurrenceErrorType.VALIDATION),
      ).toBe(false);
    });

    it('should check if error has specific code', () => {
      const error = QuickurrenceError.validation(
        'Test',
        QuickurrenceErrorCode.INVALID_START_DATE,
      );
      const normalError = new Error('Test');

      expect(
        QuickurrenceError.hasCode(
          error,
          QuickurrenceErrorCode.INVALID_START_DATE,
        ),
      ).toBe(true);
      expect(
        QuickurrenceError.hasCode(
          error,
          QuickurrenceErrorCode.INVALID_END_DATE,
        ),
      ).toBe(false);
      expect(
        QuickurrenceError.hasCode(
          normalError,
          QuickurrenceErrorCode.INVALID_START_DATE,
        ),
      ).toBe(false);
    });
  });

  describe('Serialization and formatting', () => {
    it('should convert to JSON', () => {
      const context: QuickurrenceErrorContext = {
        option: 'startDate',
        value: 'invalid',
        expected: 'Valid Date object',
      };

      const error = QuickurrenceError.validation(
        'Invalid start date',
        QuickurrenceErrorCode.INVALID_START_DATE,
        context,
      );

      const json = error.toJSON();

      expect(json.name).toBe('QuickurrenceError');
      expect(json.message).toBe('Invalid start date');
      expect(json.type).toBe(QuickurrenceErrorType.VALIDATION);
      expect(json.code).toBe(QuickurrenceErrorCode.INVALID_START_DATE);
      expect(json.context).toEqual(context);
      expect(json.timestamp).toBeDefined();
      expect(typeof json.timestamp).toBe('string');
    });

    it('should get detailed message without context', () => {
      const error = new QuickurrenceError('Basic error');
      expect(error.getDetailedMessage()).toBe('Basic error');
    });

    it('should get detailed message with context', () => {
      const context: QuickurrenceErrorContext = {
        option: 'startDate',
        value: 'invalid-date',
        expected: 'Valid Date object',
        operation: 'validation',
      };

      const error = QuickurrenceError.validation(
        'Invalid start date',
        QuickurrenceErrorCode.INVALID_START_DATE,
        context,
      );

      const detailedMessage = error.getDetailedMessage();
      expect(detailedMessage).toBe(
        'Invalid start date (Option: startDate, Value: "invalid-date", Expected: Valid Date object, Operation: validation)',
      );
    });

    it('should get detailed message with partial context', () => {
      const context: QuickurrenceErrorContext = {
        option: 'interval',
        value: -1,
      };

      const error = QuickurrenceError.validation(
        'Invalid interval',
        QuickurrenceErrorCode.INVALID_INTERVAL,
        context,
      );

      const detailedMessage = error.getDetailedMessage();
      expect(detailedMessage).toBe(
        'Invalid interval (Option: interval, Value: -1)',
      );
    });

    it('should handle complex values in context', () => {
      const context: QuickurrenceErrorContext = {
        value: { complex: 'object', with: [1, 2, 3] },
      };

      const error = new QuickurrenceError(
        'Test',
        QuickurrenceErrorType.VALIDATION,
        QuickurrenceErrorCode.UNKNOWN,
        context,
      );
      const detailedMessage = error.getDetailedMessage();

      expect(detailedMessage).toContain('{"complex":"object","with":[1,2,3]}');
    });
  });

  describe('Error behavior', () => {
    it('should be catchable as Error', () => {
      const throwQuickError = () => {
        throw new QuickurrenceError('Test error');
      };

      expect(() => throwQuickError()).toThrow(Error);
      expect(() => throwQuickError()).toThrow(QuickurrenceError);
      expect(() => throwQuickError()).toThrow('Test error');
    });

    it('should have stack trace', () => {
      const error = new QuickurrenceError('Test error');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('QuickurrenceError');
    });

    it('should preserve original message', () => {
      const originalMessage = 'Original error message';
      const error = new QuickurrenceError(originalMessage);

      expect(error.message).toBe(originalMessage);
      expect(error.toString()).toContain(originalMessage);
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle validation error scenario', () => {
      const invalidStartDate = 'not-a-date';

      const error = QuickurrenceError.validation(
        'startDate must be a valid Date object',
        QuickurrenceErrorCode.INVALID_START_DATE,
        {
          option: 'startDate',
          value: invalidStartDate,
          expected: 'Valid Date object',
        },
      );

      expect(error.type).toBe(QuickurrenceErrorType.VALIDATION);
      expect(error.code).toBe(QuickurrenceErrorCode.INVALID_START_DATE);
      expect(error.getDetailedMessage()).toContain('startDate');
      expect(error.getDetailedMessage()).toContain('not-a-date');
    });

    it('should handle configuration error scenario', () => {
      const error = QuickurrenceError.configuration(
        'Cannot use both count and endDate options. Choose one approach to limit occurrences.',
        QuickurrenceErrorCode.CONFLICTING_OPTIONS,
        {
          details: { conflictingOptions: ['count', 'endDate'] },
        },
      );

      expect(error.type).toBe(QuickurrenceErrorType.CONFIGURATION);
      expect(error.code).toBe(QuickurrenceErrorCode.CONFLICTING_OPTIONS);
      expect(error.context?.details).toBeDefined();
    });

    it('should handle runtime error scenario', () => {
      const error = QuickurrenceError.runtime(
        'No more occurrences within the specified count limit',
        QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED,
        {
          operation: 'getNextOccurrence',
          details: { countLimit: 5, currentCount: 5 },
        },
      );

      expect(error.type).toBe(QuickurrenceErrorType.RUNTIME);
      expect(error.code).toBe(QuickurrenceErrorCode.COUNT_LIMIT_EXCEEDED);
      expect(error.context?.operation).toBe('getNextOccurrence');
    });

    it('should handle unsupported operation scenario', () => {
      const error = QuickurrenceError.unsupportedOperation(
        'getRule() is not supported for merged rules',
        QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
        {
          operation: 'getRule',
          rule: 'merged',
        },
      );

      expect(error.type).toBe(QuickurrenceErrorType.UNSUPPORTED_OPERATION);
      expect(error.code).toBe(
        QuickurrenceErrorCode.UNSUPPORTED_FOR_MERGED_RULES,
      );
    });
  });
});
