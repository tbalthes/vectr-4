import 'server-only';

import pino from 'pino';

/**
 * Structured JSON logger with full context fields
 * as outlined in WBS section 7.1.1
 */

const level = process.env.LOG_LEVEL || 'info';
const isDev = process.env.NODE_ENV === 'development' || process.env.FORCE_CONSOLE_LOGGER === '1';

export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  itemId?: string;
  aggregator?: string;
  event?: string;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  performance?: {
    spans?: {
      name: string;
      duration: number;
      metadata?: Record<string, any>;
    }[];
    totalDuration?: number;
  };
  metadata?: Record<string, any>;
  // Allow additional fields for specific logging contexts
  [key: string]: any;
}

/**
 * Enhanced console logger with structured JSON output for development
 */
function createStructuredConsoleLogger() {
  function formatOutput(level: string, context?: LogContext | string, message?: string) {
    const timestamp = new Date().toISOString();
    
    // Handle simple string message
    if (typeof context === 'string' && !message) {
      return JSON.stringify({
        level,
        timestamp,
        msg: context,
        service: 'vectr-api',
        version: process.env.npm_package_version || 'unknown',
      });
    }

    // Handle Error objects
    if (context instanceof Error) {
      context = {
        error: {
          message: context.message,
          stack: context.stack,
          code: (context as any).code,
        }
      };
    }

    // Build structured log entry
    const logEntry: any = {
      level,
      timestamp,
      msg: message || 'Log entry',
      service: 'vectr-api',
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...(typeof context === 'object' && context !== null && !(context instanceof Error) ? context : {}),
    };

    // Add correlation fields if available
    if (typeof context === 'object' && context?.requestId) {
      logEntry.correlation = { requestId: context.requestId };
    }

    return JSON.stringify(logEntry, null, isDev ? 2 : 0);
  }

  return {
    info(context?: LogContext | string, message?: string) {
      try {
        console.log(formatOutput('info', context, message));
      } catch (err) {
        console.log(JSON.stringify({
          level: 'info',
          timestamp: new Date().toISOString(),
          msg: 'Failed to format log entry',
          error: { message: String(err) },
          originalContext: typeof context === 'object' ? JSON.stringify(context) : String(context),
        }));
      }
    },

    warn(context?: LogContext | string, message?: string) {
      try {
        console.warn(formatOutput('warn', context, message));
      } catch (err) {
        console.warn(JSON.stringify({
          level: 'warn',
          timestamp: new Date().toISOString(),
          msg: 'Failed to format log entry',
          error: { message: String(err) },
          originalContext: typeof context === 'object' ? JSON.stringify(context) : String(context),
        }));
      }
    },

    error(context?: LogContext | string, message?: string) {
      try {
        console.error(formatOutput('error', context, message));
      } catch (err) {
        console.error(JSON.stringify({
          level: 'error',
          timestamp: new Date().toISOString(),
          msg: 'Failed to format log entry',
          error: { message: String(err) },
          originalContext: typeof context === 'object' ? JSON.stringify(context) : String(context),
        }));
      }
    },

    debug(context?: LogContext | string, message?: string) {
      try {
        const output = formatOutput('debug', context, message);
        if (console.debug) {
          console.debug(output);
        } else {
          console.log(output);
        }
      } catch (err) {
        console.log(JSON.stringify({
          level: 'debug',
          timestamp: new Date().toISOString(),
          msg: 'Failed to format log entry',
          error: { message: String(err) },
          originalContext: typeof context === 'object' ? JSON.stringify(context) : String(context),
        }));
      }
    },
  };
}

/**
 * Enhanced Pino logger for production with structured fields
 */
function createStructuredPinoLogger() {
  const pinoLogger = pino({
    level,
    base: { 
      service: 'vectr-api',
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'production',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    serializers: {
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  });

  return {
    info(context?: LogContext | string, message?: string) {
      if (typeof context === 'string') {
        pinoLogger.info(context);
      } else {
        pinoLogger.info(context || {}, message || 'Log entry');
      }
    },

    warn(context?: LogContext | string, message?: string) {
      if (typeof context === 'string') {
        pinoLogger.warn(context);
      } else {
        pinoLogger.warn(context || {}, message || 'Log entry');
      }
    },

    error(context?: LogContext | string, message?: string) {
      if (typeof context === 'string') {
        pinoLogger.error(context);
      } else {
        pinoLogger.error(context || {}, message || 'Log entry');
      }
    },

    debug(context?: LogContext | string, message?: string) {
      if (typeof context === 'string') {
        pinoLogger.debug(context);
      } else {
        pinoLogger.debug(context || {}, message || 'Log entry');
      }
    },
  };
}

/**
 * Create a child logger with default context
 */
export function createChildLogger(defaultContext: Partial<LogContext>) {
  return {
    info(context?: LogContext | string, message?: string) {
      const mergedContext = typeof context === 'string' 
        ? { ...defaultContext, msg: context }
        : { ...defaultContext, ...context };
      logger.info(mergedContext, message);
    },

    warn(context?: LogContext | string, message?: string) {
      const mergedContext = typeof context === 'string' 
        ? { ...defaultContext, msg: context }
        : { ...defaultContext, ...context };
      logger.warn(mergedContext, message);
    },

    error(context?: LogContext | string, message?: string) {
      const mergedContext = typeof context === 'string' 
        ? { ...defaultContext, msg: context }
        : { ...defaultContext, ...context };
      logger.error(mergedContext, message);
    },

    debug(context?: LogContext | string, message?: string) {
      const mergedContext = typeof context === 'string' 
        ? { ...defaultContext, msg: context }
        : { ...defaultContext, ...context };
      logger.debug(mergedContext, message);
    },
  };
}

export const logger = isDev ? createStructuredConsoleLogger() : createStructuredPinoLogger();
export default logger;
