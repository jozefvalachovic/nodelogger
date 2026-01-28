import { Logger } from "../logger";
import { LogLevel } from "../levels";
import { formatHttpLog } from "../formatter";

/**
 * Base middleware configuration
 */
export interface BaseMiddlewareConfig {
  /** Log request body on errors */
  logBodyOnErrors?: boolean;

  /** Log response body on errors */
  logResponseBody?: boolean;

  /** Generate/extract request IDs */
  requestId?: boolean;

  /** Header name for request ID */
  requestIdHeader?: string;

  /** Exact paths to skip logging */
  skipPaths?: string[];

  /** Path prefixes to skip logging */
  skipPathPrefixes?: string[];

  /** Custom log levels per status code */
  logLevels?: Record<number, LogLevel>;

  /** Enable audit event emission */
  enableAudit?: boolean;

  /** HTTP methods to audit */
  auditMethods?: string[];

  /** Enable metrics collection */
  enableMetrics?: boolean;

  /** Custom fields to add to every log */
  customFields?: Record<string, unknown>;

  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Default middleware configuration
 */
export const defaultMiddlewareConfig: Required<BaseMiddlewareConfig> = {
  logBodyOnErrors: true,
  logResponseBody: false,
  requestId: true,
  requestIdHeader: "X-Request-ID",
  skipPaths: ["/health", "/ready", "/healthz", "/readyz"],
  skipPathPrefixes: ["/metrics"],
  logLevels: {
    400: LogLevel.WARN,
    401: LogLevel.WARN,
    403: LogLevel.WARN,
    404: LogLevel.WARN,
    500: LogLevel.ERROR,
    502: LogLevel.ERROR,
    503: LogLevel.ERROR,
  },
  enableAudit: false,
  auditMethods: ["POST", "PUT", "PATCH", "DELETE"],
  enableMetrics: false,
  customFields: {},
  logger: Logger.getInstance(),
};

/**
 * Merge config with defaults
 */
export function mergeMiddlewareConfig(
  config: BaseMiddlewareConfig,
): Required<BaseMiddlewareConfig> {
  return {
    ...defaultMiddlewareConfig,
    ...config,
    logger: config.logger ?? defaultMiddlewareConfig.logger,
  };
}

/**
 * Check if a path should be skipped
 */
export function shouldSkipPath(path: string, config: Required<BaseMiddlewareConfig>): boolean {
  // Check exact matches
  if (config.skipPaths.includes(path)) {
    return true;
  }

  // Check prefixes
  for (const prefix of config.skipPathPrefixes) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Get log level for status code
 */
export function getLogLevelForStatus(
  statusCode: number,
  config: Required<BaseMiddlewareConfig>,
): LogLevel {
  // Check exact status code
  if (config.logLevels[statusCode] !== undefined) {
    return config.logLevels[statusCode];
  }

  // Check status code ranges
  if (statusCode >= 500) return LogLevel.ERROR;
  if (statusCode >= 400) return LogLevel.WARN;
  return LogLevel.INFO;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Metrics collector for middleware
 */
export class MiddlewareMetrics {
  private requests: number = 0;
  private byStatus: Map<number, number> = new Map();
  private byMethod: Map<string, number> = new Map();
  private totalDuration: number = 0;
  private startTime: number = Date.now();

  recordRequest(method: string, statusCode: number, durationMs: number): void {
    this.requests++;
    this.byStatus.set(statusCode, (this.byStatus.get(statusCode) ?? 0) + 1);
    this.byMethod.set(method, (this.byMethod.get(method) ?? 0) + 1);
    this.totalDuration += durationMs;
  }

  getMetrics(): {
    totalRequests: number;
    requestsPerSecond: number;
    avgDurationMs: number;
    byStatus: Record<number, number>;
    byMethod: Record<string, number>;
    errorRate: number;
  } {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const errorCount = Array.from(this.byStatus.entries())
      .filter(([status]) => status >= 400)
      .reduce((sum, [, count]) => sum + count, 0);

    return {
      totalRequests: this.requests,
      requestsPerSecond: elapsed > 0 ? this.requests / elapsed : 0,
      avgDurationMs: this.requests > 0 ? this.totalDuration / this.requests : 0,
      byStatus: Object.fromEntries(this.byStatus),
      byMethod: Object.fromEntries(this.byMethod),
      errorRate: this.requests > 0 ? errorCount / this.requests : 0,
    };
  }

  reset(): void {
    this.requests = 0;
    this.byStatus.clear();
    this.byMethod.clear();
    this.totalDuration = 0;
    this.startTime = Date.now();
  }
}

// Global metrics instance
export const middlewareMetrics = new MiddlewareMetrics();

export { formatHttpLog };
