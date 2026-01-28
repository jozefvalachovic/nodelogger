/**
 * Express middleware examples
 */
import { Logger, LogLevel } from "../src";
import {
  expressMiddleware,
  expressErrorMiddleware,
  getRequestId,
  middlewareMetrics,
} from "../src/middleware";

// Initialize logger
Logger.init({
  level: LogLevel.DEBUG,
  colorize: true,
  enableMetrics: true,
});

// ============================================
// Express App Setup Example
// ============================================

/*
import express from "express";

const app = express();

// Parse JSON bodies
app.use(express.json());

// Add logging middleware
app.use(expressMiddleware({
  skipPaths: ["/health", "/ready"],
  skipPathPrefixes: ["/static"],
  requestId: true,
  requestIdHeader: "X-Request-ID",
  logHeaders: ["Authorization", "Content-Type"],
  logQueryParams: true,
  enableMetrics: true,
  enableAudit: true,
  auditMethods: ["POST", "PUT", "DELETE"],
  customFields: {
    service: "my-express-api",
    version: "1.0.0",
  },
}));

// Health check (skipped by middleware)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.get("/api/users", (req, res) => {
  // Access request ID
  const requestId = getRequestId(req);
  console.log(`Processing request: ${requestId}`);

  res.json({
    users: [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ],
    requestId,
  });
});

app.get("/api/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({ id, name: "Alice" });
});

app.post("/api/users", (req, res) => {
  const body = req.body;
  res.status(201).json({ id: "3", ...body });
});

app.delete("/api/users/:id", (req, res) => {
  res.status(204).send();
});

// Error route (for testing)
app.get("/api/error", (req, res) => {
  throw new Error("Something went wrong!");
});

// Error handling middleware
app.use(expressErrorMiddleware({
  enableAudit: true,
}));

// Fallback error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    requestId: getRequestId(req),
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/

// ============================================
// Metrics Endpoint Example
// ============================================

/*
app.get("/metrics", (req, res) => {
  const logMetrics = logger.getMetrics();
  const httpMetrics = middlewareMetrics.getMetrics();

  res.json({
    logging: {
      totalLogs: logMetrics.totalLogs,
      errorRate: logMetrics.errorRate,
      byLevel: logMetrics.byLevel,
    },
    http: {
      totalRequests: httpMetrics.totalRequests,
      requestsPerSecond: httpMetrics.requestsPerSecond,
      avgDurationMs: httpMetrics.avgDurationMs,
      byStatus: httpMetrics.byStatus,
      byMethod: httpMetrics.byMethod,
      errorRate: httpMetrics.errorRate,
    },
  });
});
*/

// Demo output
console.log(`
Express Middleware Example
==========================

This file shows how to integrate NodeLogger with Express.

Key features:
- Request/response logging with timing
- Request ID generation/propagation
- Audit logging for mutations
- Metrics collection
- Error handling

To use in your Express app:

1. Install dependencies:
   npm install express

2. Import and use middleware:
   import { expressMiddleware, expressErrorMiddleware } from "nodelogger/middleware";
   
   app.use(expressMiddleware({ ... }));
   app.use(expressErrorMiddleware());

3. Access request context:
   import { getRequestId } from "nodelogger/middleware";
   const requestId = getRequestId(req);

Example output:
  10:04:12 INFO   GET /api/users [200] 15.234ms { requestId: "abc123" }
  10:04:13 INFO   POST /api/users [201] 23.456ms { requestId: "def456" }
  10:04:14 WARN   GET /api/notfound [404] 1.234ms { requestId: "ghi789" }
  10:04:15 ERROR  GET /api/error [500] 0.567ms { requestId: "jkl012", error: "..." }

✅ See the commented code above for full implementation.
`);
