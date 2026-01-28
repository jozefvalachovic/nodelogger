import { randomUUID } from "crypto";
import { AuditEvent, AuditEntry, AuditQuery, AuditQueryResult, ExportFormat } from "./types";
import { AuditConfig, mergeAuditConfig, withCompliance } from "./config";
import { HashChain } from "./chain";
import { MemoryStore, FileStore, SinkWriter, AuditStore, exportEntries } from "./store";

/**
 * Enterprise Audit Logger
 *
 * @example
 * const audit = new AuditLogger(AuditConfig.withCompliance(Compliance.SOC2));
 *
 * audit.log({
 *   type: EventType.AUTH,
 *   action: "user_login",
 *   outcome: Outcome.SUCCESS,
 *   actorId: "user-123",
 * });
 */
export class AuditLogger {
  private config: AuditConfig;
  private chain: HashChain | null = null;
  private store: AuditStore;
  private sinkWriter: SinkWriter;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = mergeAuditConfig(config);

    // Initialize hash chain if enabled
    if (this.config.hashChain) {
      this.chain = new HashChain(this.config.hashAlgorithm);
    }

    // Initialize store based on configuration
    this.store = this.createStore();

    // Initialize sink writer
    this.sinkWriter = new SinkWriter(this.config.sinks);
  }

  /**
   * Create the appropriate store based on configuration
   */
  private createStore(): AuditStore {
    const storeConfig = this.config.store;

    if (!storeConfig || storeConfig.type === "memory") {
      return new MemoryStore(storeConfig?.maxSize);
    }

    if (storeConfig.type === "file") {
      if (!storeConfig.filePath) {
        throw new Error("File store requires filePath configuration");
      }
      return new FileStore(storeConfig.filePath, {
        bufferSize: storeConfig.bufferSize ?? this.config.bufferSize,
        flushInterval: storeConfig.flushInterval ?? this.config.flushInterval,
      });
    }

    // Default to memory store
    return new MemoryStore();
  }

  /**
   * Create logger with compliance preset
   */
  static withCompliance(
    compliance: Parameters<typeof withCompliance>[0],
    overrides?: Parameters<typeof withCompliance>[1],
  ): AuditLogger {
    return new AuditLogger(withCompliance(compliance, overrides));
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      event: {
        ...event,
        // Normalize actor info
        actor: event.actor ?? {
          id: event.actorId,
          type: event.actorType,
          ip: event.actorIp,
        },
        // Normalize resource info
        resource: event.resource ?? {
          id: event.resourceId,
          type: event.resourceType,
        },
      },
      service: {
        name: this.config.serviceName,
        version: this.config.serviceVersion,
        environment: this.config.environment,
      },
    };

    // Add hash chain if enabled
    if (this.chain) {
      entry.chain = this.chain.addEntry(entry);
    }

    // Write to store
    await this.store.write(entry);

    // Write to sinks
    await this.sinkWriter.write(entry);

    return entry;
  }

  /**
   * Log a success event (shorthand)
   */
  async success(
    type: AuditEvent["type"],
    action: string,
    data?: Partial<Omit<AuditEvent, "type" | "action" | "outcome">>,
  ): Promise<AuditEntry> {
    return this.log({
      type,
      action,
      outcome: "success" as AuditEvent["outcome"],
      ...data,
    });
  }

  /**
   * Log a failure event (shorthand)
   */
  async failure(
    type: AuditEvent["type"],
    action: string,
    error?: Error | string,
    data?: Partial<Omit<AuditEvent, "type" | "action" | "outcome" | "error">>,
  ): Promise<AuditEntry> {
    const errorInfo = error
      ? {
          message: error instanceof Error ? error.message : error,
          stack: this.config.includeStackTraces && error instanceof Error ? error.stack : undefined,
        }
      : undefined;

    return this.log({
      type,
      action,
      outcome: "failure" as AuditEvent["outcome"],
      error: errorInfo,
      ...data,
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditQuery): Promise<AuditQueryResult> {
    return this.store.query(query);
  }

  /**
   * Export audit logs
   */
  async export(
    filePath: string,
    entries: AuditEntry[],
    format: ExportFormat = ExportFormat.JSON,
  ): Promise<void> {
    await exportEntries(entries, filePath, format);
  }

  /**
   * Verify chain integrity
   */
  verifyChain(entries: AuditEntry[]): {
    valid: boolean;
    brokenAt?: number;
    error?: string;
  } {
    if (!this.chain) {
      return { valid: true };
    }

    return this.chain.verifyChain(entries);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<AuditConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AuditConfig>): void {
    this.config = mergeAuditConfig({ ...this.config, ...config });

    // Reinitialize components if needed
    if (config.hashChain !== undefined) {
      this.chain = config.hashChain ? new HashChain(this.config.hashAlgorithm) : null;
    }

    if (config.sinks) {
      this.sinkWriter = new SinkWriter(config.sinks);
    }
  }

  /**
   * Set custom store
   */
  setStore(store: AuditStore): void {
    this.store = store;
  }

  /**
   * Close the logger (flush buffers, close connections)
   */
  async close(): Promise<void> {
    await this.store.close();
  }
}

// Re-export config helpers
export { withCompliance, defaultAuditConfig } from "./config";
