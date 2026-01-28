// Base middleware utilities
export {
  defaultMiddlewareConfig,
  mergeMiddlewareConfig,
  shouldSkipPath,
  getLogLevelForStatus,
  generateRequestId,
  middlewareMetrics,
} from "./base";
export type { BaseMiddlewareConfig, MiddlewareMetrics } from "./base";

// Next.js middleware
export { createNextMiddleware, withLogging, withServerAction } from "./next";
export type { NextMiddlewareConfig, ServerActionConfig } from "./next";

// Express middleware
export {
  expressMiddleware,
  expressErrorMiddleware,
  getRequestId,
  getRequestStartTime,
} from "./express";
export type { ExpressMiddlewareConfig } from "./express";
