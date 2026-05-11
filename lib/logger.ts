import pino, { type Logger, type LoggerOptions } from "pino";

/**
 * Get log level from environment variable or use default
 */
function getLogLevel(): string {
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel) {
    return envLevel;
  }
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

/**
 * Create a pino logger instance with module name
 */
export function createLogger(name: string): Logger {
  const isDevelopment = process.env.NODE_ENV === "development";

  const options: LoggerOptions = {
    name,
    level: getLogLevel(),
  };

  if (isDevelopment) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    };
  }

  return pino(options);
}

/**
 * Create a child logger with additional bindings for context (e.g., traceId)
 */
export function createChildLogger(
  parentLogger: Logger,
  bindings: Record<string, unknown>,
): Logger {
  return parentLogger.child(bindings);
}

/**
 * Default application logger instance
 */
const logger = createLogger("app");

export default logger;
