// Core logger
export { Logger, ChildLogger, logger } from "./logger";
export type { LogMetrics } from "./logger";

// Configuration
export { defaultConfig, mergeConfig, configFromEnv } from "./config";
export type { LoggerConfig, PartialConfig, LogOutput } from "./config";

// Log levels
export { LogLevel, Colors, getLevelColor, getLevelName, parseLogLevel, shouldLog } from "./levels";
export type { LogLevelName } from "./levels";

// Formatter
export {
  formatTimestamp,
  formatLevel,
  formatValue,
  formatData,
  formatLogLine,
  formatHttpLog,
  redactSensitiveData,
} from "./formatter";

// Wrappers
export { wrapFunction, wrapAsync, wrapComponent, loggerWrapper } from "./wrapper";
export type { WrapperOptions } from "./wrapper";

// Decorators
export { Log, LogMethod, LogClass } from "./decorators";
export type { LogDecoratorOptions, AuditDecoratorOptions } from "./decorators";

// Default export: the universal wrapper function
export { loggerWrapper as default } from "./wrapper";
