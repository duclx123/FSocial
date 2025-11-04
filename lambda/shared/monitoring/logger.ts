/**
 * Structured JSON logging utility for Lambda functions
 * Provides consistent log formatting with levels, metadata, and correlation IDs
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogMetadata {
  [key: string]: any;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  functionVersion?: string;
  traceId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};
  private logLevel: LogLevel;

  constructor() {
    // Set log level from environment variable (defaults to INFO)
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.logLevel = (envLogLevel && LogLevel[envLogLevel as keyof typeof LogLevel]) || LogLevel.INFO;
  }

  /**
   * Set context that will be included in all subsequent logs
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear the logging context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Initialize logger from Lambda event
   */
  initFromEvent(event: any): void {
    const requestId = event.requestContext?.requestId;
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const traceId = process.env._X_AMZN_TRACE_ID;

    this.setContext({
      requestId,
      userId,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      traceId
    });
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...metadata
    };

    // Use console methods based on level with circular reference handling
    const seen = new WeakSet();
    const output = JSON.stringify(logEntry, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        // Handle circular references
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    });
    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.DEBUG:
      default:
        console.log(output);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any, metadata?: LogMetadata): void {
    const errorMetadata = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
        ...error
      }
    } : {};

    this.log(LogLevel.ERROR, message, { ...errorMetadata, ...metadata });
  }

  /**
   * Log the start of a Lambda function execution
   */
  logFunctionStart(functionName: string, event: any): void {
    this.info(`Lambda function started: ${functionName}`, {
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        resource: event.resource,
        queryStringParameters: event.queryStringParameters
      }
    });
  }

  /**
   * Log the end of a Lambda function execution
   */
  logFunctionEnd(functionName: string, statusCode: number, duration?: number): void {
    this.info(`Lambda function completed: ${functionName}`, {
      statusCode,
      durationMs: duration
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, metadata?: LogMetadata): void {
    this.info(`Performance metric: ${operation}`, {
      operation,
      durationMs: duration,
      ...metadata
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, table: string, duration?: number, metadata?: LogMetadata): void {
    this.debug(`Database operation: ${operation}`, {
      operation,
      table,
      durationMs: duration,
      ...metadata
    });
  }

  /**
   * Log external API call
   */
  logApiCall(service: string, operation: string, duration?: number, metadata?: LogMetadata): void {
    this.debug(`External API call: ${service}.${operation}`, {
      service,
      operation,
      durationMs: duration,
      ...metadata
    });
  }

  /**
   * Log business metric
   */
  logBusinessMetric(metric: string, value: number, unit?: string, metadata?: LogMetadata): void {
    this.info(`Business metric: ${metric}`, {
      metric,
      value,
      unit,
      ...metadata
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: LogMetadata): void {
    this.warn(`Security event: ${event}`, {
      securityEvent: event,
      severity,
      ...metadata
    });
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Helper to measure execution time
 */
export async function measureTime<T>(
  operation: string,
  fn: () => Promise<T>,
  logResult: boolean = true
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    if (logResult) {
      logger.logPerformance(operation, duration, { success: true });
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.logPerformance(operation, duration, { success: false });
    throw error;
  }
}

/**
 * Helper to create a child logger with additional context
 */
export function createChildLogger(additionalContext: LogContext): Logger {
  const childLogger = new Logger();
  childLogger.setContext({ ...logger.getContext(), ...additionalContext });
  return childLogger;
}
