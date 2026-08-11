// Structured logging utility for production monitoring
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  metadata?: Record<string, any>;
  stack?: string;
}

class Logger {
  private module: string;
  private isDevelopment: boolean;

  constructor(module: string) {
    this.module = module;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatLog(level: LogLevel, message: string, metadata?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      metadata,
    };
  }

  debug(message: string, metadata?: Record<string, any>) {
    if (this.isDevelopment) {
      console.log(`[${this.module}:DEBUG]`, message, metadata || '');
    }
  }

  info(message: string, metadata?: Record<string, any>) {
    const log = this.formatLog(LogLevel.INFO, message, metadata);
    console.log(`[${log.timestamp}] [${this.module}:INFO] ${message}`, metadata || '');
  }

  warn(message: string, metadata?: Record<string, any>) {
    const log = this.formatLog(LogLevel.WARN, message, metadata);
    console.warn(`[${log.timestamp}] [${this.module}:WARN] ${message}`, metadata || '');
  }

  error(message: string, error?: Error, metadata?: Record<string, any>) {
    const log = this.formatLog(LogLevel.ERROR, message, {
      ...metadata,
      error: error?.message,
      stack: error?.stack,
    });
    console.error(`[${log.timestamp}] [${this.module}:ERROR] ${message}`, error, metadata || '');
  }

  critical(message: string, error?: Error, metadata?: Record<string, any>) {
    const log = this.formatLog(LogLevel.CRITICAL, message, {
      ...metadata,
      error: error?.message,
      stack: error?.stack,
    });
    console.error(`[${log.timestamp}] [${this.module}:CRITICAL] ${message}`, error, metadata || '');
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}

export default Logger;
