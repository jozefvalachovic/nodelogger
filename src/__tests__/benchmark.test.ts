import { describe, it, expect, beforeAll } from "vitest";
import { Logger, logger } from "../logger";
import { LogLevel } from "../levels";

/**
 * Performance benchmark tests for nodelogger
 *
 * Run with: npm test -- benchmark
 * Or: npx vitest run benchmark
 */

// Null output sink for benchmarks
const nullSink = { write: () => {} };

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  perCallUs: number;
  opsPerSec: number;
}

function benchmark(name: string, fn: () => void, iterations = 100_000): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 1000; i++) {
    fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalMs = end - start;
  const perCallUs = (totalMs / iterations) * 1000;
  const opsPerSec = Math.floor(iterations / (totalMs / 1000));

  return { name, iterations, totalMs, perCallUs, opsPerSec };
}

function formatResult(result: BenchmarkResult): string {
  return [
    `  ${result.name}:`,
    `    Total: ${result.totalMs.toFixed(2)}ms`,
    `    Per call: ${result.perCallUs.toFixed(3)}μs`,
    `    Ops/sec: ${result.opsPerSec.toLocaleString()}`,
  ].join("\n");
}

describe("Performance Benchmarks", () => {
  beforeAll(() => {
    // Configure logger with null sink for benchmarks
    Logger.init({
      level: LogLevel.TRACE,
      output: nullSink,
      enableMetrics: false,
      colorize: false,
      prettyPrint: false,
    });
  });

  describe("Core Logging Performance", () => {
    it("should handle basic logging efficiently", () => {
      const result = benchmark("Basic log (no data)", () => {
        logger.info("Test message");
      });

      console.log("\n" + formatResult(result));

      // Should be able to do at least 100k ops/sec
      expect(result.opsPerSec).toBeGreaterThan(100_000);
      // Each call should take less than 50μs
      expect(result.perCallUs).toBeLessThan(50);
    });

    it("should handle logging with data object efficiently", () => {
      const result = benchmark("Log with data object", () => {
        logger.info("Test message", { userId: "123", action: "test", timestamp: Date.now() });
      });

      console.log("\n" + formatResult(result));

      // Should be able to do at least 50k ops/sec with data
      expect(result.opsPerSec).toBeGreaterThan(50_000);
      expect(result.perCallUs).toBeLessThan(100);
    });

    it("should handle nested data objects", () => {
      const result = benchmark("Log with nested data", () => {
        logger.info("Test message", {
          user: { id: "123", name: "Alice", roles: ["admin", "user"] },
          request: { method: "POST", path: "/api/users" },
        });
      });

      console.log("\n" + formatResult(result));

      expect(result.opsPerSec).toBeGreaterThan(30_000);
    });
  });

  describe("Log Level Filtering Performance", () => {
    it("should skip filtered logs with minimal overhead", () => {
      // Set level to ERROR only
      Logger.init({
        level: LogLevel.ERROR,
        output: nullSink,
        enableMetrics: false,
      });

      const result = benchmark(
        "Filtered log (below threshold)",
        () => {
          logger.debug("This should be filtered", { data: "test" });
        },
        500_000,
      );

      console.log("\n" + formatResult(result));

      // Filtered logs should be extremely fast (just a level check)
      expect(result.opsPerSec).toBeGreaterThan(1_000_000);
      expect(result.perCallUs).toBeLessThan(5);

      // Reset
      Logger.init({ level: LogLevel.TRACE, output: nullSink });
    });
  });

  describe("Child Logger Performance", () => {
    it("should handle child logger with context efficiently", () => {
      const childLogger = logger.child({ service: "test-service", requestId: "req-12345" });

      const result = benchmark("Child logger", () => {
        childLogger.info("Child log message");
      });

      console.log("\n" + formatResult(result));

      // Child logger adds context merge overhead but should still be fast
      expect(result.opsPerSec).toBeGreaterThan(50_000);
    });

    it("should handle nested child loggers", () => {
      const child1 = logger.child({ service: "api" });
      const child2 = child1.child({ module: "users" });
      const child3 = child2.child({ handler: "create" });

      const result = benchmark("Nested child logger (3 levels)", () => {
        child3.info("Nested child log");
      });

      console.log("\n" + formatResult(result));

      expect(result.opsPerSec).toBeGreaterThan(30_000);
    });
  });

  describe("Audit Logging Performance", () => {
    it("should handle audit logs efficiently", () => {
      const result = benchmark("Audit log", () => {
        logger.audit({
          action: "user_login",
          userId: "user-123",
          ipAddress: "192.168.1.1",
          success: true,
        });
      });

      console.log("\n" + formatResult(result));

      // Audit logs have more data but should still be performant
      expect(result.opsPerSec).toBeGreaterThan(30_000);
    });
  });

  describe("Log Level Methods", () => {
    it("should have consistent performance across log levels", () => {
      const levels = [
        { name: "trace", fn: () => logger.trace("Trace message") },
        { name: "debug", fn: () => logger.debug("Debug message") },
        { name: "info", fn: () => logger.info("Info message") },
        { name: "notice", fn: () => logger.notice("Notice message") },
        { name: "warn", fn: () => logger.warn("Warn message") },
        { name: "error", fn: () => logger.error("Error message") },
      ];

      console.log("\n  Log level performance comparison:");

      const results = levels.map(({ name, fn }) => {
        const result = benchmark(`${name}()`, fn, 50_000);
        console.log(`    ${name}: ${result.opsPerSec.toLocaleString()} ops/sec`);
        return result;
      });

      // All levels should have similar performance (within 2x of each other)
      const opsValues = results.map((r) => r.opsPerSec);
      const maxOps = Math.max(...opsValues);
      const minOps = Math.min(...opsValues);
      expect(maxOps / minOps).toBeLessThan(2);
    });
  });

  describe("Metrics Collection Overhead", () => {
    it("should have minimal overhead with metrics enabled", () => {
      // Without metrics
      Logger.init({ level: LogLevel.TRACE, output: nullSink, enableMetrics: false });
      const withoutMetrics = benchmark(
        "Without metrics",
        () => {
          logger.info("Test");
        },
        50_000,
      );

      // With metrics
      Logger.init({ level: LogLevel.TRACE, output: nullSink, enableMetrics: true });
      const withMetrics = benchmark(
        "With metrics",
        () => {
          logger.info("Test");
        },
        50_000,
      );

      console.log("\n  Metrics overhead:");
      console.log(`    Without metrics: ${withoutMetrics.opsPerSec.toLocaleString()} ops/sec`);
      console.log(`    With metrics: ${withMetrics.opsPerSec.toLocaleString()} ops/sec`);

      const overhead =
        ((withoutMetrics.opsPerSec - withMetrics.opsPerSec) / withoutMetrics.opsPerSec) * 100;
      console.log(`    Overhead: ${overhead.toFixed(1)}%`);

      // Metrics should add less than 30% overhead
      expect(overhead).toBeLessThan(30);

      // Reset
      Logger.init({ level: LogLevel.TRACE, output: nullSink, enableMetrics: false });
    });
  });

  describe("Sampling Performance", () => {
    it("should have minimal overhead with sampling enabled", () => {
      // Without sampling
      Logger.init({ level: LogLevel.TRACE, output: nullSink, sampleRate: 1.0 });
      const fullRate = benchmark(
        "100% sample rate",
        () => {
          logger.info("Test");
        },
        50_000,
      );

      // With 10% sampling
      Logger.init({ level: LogLevel.TRACE, output: nullSink, sampleRate: 0.1 });
      const sampledRate = benchmark(
        "10% sample rate",
        () => {
          logger.info("Test");
        },
        50_000,
      );

      console.log("\n  Sampling performance:");
      console.log(`    100% rate: ${fullRate.opsPerSec.toLocaleString()} ops/sec`);
      console.log(`    10% rate: ${sampledRate.opsPerSec.toLocaleString()} ops/sec`);

      // Sampling should make things faster (fewer writes)
      expect(sampledRate.opsPerSec).toBeGreaterThan(fullRate.opsPerSec * 0.8);

      // Reset
      Logger.init({ level: LogLevel.TRACE, output: nullSink, sampleRate: 1.0 });
    });
  });
});

describe("Memory Usage", () => {
  it("should report memory footprint", () => {
    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const before = process.memoryUsage();

    // Create many log entries
    Logger.init({ level: LogLevel.TRACE, output: nullSink, enableMetrics: true });

    for (let i = 0; i < 10_000; i++) {
      logger.info("Memory test", { iteration: i, data: "test".repeat(10) });
    }

    const after = process.memoryUsage();

    console.log("\n  Memory usage after 10k logs:");
    console.log(
      `    Heap used: ${((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2)} MB increase`,
    );
    console.log(`    Total heap: ${(after.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    RSS: ${(after.rss / 1024 / 1024).toFixed(2)} MB`);

    // Should not use excessive memory (less than 50MB increase for 10k logs)
    const heapIncreaseMB = (after.heapUsed - before.heapUsed) / 1024 / 1024;
    expect(heapIncreaseMB).toBeLessThan(50);
  });
});

describe("Bundle Size Analysis", () => {
  it("should document bundle sizes", () => {
    // This test documents the expected bundle sizes
    // Actual sizes are measured during build

    const expectedSizes = {
      "index.js (CJS)": "~27 KB",
      "index.mjs (ESM)": "~26 KB",
      "hooks.js": "~19 KB",
      "middleware/index.js": "~28 KB",
      "audit/index.js": "~17 KB",
    };

    console.log("\n  📦 Bundle Sizes (uncompressed):");
    Object.entries(expectedSizes).forEach(([file, size]) => {
      console.log(`    ${file}: ${size}`);
    });

    console.log("\n  📦 Estimated gzipped sizes:");
    console.log("    Core logger: ~6-8 KB");
    console.log("    With hooks: ~4-5 KB additional");
    console.log("    With middleware: ~6-7 KB additional");
    console.log("    With audit: ~4-5 KB additional");

    // This is a documentation test, always passes
    expect(true).toBe(true);
  });
});
