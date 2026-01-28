import { LogLevel, parseLogLevel } from "./levels";

/**
 * Output destination for logs
 */
export type LogOutput = "stdout" | "stderr" | "json" | NodeJS.WritableStream;

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;

  /** Output destination */
  output: LogOutput;

  /** Enable colorized output */
  colorize: boolean;

  /** Time format for timestamps */
  timeFormat: "iso" | "unix" | "relative" | "short" | "none";

  /** Keys to redact from output */
  redactKeys: string[];

  /** Mask to use for redacted values */
  redactMask: string;

  /** Sample rate for logs (0.0 - 1.0) */
  sampleRate: number;

  /** Seed for deterministic sampling */
  sampleSeed?: number;

  /** Enable async/batched writes */
  batchWrites: boolean;

  /** Batch flush interval in milliseconds */
  batchFlushInterval: number;

  /** Maximum batch size before flush */
  batchMaxSize: number;

  /** Enable metrics collection */
  enableMetrics: boolean;

  /** Prefix for metrics */
  metricsPrefix: string;

  /** Include caller location in logs */
  includeLocation: boolean;

  /** Custom fields to add to every log */
  customFields: Record<string, unknown>;

  /** Pretty print JSON output */
  prettyPrint: boolean;

  /** Indent size for pretty printing */
  indentSize: number;

  /** React-specific: log render counts */
  logRenderCount: boolean;

  /** React-specific: log Suspense boundaries */
  logSuspenseBoundaries: boolean;
}

/**
 * Default configuration
 */
export const defaultConfig: LoggerConfig = {
  level: parseLogLevel(process.env.LOG_LEVEL),
  output: "stdout",
  colorize: process.env.NODE_ENV !== "production" && process.stdout.isTTY === true,
  timeFormat: "short",
  redactKeys: ["password", "token", "secret", "apiKey", "api_key", "authorization"],
  redactMask: "[REDACTED]",
  sampleRate: 1.0,
  sampleSeed: undefined,
  batchWrites: false,
  batchFlushInterval: 100,
  batchMaxSize: 100,
  enableMetrics: false,
  metricsPrefix: "nodelogger",
  includeLocation: process.env.NODE_ENV !== "production",
  customFields: {},
  prettyPrint: process.env.NODE_ENV !== "production",
  indentSize: 2,
  logRenderCount: false,
  logSuspenseBoundaries: false,
};

/**
 * Partial configuration for updates
 */
export type PartialConfig = Partial<LoggerConfig>;

/**
 * Merge configuration with defaults
 */
export function mergeConfig(config: PartialConfig): LoggerConfig {
  return {
    ...defaultConfig,
    ...config,
  };
}

/**
 * Create configuration from environment variables
 */
export function configFromEnv(): PartialConfig {
  const env = process.env;

  return {
    level: parseLogLevel(env.LOG_LEVEL),
    colorize: env.LOG_COLORIZE !== "false" && env.NODE_ENV !== "production",
    output: (env.LOG_OUTPUT as LogOutput) ?? "stdout",
    sampleRate: env.LOG_SAMPLE_RATE ? parseFloat(env.LOG_SAMPLE_RATE) : 1.0,
    prettyPrint: env.LOG_PRETTY !== "false" && env.NODE_ENV !== "production",
  };
}
