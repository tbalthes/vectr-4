import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const isDev = process.env.NODE_ENV === 'development' || process.env.FORCE_CONSOLE_LOGGER === '1';

/**
 * Lightweight console-based pretty logger used in development.
 * Keeps the same logger.* API shape used across the codebase:
 *   logger.info(meta, message)
 *   logger.error(meta, message)
 *   logger.warn(meta, message)
 *   logger.debug(meta, message)
 *
 * This avoids spawning worker threads (pino-pretty / thread-stream issues)
 * in dev environments like Next.js on Windows.
 */
function createConsoleLogger() {
  function formatOutput(level: string, meta?: any, msg?: string) {
    const time = new Date().toISOString();
    // If caller used logger.info('message') or logger.info('message', ...), normalize
    if (typeof meta === 'string' && !msg) {
      // logger.info('simple message')
      const out = { level, time, msg: meta };
      return JSON.stringify(out);
    }

    // If meta is an Error, convert to sanitized object
    if (meta instanceof Error) {
      meta = { error: meta.message, stack: meta.stack };
    }

    // Build canonical object: keep meta fields, include msg and time and level
    const out = Object.assign({}, meta || {}, { level, time, msg: msg || '' });
    return JSON.stringify(out);
  }

  return {
    info(meta?: any, msg?: string) {
      try {
        console.log(formatOutput('info', meta, msg));
      } catch {
        console.log(
          JSON.stringify({
            level: 'info',
            time: new Date().toISOString(),
            msg: String(meta) || String(msg),
          }),
        );
      }
    },
    warn(meta?: any, msg?: string) {
      try {
        console.warn(formatOutput('warn', meta, msg));
      } catch {
        console.warn(
          JSON.stringify({
            level: 'warn',
            time: new Date().toISOString(),
            msg: String(meta) || String(msg),
          }),
        );
      }
    },
    error(meta?: any, msg?: string) {
      try {
        console.error(formatOutput('error', meta, msg));
      } catch {
        console.error(
          JSON.stringify({
            level: 'error',
            time: new Date().toISOString(),
            msg: String(meta) || String(msg),
          }),
        );
      }
    },
    debug(meta?: any, msg?: string) {
      try {
        // Map debug to console.debug if available
        const output = formatOutput('debug', meta, msg);
        if (console.debug) {
          console.debug(output);
        } else {
          console.log(output);
        }
      } catch {
        console.log(
          JSON.stringify({
            level: 'debug',
            time: new Date().toISOString(),
            msg: String(meta) || String(msg),
          }),
        );
      }
    },
  };
}

/**
 * Create a pino logger for non-dev environments.
 * This emits compact JSON to stdout (good for production log collectors).
 */
function createPinoLogger() {
  return pino({
    level,
    base: { service: 'webhook-handler' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = isDev ? createConsoleLogger() : createPinoLogger();
export default logger;
