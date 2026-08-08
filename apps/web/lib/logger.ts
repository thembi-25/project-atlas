/**
 * Structured JSON logger. Emits one JSON object per line to stdout/stderr —
 * this is deliberately dependency-free: in Production, Vercel log drains
 * forward these lines to Axiom (see docs/10-devops/logging.md and
 * ADR-021), so the logger's only job is producing well-shaped, safe JSON,
 * not shipping the logs anywhere itself.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Field-name patterns that must never appear unredacted in a log line, even
// if a caller accidentally passes a secret in `context` — see
// docs/10-devops/logging.md, "Redaction".
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
  requestId?: string;
  organizationId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

function createLogger(minLevel: LogLevel, bindings: LogContext = {}): Logger {
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

/** Test-only factory so tests don't depend on process.env / module-level state. */
export function createLoggerForTests(minLevel: LogLevel = 'debug'): Logger {
  return createLogger(minLevel);
}
