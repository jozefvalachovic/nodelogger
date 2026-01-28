/**
 * Basic usage examples for NodeLogger
 */
import { Logger, logger, LogLevel } from "../src";

// Initialize logger with custom config
Logger.init({
  level: LogLevel.DEBUG,
  colorize: true,
  timeFormat: "short",
  enableMetrics: true,
});

// Basic logging
logger.trace("Very detailed trace message");
logger.debug("Debugging information", { variable: "value" });
logger.info("Application started", { port: 3000, env: "development" });
logger.notice("New user registered", { userId: "123" });
logger.warn("High memory usage", { usedMb: 450, limitMb: 512 });
logger.error("Database connection failed", {
  error: "ECONNREFUSED",
  host: "localhost",
  port: 5432,
});

// Audit logging (structured data only)
logger.audit({
  action: "user_login",
  userId: "user-123",
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  success: true,
  mfaUsed: true,
});

// Child logger with context
const requestLogger = logger.child({
  requestId: "req-abc-123",
  userId: "user-456",
});

requestLogger.info("Processing payment");
requestLogger.debug("Validating card", { lastFour: "4242" });
requestLogger.info("Payment completed", { amount: 99.99, currency: "USD" });

// Get metrics
const metrics = logger.getMetrics();
console.log("\nLog Metrics:");
console.log(JSON.stringify(metrics, null, 2));
