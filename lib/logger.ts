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
 * Truncate long content for logging purposes
 */
export function truncateContent(content: string, maxLength = 10000): string {
  if (content.length <= maxLength) {
    return content;
  }
  const truncated = content.slice(0, maxLength);
  const truncatedChars = content.length - maxLength;
  return `${truncated}[...truncated ${truncatedChars} chars]`;
}

/**
 * Default application logger instance
 */
const logger = createLogger("app");

export default logger;
