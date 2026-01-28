import { LogLevel, Colors, getLevelColor, getLevelName } from "./levels";
import type { LoggerConfig } from "./config";

/**
 * Format a timestamp according to the config
 */
export function formatTimestamp(config: LoggerConfig): string {
  const now = new Date();

  switch (config.timeFormat) {
    case "iso":
      return now.toISOString();
    case "unix":
      return Math.floor(now.getTime() / 1000).toString();
    case "relative":
      return `+${process.uptime().toFixed(3)}s`;
    case "short":
      return now.toTimeString().slice(0, 8);
    case "none":
      return "";
    default:
      return now.toISOString();
  }
}

/**
 * Format a log level with optional color
 */
export function formatLevel(level: LogLevel, colorize: boolean): string {
  const name = getLevelName(level).padEnd(6);

  if (colorize) {
    return `${getLevelColor(level)}${name}${Colors.reset}`;
  }

  return name;
}

/**
 * Redact sensitive keys from an object
 */
export function redactSensitiveData(
  data: Record<string, unknown>,
  redactKeys: string[],
  mask: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = redactKeys.some(
      (k) => lowerKey === k.toLowerCase() || lowerKey.includes(k.toLowerCase()),
    );

    if (shouldRedact) {
      result[key] = mask;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactSensitiveData(value as Record<string, unknown>, redactKeys, mask);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object"
          ? redactSensitiveData(item as Record<string, unknown>, redactKeys, mask)
          : item,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Format a value for colorized output
 */
export function formatValue(value: unknown, colorize: boolean, indent: number = 0): string {
  if (value === null) {
    return colorize ? `${Colors.null}null${Colors.reset}` : "null";
  }

  if (value === undefined) {
    return colorize ? `${Colors.null}undefined${Colors.reset}` : "undefined";
  }

  if (typeof value === "string") {
    const escaped = JSON.stringify(value);
    return colorize ? `${Colors.string}${escaped}${Colors.reset}` : escaped;
  }

  if (typeof value === "number") {
    return colorize ? `${Colors.number}${value}${Colors.reset}` : String(value);
  }

  if (typeof value === "boolean") {
    return colorize ? `${Colors.boolean}${value}${Colors.reset}` : String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";

    const items = value.map((v) => formatValue(v, colorize, indent + 2));
    const padding = " ".repeat(indent + 2);
    return `[\n${padding}${items.join(`,\n${padding}`)}\n${" ".repeat(indent)}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";

    const padding = " ".repeat(indent + 2);
    const lines = entries.map(([k, v]) => {
      const key = colorize ? `${Colors.key}"${k}"${Colors.reset}` : `"${k}"`;
      return `${padding}${key}: ${formatValue(v, colorize, indent + 2)}`;
    });

    return `{\n${lines.join(",\n")}\n${" ".repeat(indent)}}`;
  }

  if (typeof value === "function") {
    return colorize
      ? `${Colors.dim}[Function: ${value.name || "anonymous"}]${Colors.reset}`
      : `[Function: ${value.name || "anonymous"}]`;
  }

  return String(value);
}

/**
 * Format data object for structured logging output
 */
export function formatData(data: Record<string, unknown>, config: LoggerConfig): string {
  const redacted = redactSensitiveData(data, config.redactKeys, config.redactMask);

  if (config.output === "json" || !config.prettyPrint) {
    return JSON.stringify(redacted);
  }

  return formatValue(redacted, config.colorize, 0);
}

/**
 * Format a complete log line
 */
export function formatLogLine(
  level: LogLevel,
  message: string | undefined,
  data: Record<string, unknown> | undefined,
  config: LoggerConfig,
): string {
  // JSON output mode
  if (config.output === "json") {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: getLevelName(level),
      ...config.customFields,
    };

    if (message) {
      entry.message = message;
    }

    if (data && Object.keys(data).length > 0) {
      const redacted = redactSensitiveData(data, config.redactKeys, config.redactMask);
      Object.assign(entry, redacted);
    }

    return JSON.stringify(entry);
  }

  // Human-readable output
  const parts: string[] = [];

  // Timestamp
  const timestamp = formatTimestamp(config);
  if (timestamp) {
    parts.push(config.colorize ? `${Colors.dim}${timestamp}${Colors.reset}` : timestamp);
  }

  // Level
  parts.push(formatLevel(level, config.colorize));

  // Message
  if (message) {
    parts.push(message);
  }

  // Data
  if (data && Object.keys(data).length > 0) {
    parts.push(formatData(data, config));
  }

  return parts.join(" ");
}

/**
 * Format HTTP request log (middleware style)
 */
export function formatHttpLog(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  config: LoggerConfig,
  extra?: Record<string, unknown>,
): string {
  const level =
    statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

  if (config.output === "json") {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: getLevelName(level),
      method,
      path,
      statusCode,
      durationMs: parseFloat(durationMs.toFixed(3)),
      ...config.customFields,
      ...extra,
    });
  }

  const statusColor =
    statusCode >= 500 ? Colors.error : statusCode >= 400 ? Colors.warn : Colors.info;

  const formattedStatus = config.colorize
    ? `${statusColor}[${statusCode}]${Colors.reset}`
    : `[${statusCode}]`;

  const formattedDuration = config.colorize
    ? `${Colors.dim}${durationMs.toFixed(3)}ms${Colors.reset}`
    : `${durationMs.toFixed(3)}ms`;

  const parts = [
    formatTimestamp(config),
    formatLevel(level, config.colorize),
    method,
    path,
    formattedStatus,
    formattedDuration,
  ].filter(Boolean);

  if (extra && Object.keys(extra).length > 0) {
    parts.push(formatData(extra, config));
  }

  return parts.join(" ");
}
