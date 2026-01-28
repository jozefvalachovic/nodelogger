import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  BaseMiddlewareConfig,
  mergeMiddlewareConfig,
  shouldSkipPath,
  getLogLevelForStatus,
  generateRequestId,
  middlewareMetrics,
} from "./base";

/**
 * Express-specific middleware configuration
 */
export interface ExpressMiddlewareConfig extends BaseMiddlewareConfig {
  /** Log request headers */
  logHeaders?: string[];

  /** Log query parameters */
  logQueryParams?: boolean;

  /** Log request body */
  logBody?: boolean;

  /** Maximum body size to log (bytes) */
  maxBodySize?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      requestStartTime?: number;
    }
  }
}

/**
 * Create Express logging middleware
 *
 * @example
 * import express from "express";
 * import { expressMiddleware } from "nodelogger/middleware";
 *
 * const app = express();
 * app.use(expressMiddleware({
 *   skipPaths: ["/health"],
 *   enableMetrics: true,
 * }));
 */
export function expressMiddleware(config: ExpressMiddlewareConfig = {}): RequestHandler {
  const mergedConfig = mergeMiddlewareConfig(config);
  const log = mergedConfig.logger;
  const logHeaders = config.logHeaders ?? [];
  const logQueryParams = config.logQueryParams ?? false;
  const logBody = config.logBody ?? false;
  const maxBodySize = config.maxBodySize ?? 10000;

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    // Skip configured paths
    if (shouldSkipPath(path, mergedConfig)) {
      return next();
    }

    const startTime = performance.now();

    // Generate or extract request ID
    let requestId = "";
    if (mergedConfig.requestId) {
      requestId =
        (req.headers[mergedConfig.requestIdHeader.toLowerCase()] as string) ?? generateRequestId();
      req.requestId = requestId;
      req.requestStartTime = startTime;
    }

    // Log request start for debugging
    if (log.getConfig().level <= 1) {
      const logData: Record<string, unknown> = {
        method: req.method,
        path,
        ...mergedConfig.customFields,
      };

      if (requestId) {
        logData.requestId = requestId;
      }

      if (logQueryParams && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }

      if (logHeaders.length > 0) {
        const headers: Record<string, string> = {};
        for (const header of logHeaders) {
          const value = req.headers[header.toLowerCase()];
          if (value && typeof value === "string") {
            headers[header] = value;
          }
        }
        if (Object.keys(headers).length > 0) {
          logData.headers = headers;
        }
      }

      if (logBody && req.body) {
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr.length <= maxBodySize) {
          logData.body = req.body;
        } else {
          logData.body = "[TRUNCATED]";
        }
      }

      log.debug("Request started", logData);
    }

    // Capture original end to log response
    const originalEnd = res.end;
    const originalJson = res.json;

    let responseBody: unknown;

    // Override json to capture response body
    res.json = function (body: unknown) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // Override end to log on completion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (this: Response, ...args: any[]): Response {
      const durationMs = performance.now() - startTime;
      const statusCode = res.statusCode;

      // Log the request
      const level = getLogLevelForStatus(statusCode, mergedConfig);
      const logData: Record<string, unknown> = {
        ...mergedConfig.customFields,
      };

      if (requestId) {
        logData.requestId = requestId;
        res.setHeader(mergedConfig.requestIdHeader, requestId);
      }

      // Log response body on errors
      if (mergedConfig.logResponseBody && statusCode >= 400 && responseBody) {
        logData.responseBody = responseBody;
      }

      log.log(level, `${req.method} ${path} [${statusCode}] ${durationMs.toFixed(3)}ms`, logData);

      // Record metrics
      if (mergedConfig.enableMetrics) {
        middlewareMetrics.recordRequest(req.method, statusCode, durationMs);
      }

      // Audit logging
      if (mergedConfig.enableAudit && mergedConfig.auditMethods.includes(req.method)) {
        log.audit({
          action: "http_request",
          method: req.method,
          path,
          statusCode,
          durationMs: parseFloat(durationMs.toFixed(3)),
          requestId,
          ip: req.ip ?? req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"],
          ...mergedConfig.customFields,
        });
      }

      // Call original end - use type assertion for complex overloads
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalEnd as any).apply(this, args);
    };

    next();
  };
}

/**
 * Error handling middleware for Express
 *
 * @example
 * app.use(expressErrorMiddleware());
 */
export function expressErrorMiddleware(config: ExpressMiddlewareConfig = {}) {
  const mergedConfig = mergeMiddlewareConfig(config);
  const log = mergedConfig.logger;

  // Note: Express error handlers require all 4 parameters to be recognized as error middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: Error, req: Request, _res: Response, next: NextFunction) => {
    const durationMs = req.requestStartTime ? performance.now() - req.requestStartTime : 0;

    log.error(`${req.method} ${req.path} [500] ${durationMs.toFixed(3)}ms`, {
      error: err.message,
      stack: err.stack,
      requestId: req.requestId,
      ...mergedConfig.customFields,
    });

    // Record metrics
    if (mergedConfig.enableMetrics) {
      middlewareMetrics.recordRequest(req.method, 500, durationMs);
    }

    // Audit logging
    if (mergedConfig.enableAudit && mergedConfig.auditMethods.includes(req.method)) {
      log.audit({
        action: "http_error",
        method: req.method,
        path: req.path,
        statusCode: 500,
        error: err.message,
        requestId: req.requestId,
        ...mergedConfig.customFields,
      });
    }

    next(err);
  };
}

/**
 * Get request ID from request
 */
export function getRequestId(req: Request): string | undefined {
  return req.requestId;
}

/**
 * Get request start time from request
 */
export function getRequestStartTime(req: Request): number | undefined {
  return req.requestStartTime;
}
