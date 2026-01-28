/**
 * Log levels matching PyLogger's color scheme and hierarchy
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  NOTICE = 3,
  WARN = 4,
  ERROR = 5,
  AUDIT = 6,
  SILENT = 7,
}

export type LogLevelName = keyof typeof LogLevel;

/**
 * ANSI color codes matching PyLogger's color scheme
 */
export const Colors = {
  // Reset
  reset: "\x1b[0m",

  // Log level colors (matching PyLogger)
  trace: "\x1b[90m", // Gray
  debug: "\x1b[35m", // Purple/Magenta
  info: "\x1b[34m", // Blue
  notice: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  audit: "\x1b[1m\x1b[96m", // Bold Bright Cyan

  // Additional formatting
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Data colors
  string: "\x1b[32m", // Green
  number: "\x1b[33m", // Yellow
  boolean: "\x1b[35m", // Magenta
  null: "\x1b[90m", // Gray
  key: "\x1b[36m", // Cyan
} as const;

/**
 * Get color for a log level
 */
export function getLevelColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.TRACE:
      return Colors.trace;
    case LogLevel.DEBUG:
      return Colors.debug;
    case LogLevel.INFO:
      return Colors.info;
    case LogLevel.NOTICE:
      return Colors.notice;
    case LogLevel.WARN:
      return Colors.warn;
    case LogLevel.ERROR:
      return Colors.error;
    case LogLevel.AUDIT:
      return Colors.audit;
    default:
      return Colors.reset;
  }
}

/**
 * Get level name string
 */
export function getLevelName(level: LogLevel): string {
  return LogLevel[level] ?? "UNKNOWN";
}

/**
 * Parse log level from string or environment
 */
export function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return LogLevel.INFO;

  const normalized = value.toUpperCase().trim();

  if (normalized in LogLevel) {
    return LogLevel[normalized as keyof typeof LogLevel];
  }

  // Support numeric values
  const numeric = parseInt(normalized, 10);
  if (!isNaN(numeric) && numeric >= 0 && numeric <= 7) {
    return numeric as LogLevel;
  }

  return LogLevel.INFO;
}

/**
 * Check if a level should be logged given the minimum level
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return level >= minLevel;
}
