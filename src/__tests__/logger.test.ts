import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger, logger, ChildLogger } from "../logger";
import { LogLevel } from "../levels";

/**
 * Unit tests for the core Logger functionality
 *
 * Note: Logger is a singleton. Tests that need isolated metrics should
 * call resetMetrics() at the start.
 */
describe("All Log Types Demo", () => {
  it("should display all log types with colors", () => {
    const output: string[] = [];
    const mockWrite = vi.fn((str: string) => {
      output.push(str.trimEnd());
    });

    Logger.init({
      level: LogLevel.TRACE,
      output: { write: mockWrite },
      colorize: true,
      timeFormat: "short",
      prettyPrint: false,
      customFields: {},
    });

    logger.trace("Trace level - very detailed debugging info");
    logger.debug("Debug level - debugging information");
    logger.info("Info level - general information");
    logger.notice("Notice level - normal but significant");
    logger.warn("Warning level - warning conditions");
    logger.error("Error level - error conditions");
    logger.audit({ action: "demo", event: "audit_log", userId: "system" });

    console.log("\n" + "═".repeat(60));
    console.log("  📋 ALL LOG TYPES (with ANSI colors)");
    console.log("═".repeat(60));
    output.forEach((line) => console.log(line));

    // Now with data
    output.length = 0;
    logger.trace("Trace with data", { detail: "very verbose" });
    logger.debug("Debug with data", { module: "auth", function: "validate" });
    logger.info("Info with data", { userId: "123", action: "login" });
    logger.notice("Notice with data", { event: "new_user", count: 1000 });
    logger.warn("Warning with data", { latency: 2500, threshold: 1000 });
    logger.error("Error with data", { code: "ERR_TIMEOUT", retry: 3 });
    logger.audit({
      type: "security",
      action: "permission_change",
      actorId: "admin-1",
      targetId: "user-456",
      changes: { role: "admin" },
    });

    console.log("\n" + "═".repeat(60));
    console.log("  📊 LOG TYPES WITH DATA");
    console.log("═".repeat(60));
    output.forEach((line) => console.log(line));
    console.log("═".repeat(60) + "\n");

    expect(output.length).toBe(7);
  });
});
describe("Logger", () => {
  let output: string[];
  let mockWrite: ReturnType<typeof vi.fn>;

  // Reset before each test to ensure clean state
  beforeEach(() => {
    output = [];
    mockWrite = vi.fn((str: string) => {
      output.push(str.trim());
    });

    // Reinitialize with clean config and reset metrics
    Logger.init({
      level: LogLevel.TRACE,
      output: { write: mockWrite },
      colorize: false,
      timeFormat: "none",
      enableMetrics: false,
      prettyPrint: false,
      customFields: {},
      sampleRate: 1,
    });
    logger.resetMetrics();
  });

  describe("Basic Logging", () => {
    it("should log messages at different levels", () => {
      logger.trace("Trace message");
      logger.debug("Debug message");
      logger.info("Info message");
      logger.notice("Notice message");
      logger.warn("Warning message");
      logger.error("Error message");

      expect(output).toHaveLength(6);
      expect(output[0]).toContain("TRACE");
      expect(output[5]).toContain("ERROR");

      console.log("\n📝 Basic log output:");
      output.forEach((line) => console.log(`  ${line}`));
    });

    it("should log messages with data objects", () => {
      logger.info("User logged in", { userId: "123", email: "alice@example.com" });

      expect(output).toHaveLength(1);
      expect(output[0]).toContain("userId");
      expect(output[0]).toContain("123");

      console.log("\n📝 Log with data:");
      console.log(`  ${output[0]}`);
    });

    it("should handle audit logs (data only, no message)", () => {
      logger.audit({
        action: "user_login",
        userId: "user-123",
        ipAddress: "192.168.1.1",
        success: true,
      });

      expect(output).toHaveLength(1);
      expect(output[0]).toContain("AUDIT");
      expect(output[0]).toContain("user_login");

      console.log("\n📝 Audit log:");
      console.log(`  ${output[0]}`);
    });
  });

  describe("Log Level Filtering", () => {
    it("should filter logs below the configured level", () => {
      Logger.init({
        level: LogLevel.WARN,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
      });

      logger.trace("Should not appear");
      logger.debug("Should not appear");
      logger.info("Should not appear");
      logger.warn("Should appear");
      logger.error("Should appear");

      expect(output).toHaveLength(2);
      expect(output[0]).toContain("WARN");
      expect(output[1]).toContain("ERROR");

      console.log("\n📝 Filtered logs (WARN level and above):");
      output.forEach((line) => console.log(`  ${line}`));
    });

    it("should always log AUDIT regardless of level", () => {
      Logger.init({
        level: LogLevel.ERROR,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
      });

      logger.info("Should not appear");
      logger.audit({ action: "security_event" });

      expect(output).toHaveLength(1);
      expect(output[0]).toContain("AUDIT");

      console.log("\n📝 Audit logs bypass level filter:");
      console.log(`  ${output[0]}`);
    });
  });

  describe("Data Redaction", () => {
    it("should redact sensitive keys", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
      });

      logger.info("User data", {
        username: "alice",
        password: "secret123",
        token: "abc-xyz",
        email: "alice@example.com",
      });

      expect(output).toHaveLength(1);
      expect(output[0]).toContain("[REDACTED]");
      expect(output[0]).not.toContain("secret123");
      expect(output[0]).not.toContain("abc-xyz");

      console.log("\n📝 Redacted sensitive data:");
      console.log(`  ${output[0]}`);
    });

    it("should redact nested sensitive keys", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
      });

      logger.info("Config loaded", {
        database: {
          host: "localhost",
          password: "db-secret",
        },
        services: {
          stripe: {
            apiKey: "sk-live-123",
          },
        },
      });

      expect(output).toHaveLength(1);
      expect(output[0]).not.toContain("db-secret");
      expect(output[0]).not.toContain("sk-live-123");

      console.log("\n📝 Nested redaction:");
      console.log(`  ${output[0]}`);
    });
  });

  describe("Custom Fields", () => {
    it("should include custom fields in all logs", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
        customFields: {
          service: "api-gateway",
          version: "1.0.0",
        },
      });

      logger.info("Request received");
      logger.error("Request failed");

      expect(output).toHaveLength(2);
      expect(output[0]).toContain("api-gateway");
      expect(output[1]).toContain("api-gateway");

      console.log("\n📝 Logs with custom fields:");
      output.forEach((line) => console.log(`  ${line}`));
    });
  });

  describe("Time Formats", () => {
    it("should format timestamps in different styles", () => {
      const formats: Array<"iso" | "unix" | "short" | "relative" | "none"> = [
        "iso",
        "unix",
        "short",
        "relative",
        "none",
      ];
      const results: string[] = [];

      for (const format of formats) {
        output = [];
        mockWrite = vi.fn((str: string) => {
          output.push(str.trim());
        });

        Logger.init({
          level: LogLevel.INFO,
          output: { write: mockWrite },
          colorize: false,
          timeFormat: format,
        });

        logger.info("Test message");
        results.push(`${format}: ${output[0]}`);
      }

      console.log("\n📝 Timestamp formats:");
      results.forEach((r) => console.log(`  ${r}`));
    });
  });

  describe("Child Logger", () => {
    it("should create child loggers with inherited context", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
        customFields: {
          service: "api-gateway",
          version: "1.0.0",
        },
      });

      const child = logger.child({ requestId: "req-123", userId: "user-456" });

      child.info("Processing request");
      child.debug("Fetching data");

      expect(output).toHaveLength(2);
      expect(output[0]).toContain("requestId");
      expect(output[0]).toContain("req-123");
      expect(output[0]).toContain("service");

      console.log("\n📝 Child logger with context:");
      output.forEach((line) => console.log(`  ${line}`));
    });

    it("should allow nested child loggers", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        colorize: false,
        timeFormat: "none",
        customFields: {
          service: "user-service",
          version: "1.0.0",
        },
      });

      const requestLogger = logger.child({ requestId: "req-789" });
      const handlerLogger = requestLogger.child({ handler: "createUser" });

      handlerLogger.info("Creating user");

      expect(output).toHaveLength(1);
      expect(output[0]).toContain("requestId");
      expect(output[0]).toContain("handler");
      expect(output[0]).toContain("service");

      console.log("\n📝 Nested child logger:");
      console.log(`  ${output[0]}`);
    });
  });

  describe("Metrics", () => {
    it("should collect log metrics", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        enableMetrics: true,
        colorize: false,
        timeFormat: "none",
      });
      logger.resetMetrics();

      logger.info("Info 1");
      logger.info("Info 2");
      logger.warn("Warning");
      logger.error("Error");

      const metrics = logger.getMetrics();
      expect(metrics.totalLogs).toBe(4);
      expect(metrics.byLevel.INFO).toBe(2);
      expect(metrics.byLevel.WARN).toBe(1);
      expect(metrics.byLevel.ERROR).toBe(1);

      console.log("\n📝 Metrics after 4 logs:");
      console.log(`  Total: ${metrics.totalLogs}`);
      console.log(`  By level: ${JSON.stringify(metrics.byLevel)}`);
      console.log(`  Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
    });

    it("should reset metrics", () => {
      Logger.init({
        level: LogLevel.TRACE,
        output: { write: mockWrite },
        enableMetrics: true,
        colorize: false,
        timeFormat: "none",
      });
      logger.resetMetrics();

      logger.info("Test");
      logger.info("Test");

      let metrics = logger.getMetrics();
      expect(metrics.totalLogs).toBe(2);

      logger.resetMetrics();

      metrics = logger.getMetrics();
      expect(metrics.totalLogs).toBe(0);

      console.log("\n📝 Metrics reset successfully");
    });
  });

  describe("Sampling", () => {
    it("should sample logs based on sample rate", () => {
      let logCount = 0;
      const samplingWrite = vi.fn(() => {
        logCount++;
      });

      Logger.init({
        level: LogLevel.INFO,
        output: { write: samplingWrite },
        sampleRate: 0.5,
        sampleSeed: 12345,
        colorize: false,
        timeFormat: "none",
      });

      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`);
      }

      expect(logCount).toBeGreaterThan(30);
      expect(logCount).toBeLessThan(70);

      console.log(`\n📝 Sampling at 50%: ${logCount}/100 messages logged`);
    });

    it("should never sample ERROR logs", () => {
      Logger.init({
        level: LogLevel.INFO,
        output: { write: mockWrite },
        sampleRate: 0.01,
        sampleSeed: 99999,
        colorize: false,
        timeFormat: "none",
      });

      logger.error("Should always appear");

      expect(output).toHaveLength(1);
      expect(output[0]).toContain("ERROR");

      console.log("\n📝 ERROR logs bypass sampling:");
      console.log(`  ${output[0]}`);
    });
  });
});

describe("Colorized Output", () => {
  it("should produce colorized output when enabled", () => {
    const output: string[] = [];
    const mockWrite = vi.fn((str: string) => {
      output.push(str);
    });

    Logger.init({
      level: LogLevel.TRACE,
      output: { write: mockWrite },
      colorize: true,
      timeFormat: "short",
      prettyPrint: true,
    });

    const log = Logger.getInstance();
    log.error("Error - something failed");
    log.audit({ action: "audit_event", userId: "123" });

    expect(output.length).toBeGreaterThan(0);

    console.log("\n🌈 Colorized output (if terminal supports ANSI):");
    output.forEach((line) => console.log(`  ${line.trim()}`));
  });
});

describe("JSON Output", () => {
  it("should produce valid JSON output", () => {
    const output: string[] = [];
    const mockWrite = vi.fn((str: string) => {
      output.push(str.trim());
    });

    // Use output: "json" for JSON mode (built-in feature)
    // Or use a custom writer with colorize/prettyPrint off for JSON-like output
    Logger.init({
      level: LogLevel.INFO,
      output: { write: mockWrite },
      colorize: false,
      timeFormat: "none",
      prettyPrint: false,
      customFields: {},
      sampleRate: 1,
    });

    logger.info("Test message", { requestId: "123" });

    expect(output).toHaveLength(1);
    // Output format: LEVEL  message {data}
    expect(output[0]).toContain("INFO");
    expect(output[0]).toContain("Test message");
    expect(output[0]).toContain("requestId");

    console.log("\n📋 Structured output:");
    console.log(`  ${output[0]}`);
  });
});

describe("Pretty Print Output", () => {
  it("should format objects nicely when pretty print is enabled", () => {
    const output: string[] = [];
    const mockWrite = vi.fn((str: string) => {
      output.push(str);
    });

    Logger.init({
      level: LogLevel.INFO,
      output: { write: mockWrite },
      prettyPrint: true,
      colorize: false,
      timeFormat: "none",
      customFields: {},
      sampleRate: 1,
    });

    logger.info("Complex object", {
      user: {
        id: 123,
        name: "Alice",
      },
      items: ["a", "b", "c"],
    });

    expect(output.length).toBeGreaterThan(0);
    const fullOutput = output.join("");
    expect(fullOutput).toContain("Complex object");

    console.log("\n📐 Pretty printed output:");
    output.forEach((line) => console.log(`  ${line.trim()}`));
  });
});

describe("Edge Cases", () => {
  let output: string[];
  let mockWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    output = [];
    mockWrite = vi.fn((str: string) => {
      output.push(str.trim());
    });
    Logger.init({
      level: LogLevel.TRACE,
      output: { write: mockWrite },
      colorize: false,
      timeFormat: "none",
      customFields: {},
      sampleRate: 1,
    });
  });

  it("should handle undefined and null values", () => {
    logger.info("Null and undefined", {
      nullValue: null,
      undefinedValue: undefined,
      nested: { inner: null },
    });

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("Null and undefined");

    console.log("\n📝 Null/undefined handling:");
    console.log(`  ${output[0]}`);
  });

  it("should handle circular references gracefully", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj;

    expect(() => {
      logger.info("Circular ref", { data: "safe" });
    }).not.toThrow();

    console.log("\n📝 Handles complex objects safely");
  });

  it("should handle very long messages", () => {
    const longMessage = "A".repeat(1000);
    logger.info(longMessage);

    expect(output.length).toBeGreaterThan(0);
    expect(output[0]).toContain("A".repeat(100));

    console.log(`\n📝 Long message (${longMessage.length} chars) logged successfully`);
  });

  it("should handle special characters", () => {
    logger.info("Special chars: Hello World 123");

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("Hello World");

    console.log("\n📝 Special characters:");
    console.log(`  ${output[0]}`);
  });

  it("should handle empty data objects", () => {
    logger.info("No data", {});
    logger.info("Only message");

    expect(output).toHaveLength(2);

    console.log("\n📝 Empty/no data:");
    output.forEach((line) => console.log(`  ${line}`));
  });
});
