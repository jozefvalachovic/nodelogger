/**
 * Enterprise audit logging examples
 */
import { AuditLogger, EventType, Outcome, Compliance, ExportFormat } from "../src/audit";

async function main() {
  // ============================================
  // 1. Basic audit logging
  // ============================================

  const basicAudit = new AuditLogger({
    serviceName: "user-service",
    serviceVersion: "1.0.0",
    environment: "development",
  });

  await basicAudit.log({
    type: EventType.AUTH,
    action: "user_login",
    outcome: Outcome.SUCCESS,
    actorId: "user-123",
    actorType: "user",
    actorIp: "192.168.1.100",
    description: "User successfully logged in",
    data: {
      mfaUsed: true,
      loginMethod: "password",
    },
  });

  // ============================================
  // 2. Compliance preset (SOC2)
  // ============================================

  const soc2Audit = AuditLogger.withCompliance(Compliance.SOC2, {
    serviceName: "payment-service",
    serviceVersion: "2.0.0",
    environment: "production",
  });

  // This will be hashed and chained for tamper detection
  await soc2Audit.log({
    type: EventType.DATA_MODIFY,
    action: "payment_processed",
    outcome: Outcome.SUCCESS,
    actorId: "user-456",
    resourceId: "payment-789",
    resourceType: "payment",
    description: "Payment processed successfully",
    durationMs: 234.5,
    data: {
      amount: 99.99,
      currency: "USD",
      method: "credit_card",
    },
  });

  // ============================================
  // 3. Shorthand methods
  // ============================================

  // Success event
  await soc2Audit.success(EventType.DATA_ACCESS, "document_viewed", {
    actorId: "user-123",
    resourceId: "doc-456",
    resourceType: "document",
    description: "User viewed document",
  });

  // Failure event
  await soc2Audit.failure(EventType.AUTHZ, "access_denied", new Error("Insufficient permissions"), {
    actorId: "user-789",
    resourceId: "admin-panel",
    resourceType: "page",
  });

  // ============================================
  // 4. Different event types
  // ============================================

  const audit = new AuditLogger();

  // Authentication event
  await audit.log({
    type: EventType.AUTH,
    action: "mfa_challenge",
    outcome: Outcome.SUCCESS,
    actorId: "user-123",
    description: "MFA challenge completed",
  });

  // Authorization event
  await audit.log({
    type: EventType.AUTHZ,
    action: "permission_check",
    outcome: Outcome.SUCCESS,
    actorId: "user-123",
    resourceId: "resource-456",
    description: "User authorized to access resource",
  });

  // Config change event
  await audit.log({
    type: EventType.CONFIG_CHANGE,
    action: "setting_updated",
    outcome: Outcome.SUCCESS,
    actorId: "admin-001",
    description: "System setting updated",
    data: {
      setting: "max_users",
      oldValue: 100,
      newValue: 200,
    },
  });

  // Admin action
  await audit.log({
    type: EventType.ADMIN_ACTION,
    action: "user_suspended",
    outcome: Outcome.SUCCESS,
    actorId: "admin-001",
    actorType: "admin",
    resourceId: "user-999",
    resourceType: "user",
    description: "User account suspended by admin",
    data: {
      reason: "Terms of service violation",
    },
  });

  // Security event
  await audit.log({
    type: EventType.SECURITY_EVENT,
    action: "suspicious_activity",
    outcome: Outcome.PENDING,
    actorId: "user-123",
    description: "Multiple failed login attempts detected",
    data: {
      failedAttempts: 5,
      ipAddresses: ["192.168.1.100", "10.0.0.1"],
    },
    tags: ["security", "alert", "high-priority"],
  });

  // ============================================
  // 5. Query audit logs
  // ============================================

  const result = await audit.query({
    eventTypes: [EventType.AUTH, EventType.AUTHZ],
    outcomes: [Outcome.SUCCESS],
    limit: 10,
    sort: "desc",
  });

  console.log(`\nQuery Results: ${result.total} entries found`);
  for (const entry of result.entries) {
    console.log(`  - ${entry.event.action} (${entry.event.outcome})`);
  }

  // ============================================
  // 6. Export audit logs
  // ============================================

  // Export to JSON
  // await audit.export("./audit-export.json", result.entries, ExportFormat.JSON);

  // Export to JSONL (one entry per line)
  // await audit.export("./audit-export.jsonl", result.entries, ExportFormat.JSONL);

  // Export to CSV
  // await audit.export("./audit-export.csv", result.entries, ExportFormat.CSV);

  // ============================================
  // 7. Verify chain integrity
  // ============================================

  const allEntries = await soc2Audit.query({ limit: 1000 });
  const verification = soc2Audit.verifyChain(allEntries.entries);

  console.log(`\nChain Verification: ${verification.valid ? "VALID ✓" : "INVALID ✗"}`);
  if (!verification.valid) {
    console.log(`  Error: ${verification.error}`);
    console.log(`  Broken at entry: ${verification.brokenAt}`);
  }

  // ============================================
  // 8. Custom sinks
  // ============================================

  const multiSinkAudit = new AuditLogger({
    serviceName: "multi-sink-demo",
    sinks: [
      { type: "console" },
      // { type: "file", path: "./logs/audit.jsonl" },
      // {
      //   type: "webhook",
      //   url: "https://siem.example.com/ingest",
      //   headers: { Authorization: "Bearer token" },
      // },
      {
        type: "custom",
        handler: async (entry) => {
          // Custom handling - send to monitoring, etc.
          console.log(`Custom sink received: ${entry.event.action}`);
        },
      },
    ],
  });

  await multiSinkAudit.log({
    type: EventType.SYSTEM,
    action: "multi_sink_test",
    outcome: Outcome.SUCCESS,
    description: "Testing multi-sink configuration",
  });

  // Cleanup
  await audit.close();
  await soc2Audit.close();
  await basicAudit.close();
  await multiSinkAudit.close();

  console.log("\n✅ All audit examples completed!");
}

main().catch(console.error);
