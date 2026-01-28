import type { NextRequest, NextResponse } from "next/server";
import { Logger } from "../logger";
import {
  BaseMiddlewareConfig,
  mergeMiddlewareConfig,
  shouldSkipPath,
  getLogLevelForStatus,
  generateRequestId,
  middlewareMetrics,
} from "./base";

/**
 * Next.js specific middleware configuration
 */
export interface NextMiddlewareConfig extends BaseMiddlewareConfig {
  /** Headers to log */
  logHeaders?: string[];

  /** Log query parameters */
  logQueryParams?: boolean;
}

/**
 * Create Next.js middleware with logging
 *
 * @example
 * // middleware.ts
 * import { createNextMiddleware } from "nodelogger/middleware";
 *
 * export const middleware = createNextMiddleware({
 *   skipPaths: ["/api/health"],
 *   enableAudit: true,
 * });
 *
 * export const config = {
 *   matcher: ["/api/:path*", "/dashboard/:path*"],
 * };
 */
export function createNextMiddleware(config: NextMiddlewareConfig = {}) {
  const mergedConfig = mergeMiddlewareConfig(config);
  const log = mergedConfig.logger;
  const logHeaders = config.logHeaders ?? [];
  const logQueryParams = config.logQueryParams ?? false;

  return async function middleware(
    request: NextRequest,
  ): Promise<NextResponse | Response | undefined> {
    const { pathname, search } = request.nextUrl;

    // Skip configured paths
    if (shouldSkipPath(pathname, mergedConfig)) {
      return undefined;
    }

    const startTime = performance.now();

    // Generate or extract request ID
    let requestId = "";
    if (mergedConfig.requestId) {
      requestId = request.headers.get(mergedConfig.requestIdHeader) ?? generateRequestId();
    }

    // Log request start for debugging
    if (log.getConfig().level <= 1) {
      // DEBUG level
      const logData: Record<string, unknown> = {
        method: request.method,
        path: pathname,
        startTime,
        ...mergedConfig.customFields,
      };

      if (requestId) {
        logData.requestId = requestId;
      }

      if (logQueryParams && search) {
        logData.query = search;
      }

      if (logHeaders.length > 0) {
        const headers: Record<string, string> = {};
        for (const header of logHeaders) {
          const value = request.headers.get(header);
          if (value) {
            headers[header] = value;
          }
        }
        if (Object.keys(headers).length > 0) {
          logData.headers = headers;
        }
      }

      log.debug("Request started", logData);
    }

    // Audit logging for specific methods
    if (mergedConfig.enableAudit && mergedConfig.auditMethods.includes(request.method)) {
      log.audit({
        action: "http_request",
        method: request.method,
        path: pathname,
        requestId,
        ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
        ...mergedConfig.customFields,
      });
    }

    // Return undefined to continue to route handlers
    // The actual logging happens in the route handler wrapper
    return undefined;
  };
}

/**
 * Wrap a Next.js API route handler with logging
 *
 * @example
 * // app/api/users/route.ts
 * import { withLogging } from "nodelogger/middleware";
 *
 * async function GET(request: NextRequest) {
 *   return Response.json({ users: [] });
 * }
 *
 * export const GET = withLogging(GET);
 */
export function withLogging<
  T extends (request: NextRequest, context?: unknown) => Promise<Response>,
>(handler: T, config: NextMiddlewareConfig = {}): T {
  const mergedConfig = mergeMiddlewareConfig(config);
  const log = mergedConfig.logger;

  return (async (request: NextRequest, context?: unknown): Promise<Response> => {
    const { pathname } = request.nextUrl;

    // Skip configured paths
    if (shouldSkipPath(pathname, mergedConfig)) {
      return handler(request, context);
    }

    const startTime = performance.now();

    // Generate or extract request ID
    let requestId = "";
    if (mergedConfig.requestId) {
      requestId = request.headers.get(mergedConfig.requestIdHeader) ?? generateRequestId();
    }

    try {
      const response = await handler(request, context);
      const durationMs = performance.now() - startTime;

      // Log the request
      const level = getLogLevelForStatus(response.status, mergedConfig);
      const logData: Record<string, unknown> = {
        ...mergedConfig.customFields,
      };

      if (requestId) {
        logData.requestId = requestId;
      }

      log.log(
        level,
        `${request.method} ${pathname} [${response.status}] ${durationMs.toFixed(3)}ms`,
        logData,
      );

      // Record metrics
      if (mergedConfig.enableMetrics) {
        middlewareMetrics.recordRequest(request.method, response.status, durationMs);
      }

      // Audit logging for responses
      if (mergedConfig.enableAudit && mergedConfig.auditMethods.includes(request.method)) {
        log.audit({
          action: "http_response",
          method: request.method,
          path: pathname,
          statusCode: response.status,
          durationMs: parseFloat(durationMs.toFixed(3)),
          requestId,
          ...mergedConfig.customFields,
        });
      }

      // Add request ID header to response
      if (requestId) {
        const headers = new Headers(response.headers);
        headers.set(mergedConfig.requestIdHeader, requestId);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch (error) {
      const durationMs = performance.now() - startTime;

      log.error(`${request.method} ${pathname} [500] ${durationMs.toFixed(3)}ms`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestId,
        ...mergedConfig.customFields,
      });

      // Record metrics for errors
      if (mergedConfig.enableMetrics) {
        middlewareMetrics.recordRequest(request.method, 500, durationMs);
      }

      throw error;
    }
  }) as T;
}

/**
 * Wrap a Next.js Server Action with logging
 *
 * @example
 * // app/actions.ts
 * "use server";
 * import { withServerAction } from "nodelogger/middleware";
 *
 * async function createUser(formData: FormData) {
 *   // ...
 * }
 *
 * export const createUser = withServerAction(createUser, {
 *   name: "createUser",
 *   logArgs: true,
 * });
 */
export interface ServerActionConfig {
  /** Action name for logging */
  name?: string;

  /** Log function arguments */
  logArgs?: boolean;

  /** Log return value */
  logReturn?: boolean;

  /** Keys to redact */
  redact?: string[];

  /** Enable audit logging */
  enableAudit?: boolean;

  /** Custom logger */
  logger?: Logger;
}

export function withServerAction<T extends (...args: unknown[]) => Promise<unknown>>(
  action: T,
  config: ServerActionConfig = {},
): T {
  const log = config.logger ?? Logger.getInstance();
  const actionName = config.name ?? action.name ?? "serverAction";

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const startTime = performance.now();

    // Log action call
    const logData: Record<string, unknown> = {};
    if (config.logArgs && args.length > 0) {
      // Handle FormData specially
      const processedArgs = args.map((arg) => {
        if (arg instanceof FormData) {
          const obj: Record<string, unknown> = {};
          arg.forEach((value, key) => {
            if (config.redact?.includes(key)) {
              obj[key] = "[REDACTED]";
            } else if (value instanceof File) {
              obj[key] = `[File: ${value.name}]`;
            } else {
              obj[key] = value;
            }
          });
          return obj;
        }
        return arg;
      });
      logData.args = processedArgs;
    }

    log.debug(`[ServerAction:${actionName}] called`, logData);

    try {
      const result = await action(...args);
      const durationMs = performance.now() - startTime;

      const resultLog: Record<string, unknown> = {
        durationMs: durationMs.toFixed(3),
      };
      if (config.logReturn && result !== undefined) {
        resultLog.result = result;
      }

      log.debug(`[ServerAction:${actionName}] completed`, resultLog);

      // Audit logging
      if (config.enableAudit) {
        log.audit({
          action: "server_action",
          name: actionName,
          outcome: "success",
          durationMs: parseFloat(durationMs.toFixed(3)),
        });
      }

      return result as Awaited<ReturnType<T>>;
    } catch (error) {
      const durationMs = performance.now() - startTime;

      log.error(`[ServerAction:${actionName}] failed`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: durationMs.toFixed(3),
      });

      // Audit logging for failures
      if (config.enableAudit) {
        log.audit({
          action: "server_action",
          name: actionName,
          outcome: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: parseFloat(durationMs.toFixed(3)),
        });
      }

      throw error;
    }
  }) as T;
}
