/**
 * Custom error types for the Quickurrence library
 */
export enum QuickurrenceErrorType {
  // Validation errors for invalid input parameters
  VALIDATION = 'VALIDATION',

  // Configuration errors for invalid rule configurations
  CONFIGURATION = 'CONFIGURATION',

  // Runtime errors that occur during execution
  RUNTIME = 'RUNTIME',

  // Errors for operations not supported in certain contexts
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',

  // Errors related to date/time processing
  DATE_TIME = 'DATE_TIME',

  // Errors related to recurrence rules
  RECURRENCE_RULE = 'RECURRENCE_RULE',
}

/**
 * Error codes for more specific error identification
 */
export enum QuickurrenceErrorCode {
  // Validation error codes
  INVALID_START_DATE = 'INVALID_START_DATE',
  INVALID_END_DATE = 'INVALID_END_DATE',
  INVALID_TIMEZONE = 'INVALID_TIMEZONE',
  INVALID_INTERVAL = 'INVALID_INTERVAL',
  INVALID_COUNT = 'INVALID_COUNT',
  INVALID_WEEK_STARTS_ON = 'INVALID_WEEK_STARTS_ON',
  INVALID_WEEKDAYS = 'INVALID_WEEKDAYS',
  INVALID_MONTH_DAY = 'INVALID_MONTH_DAY',
  INVALID_MONTH_DAY_MODE = 'INVALID_MONTH_DAY_MODE',
  INVALID_NTH_WEEKDAY = 'INVALID_NTH_WEEKDAY',
  INVALID_EXCLUDE_DATES = 'INVALID_EXCLUDE_DATES',
  INVALID_CONDITION = 'INVALID_CONDITION',

  // Configuration error codes
  UNSUPPORTED_RULE = 'UNSUPPORTED_RULE',
  UNSUPPORTED_PRESET = 'UNSUPPORTED_PRESET',
  CONFLICTING_OPTIONS = 'CONFLICTING_OPTIONS',
  INCOMPATIBLE_OPTIONS = 'INCOMPATIBLE_OPTIONS',
  EMPTY_REQUIRED_ARRAY = 'EMPTY_REQUIRED_ARRAY',

  // Runtime error codes
  NO_MORE_OCCURRENCES = 'NO_MORE_OCCURRENCES',
  COUNT_LIMIT_EXCEEDED = 'COUNT_LIMIT_EXCEEDED',
  END_DATE_EXCEEDED = 'END_DATE_EXCEEDED',

  // Unsupported operation codes
  UNSUPPORTED_FOR_MERGED_RULES = 'UNSUPPORTED_FOR_MERGED_RULES',
  MISSING_REQUIRED_OPTION = 'MISSING_REQUIRED_OPTION',

  // Date/time error codes
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  DATE_BEFORE_START = 'DATE_BEFORE_START',

  // Generic error codes
  UNKNOWN = 'UNKNOWN',
}

/**
 * Additional context that can be provided with errors
 */
export type QuickurrenceErrorContext = {
  /** The recurrence rule being processed when error occurred */
  rule?: string;
  /** The specific option/parameter that caused the error */
  option?: string;
  /** The invalid value that was provided */
  value?: unknown;
  /** Expected value or format */
  expected?: string;
  /** Additional details about the error */
  details?: Record<string, unknown>;
  /** The operation being performed when error occurred */
  operation?: string;
};

/**
 * Custom error class for the Quickurrence library
 *
 * Provides structured error handling with error types, codes, and additional context
 *
 * @example
 * ```typescript
 * throw new QuickurrenceError(
 *   'Invalid start date provided',
 *   QuickurrenceErrorType.VALIDATION,
 *   QuickurrenceErrorCode.INVALID_START_DATE,
 *   {
 *     option: 'startDate',
 *     value: invalidDate,
 *     expected: 'Valid Date object'
 *   }
 * );
 * ```
 */
export class QuickurrenceError extends Error {
  /** The type/category of the error */
  public readonly type: QuickurrenceErrorType;

  /** Specific error code for programmatic handling */
  public readonly code: QuickurrenceErrorCode;

  /** Additional context about the error */
  public readonly context?: QuickurrenceErrorContext;

  /** Timestamp when the error was created */
  public readonly timestamp: Date;

  constructor(
    message: string,
    type: QuickurrenceErrorType = QuickurrenceErrorType.RUNTIME,
    code: QuickurrenceErrorCode = QuickurrenceErrorCode.UNKNOWN,
    context?: QuickurrenceErrorContext,
  ) {
    super(message);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, QuickurrenceError.prototype);

    this.name = 'QuickurrenceError';
    this.type = type;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();

    // Capture stack trace if available (V8 engines)
    if ('captureStackTrace' in Error) {
      (Error as { captureStackTrace: (target: object, constructor: Function) => void }).captureStackTrace(this, QuickurrenceError);
    }
  }

  /**
   * Create a validation error
   */
  static validation(
    message: string,
    code: QuickurrenceErrorCode,
    context?: QuickurrenceErrorContext,
  ): QuickurrenceError {
    return new QuickurrenceError(
      message,
      QuickurrenceErrorType.VALIDATION,
      code,
      context,
    );
  }

  /**
   * Create a configuration error
   */
  static configuration(
    message: string,
    code: QuickurrenceErrorCode,
    context?: QuickurrenceErrorContext,
  ): QuickurrenceError {
    return new QuickurrenceError(
      message,
      QuickurrenceErrorType.CONFIGURATION,
      code,
      context,
    );
  }

  /**
   * Create a runtime error
   */
  static runtime(
    message: string,
    code: QuickurrenceErrorCode,
    context?: QuickurrenceErrorContext,
  ): QuickurrenceError {
    return new QuickurrenceError(
      message,
      QuickurrenceErrorType.RUNTIME,
      code,
      context,
    );
  }

  /**
   * Create an unsupported operation error
   */
  static unsupportedOperation(
    message: string,
    code: QuickurrenceErrorCode,
    context?: QuickurrenceErrorContext,
  ): QuickurrenceError {
    return new QuickurrenceError(
      message,
      QuickurrenceErrorType.UNSUPPORTED_OPERATION,
      code,
      context,
    );
  }

  /**
   * Create a date/time error
   */
  static dateTime(
    message: string,
    code: QuickurrenceErrorCode,
    context?: QuickurrenceErrorContext,
  ): QuickurrenceError {
    return new QuickurrenceError(
      message,
      QuickurrenceErrorType.DATE_TIME,
      code,
      context,
    );
  }

  /**
   * Create a recurrence rule error
   */
  static recurrenceRule(
    message: string,
    code: QuickurrenceErrorCode,
    context?: QuickurrenceErrorContext,
  ): QuickurrenceError {
    return new QuickurrenceError(
      message,
      QuickurrenceErrorType.RECURRENCE_RULE,
      code,
      context,
    );
  }

  /**
   * Check if an error is a QuickurrenceError
   */
  static isQuickurrenceError(error: unknown): error is QuickurrenceError {
    return error instanceof QuickurrenceError;
  }

  /**
   * Check if an error is of a specific type
   */
  static isType(error: unknown, type: QuickurrenceErrorType): boolean {
    return QuickurrenceError.isQuickurrenceError(error) && error.type === type;
  }

  /**
   * Check if an error has a specific code
   */
  static hasCode(error: unknown, code: QuickurrenceErrorCode): boolean {
    return QuickurrenceError.isQuickurrenceError(error) && error.code === code;
  }

  /**
   * Convert error to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Get a formatted error message with additional context
   */
  getDetailedMessage(): string {
    let message = this.message;

    if (this.context) {
      const details: string[] = [];

      if (this.context.option) {
        details.push(`Option: ${this.context.option}`);
      }

      if (this.context.value !== undefined) {
        details.push(`Value: ${JSON.stringify(this.context.value)}`);
      }

      if (this.context.expected) {
        details.push(`Expected: ${this.context.expected}`);
      }

      if (this.context.operation) {
        details.push(`Operation: ${this.context.operation}`);
      }

      if (details.length > 0) {
        message += ` (${details.join(', ')})`;
      }
    }

    return message;
  }
}
