/**
 * Structured JSON logger for the worker process — same shape/behavior as
 * apps/web/lib/logger.ts (see docs/10-devops/logging.md). Kept as a small,
 * independent copy rather than a shared package: the worker and the web
 * app are genuinely separate deployables (see ADR-016), and this is the
 * only piece of logic duplicated between them in Sprint 0.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const SECRET_KEY_PATTERN = /(key|token|secret|password|authorization)/i;

function redact(context: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!context) return context;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : value;
  }
  return redacted;
}

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

export function createLogger(minLevel: LogLevel, bindings: LogContext = {}): Logger {
  function write(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const line = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redact(bindings),
      ...redact(context),
    };

    const output = JSON.stringify(line);
    if (level === 'error' || level === 'warn') {
      // eslint-disable-next-line no-console
      console.error(output);
    } else {
      // eslint-disable-next-line no-console
      console.log(output);
    }
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
    child: (childBindings) => createLogger(minLevel, { ...bindings, ...childBindings }),
  };
}

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

export const logger = createLogger(resolveLogLevel());
