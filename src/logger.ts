import { LogLevel, shouldLog } from "./levels";
import { LoggerConfig, mergeConfig, PartialConfig } from "./config";
import { formatLogLine } from "./formatter";

/**
 * Check if we're running in a browser environment
 */
const isBrowser = typeof window !== "undefined";

/**
 * Log entry for batch processing
 */
interface LogEntry {
  level: LogLevel;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Metrics data structure
 */
export interface LogMetrics {
  totalLogs: number;
  byLevel: Record<string, number>;
  errorRate: number;
  lastLogTime: Date | null;
  avgLogsPerSecond: number;
}

/**
 * Logger class - main logging implementation
 */
export class Logger {
  private static instance: Logger | null = null;
  private config: LoggerConfig;
  private batch: LogEntry[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private metrics: LogMetrics = {
    totalLogs: 0,
    byLevel: {},
    errorRate: 0,
    lastLogTime: null,
    avgLogsPerSecond: 0,
  };
  private startTime: number = Date.now();
  private samplingRng: () => number;
  private isShuttingDown: boolean = false;

  private constructor(config: PartialConfig = {}) {
    this.config = mergeConfig(config);
    this.samplingRng = this.createSamplingRng();
    this.setupCleanupHandlers();
  }

  /**
   * Setup process cleanup handlers to prevent memory leaks
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      if (!this.isShuttingDown) {
        this.isShuttingDown = true;
        this.flushBatch();
      }
    };

    // Only set up process handlers in Node.js environment
    if (!isBrowser && typeof process !== "undefined") {
      process.on("beforeExit", cleanup);
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    }
  }

  /**
   * Initialize or reconfigure the logger
   */
  static init(config: PartialConfig = {}): Logger {
    if (Logger.instance) {
      Logger.instance.setConfig(config);
    } else {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Get the singleton logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Create a seeded RNG for deterministic sampling
   */
  private createSamplingRng(): () => number {
    if (this.config.sampleSeed !== undefined) {
      // Simple seeded PRNG (Mulberry32)
      let seed = this.config.sampleSeed;
      return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    return Math.random;
  }

  /**
   * Update logger configuration
   */
  setConfig(config: PartialConfig): void {
    this.config = mergeConfig({ ...this.config, ...config });
    this.samplingRng = this.createSamplingRng();
  }

  /**
   * Get current configuration (deep copy to prevent mutation)
   */
  getConfig(): Readonly<LoggerConfig> {
    return {
      ...this.config,
      redactKeys: [...this.config.redactKeys],
      customFields: { ...this.config.customFields },
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): LogMetrics {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return {
      ...this.metrics,
      avgLogsPerSecond: elapsed > 0 ? this.metrics.totalLogs / elapsed : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalLogs: 0,
      byLevel: {},
      errorRate: 0,
      lastLogTime: null,
      avgLogsPerSecond: 0,
    };
    this.startTime = Date.now();
  }

  /**
   * Check if message should be sampled
   */
  private shouldSample(): boolean {
    if (this.config.sampleRate >= 1.0) return true;
    if (this.config.sampleRate <= 0.0) return false;
    return this.samplingRng() < this.config.sampleRate;
  }

  /**
   * Update metrics for a log entry
   */
  private updateMetrics(level: LogLevel): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalLogs++;
    const levelName = LogLevel[level];
    this.metrics.byLevel[levelName] = (this.metrics.byLevel[levelName] || 0) + 1;
    this.metrics.lastLogTime = new Date();

    // Calculate error rate
    const errorCount = (this.metrics.byLevel["ERROR"] || 0) + (this.metrics.byLevel["WARN"] || 0);
    this.metrics.errorRate = this.metrics.totalLogs > 0 ? errorCount / this.metrics.totalLogs : 0;
  }

  /**
   * Write log output
   */
  private write(formatted: string): void {
    const output = this.config.output;

    // In browser, use console
    if (isBrowser) {
      console.log(formatted);
      return;
    }

    if (output === "stdout" || output === "json") {
      process.stdout.write(formatted + "\n");
    } else if (output === "stderr") {
      process.stderr.write(formatted + "\n");
    } else if (typeof output === "object" && "write" in output) {
      output.write(formatted + "\n");
    }
  }

  /**
   * Process a log entry
   */
  private processLog(level: LogLevel, message?: string, data?: Record<string, unknown>): void {
    // Check log level
    if (!shouldLog(level, this.config.level)) return;

    // Check sampling (except for AUDIT and ERROR)
    if (level !== LogLevel.AUDIT && level !== LogLevel.ERROR) {
      if (!this.shouldSample()) return;
    }

    // Update metrics
    this.updateMetrics(level);

    // Merge custom fields
    const mergedData = {
      ...this.config.customFields,
      ...data,
    };

    // Handle batch mode
    if (this.config.batchWrites) {
      this.batch.push({
        level,
        message,
        data: Object.keys(mergedData).length > 0 ? mergedData : undefined,
        timestamp: new Date(),
      });

      this.scheduleBatchFlush();
      return;
    }

    // Direct write
    const formatted = formatLogLine(level, message, mergedData, this.config);
    this.write(formatted);
  }

  /**
   * Schedule batch flush
   */
  private scheduleBatchFlush(): void {
    if (this.batch.length >= this.config.batchMaxSize) {
      this.flushBatch();
      return;
    }

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchFlushInterval);
    }
  }

  /**
   * Flush the log batch with error handling
   */
  flushBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const failedEntries: LogEntry[] = [];

    for (const entry of this.batch) {
      try {
        const formatted = formatLogLine(entry.level, entry.message, entry.data, this.config);
        this.write(formatted);
      } catch (error) {
        // Store failed entry for potential retry or error reporting
        failedEntries.push(entry);
        // Log to stderr as fallback
        if (isBrowser) {
          console.error(
            `[nodelogger] Failed to flush log entry: ${error instanceof Error ? error.message : String(error)}`,
          );
        } else if (typeof process !== "undefined" && process.stderr?.writable) {
          process.stderr.write(
            `[nodelogger] Failed to flush log entry: ${error instanceof Error ? error.message : String(error)}\n`,
          );
        }
      }
    }

    this.batch = failedEntries;
  }

  // Log level methods

  trace(message: string, data?: Record<string, unknown>): void {
    this.processLog(LogLevel.TRACE, message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.processLog(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.processLog(LogLevel.INFO, message, data);
  }

  notice(message: string, data?: Record<string, unknown>): void {
    this.processLog(LogLevel.NOTICE, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.processLog(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.processLog(LogLevel.ERROR, message, data);
  }

  /**
   * Audit log - structured data only, no message
   */
  audit(data: Record<string, unknown>): void {
    this.processLog(LogLevel.AUDIT, undefined, data);
  }

  /**
   * Log with explicit level
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.processLog(level, message, data);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with additional context
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>,
  ) {}

  private mergeData(data?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...data };
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.parent.trace(message, this.mergeData(data));
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeData(data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeData(data));
  }

  notice(message: string, data?: Record<string, unknown>): void {
    this.parent.notice(message, this.mergeData(data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeData(data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.parent.error(message, this.mergeData(data));
  }

  audit(data: Record<string, unknown>): void {
    this.parent.audit(this.mergeData(data));
  }

  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this.parent, { ...this.context, ...context });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
