export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  timestamp?: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  correlationId?: string;
  requestId?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private static correlationId: string | null = null;

  static setCorrelationId(id: string) {
    this.correlationId = id;
  }

  static getCorrelationId(): string | null {
    return this.correlationId;
  }

  static clearCorrelationId() {
    this.correlationId = null;
  }

  private formatLog(context: LogContext): string {
    const timestamp = context.timestamp || new Date().toISOString();
    const correlationId = context.correlationId || Logger.getCorrelationId() || 'N/A';
    const contextStr = context.context ? JSON.stringify(context.context) : '';
    const errorStr = context.error ? ` | Error: ${context.error.message}` : '';
    return `[${timestamp}] [${context.level.toUpperCase()}] [CID:${correlationId}] ${context.message} ${contextStr} ${errorStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const logContext: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      correlationId: Logger.getCorrelationId() || undefined,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
    };

    const formatted = this.formatLog(logContext);

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context, error);
  }
}

export const logger = new Logger();
