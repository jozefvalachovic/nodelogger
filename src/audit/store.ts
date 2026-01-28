import * as fs from "fs";
import * as path from "path";
import { AuditEntry, AuditQuery, AuditQueryResult, AuditSink, ExportFormat } from "./types";

/**
 * Abstract audit store interface
 */
export interface AuditStore {
  write(entry: AuditEntry): Promise<void>;
  query(query: AuditQuery): Promise<AuditQueryResult>;
  close(): Promise<void>;
}

/**
 * In-memory audit store (for development/testing)
 */
export class MemoryStore implements AuditStore {
  private entries: AuditEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  async write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);

    // Trim if exceeds max size
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(-this.maxSize);
    }
  }

  async query(query: AuditQuery): Promise<AuditQueryResult> {
    let results = [...this.entries];

    // Apply filters
    if (query.timeRange?.start) {
      results = results.filter((e) => e.timestamp >= query.timeRange!.start!);
    }
    if (query.timeRange?.end) {
      results = results.filter((e) => e.timestamp <= query.timeRange!.end!);
    }
    if (query.eventTypes?.length) {
      results = results.filter((e) => query.eventTypes!.includes(e.event.type));
    }
    if (query.actions?.length) {
      results = results.filter((e) => query.actions!.includes(e.event.action));
    }
    if (query.outcomes?.length) {
      results = results.filter((e) => query.outcomes!.includes(e.event.outcome));
    }
    if (query.actorIds?.length) {
      results = results.filter(
        (e) =>
          (e.event.actorId && query.actorIds!.includes(e.event.actorId)) ||
          (e.event.actor?.id && query.actorIds!.includes(e.event.actor.id)),
      );
    }
    if (query.resourceTypes?.length) {
      results = results.filter(
        (e) =>
          (e.event.resourceType && query.resourceTypes!.includes(e.event.resourceType)) ||
          (e.event.resource?.type && query.resourceTypes!.includes(e.event.resource.type)),
      );
    }
    if (query.resourceIds?.length) {
      results = results.filter(
        (e) =>
          (e.event.resourceId && query.resourceIds!.includes(e.event.resourceId)) ||
          (e.event.resource?.id && query.resourceIds!.includes(e.event.resource.id)),
      );
    }
    if (query.tags?.length) {
      results = results.filter((e) => e.event.tags?.some((t) => query.tags!.includes(t)));
    }
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.event.description?.toLowerCase().includes(searchLower) ||
          e.event.action.toLowerCase().includes(searchLower),
      );
    }

    // Sort
    const sortOrder = query.sort ?? "desc";
    results.sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return sortOrder === "asc" ? diff : -diff;
    });

    const total = results.length;

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    results = results.slice(offset, offset + limit);

    return {
      entries: results,
      total,
      hasMore: offset + results.length < total,
    };
  }

  async close(): Promise<void> {
    this.entries = [];
  }

  /**
   * Get all entries (for testing)
   */
  getAll(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }
}

/**
 * File-based audit store
 */
export class FileStore implements AuditStore {
  private filePath: string;
  private buffer: AuditEntry[] = [];
  private bufferSize: number;
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(filePath: string, options: { bufferSize?: number; flushInterval?: number } = {}) {
    this.filePath = filePath;
    this.bufferSize = options.bufferSize ?? 100;
    this.flushInterval = options.flushInterval ?? 1000;

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Start flush timer
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = this.buffer;
    this.buffer = [];

    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

    await fs.promises.appendFile(this.filePath, lines, "utf-8");
  }

  async write(entry: AuditEntry): Promise<void> {
    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async query(query: AuditQuery): Promise<AuditQueryResult> {
    // Flush any pending writes
    await this.flush();

    // Read all entries from file
    const entries: AuditEntry[] = [];

    if (fs.existsSync(this.filePath)) {
      const content = await fs.promises.readFile(this.filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          entry.timestamp = new Date(entry.timestamp);
          entries.push(entry);
        } catch {
          // Skip invalid lines
        }
      }
    }

    // Use memory store for querying
    const memStore = new MemoryStore(entries.length);
    for (const entry of entries) {
      await memStore.write(entry);
    }

    return memStore.query(query);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

/**
 * Sink writer that handles different sink types
 */
export class SinkWriter {
  private sinks: AuditSink[];

  constructor(sinks: AuditSink[]) {
    this.sinks = sinks;
  }

  async write(entry: AuditEntry): Promise<void> {
    const promises = this.sinks.map((sink) => this.writeToSink(sink, entry));
    await Promise.allSettled(promises);
  }

  private async writeToSink(sink: AuditSink, entry: AuditEntry): Promise<void> {
    switch (sink.type) {
      case "console":
        console.log(JSON.stringify(entry));
        break;

      case "file":
        await fs.promises.appendFile(sink.path, JSON.stringify(entry) + "\n", "utf-8");
        break;

      case "webhook":
        await fetch(sink.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...sink.headers,
          },
          body: JSON.stringify(entry),
        });
        break;

      case "custom":
        await sink.handler(entry);
        break;
    }
  }
}

/**
 * Export entries to a file
 */
export async function exportEntries(
  entries: AuditEntry[],
  filePath: string,
  format: ExportFormat,
): Promise<void> {
  let content: string;

  switch (format) {
    case ExportFormat.JSON:
      content = JSON.stringify(entries, null, 2);
      break;

    case ExportFormat.JSONL:
      content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      break;

    case ExportFormat.CSV:
      const headers = [
        "id",
        "timestamp",
        "type",
        "action",
        "outcome",
        "actorId",
        "resourceId",
        "description",
      ];
      const rows = entries.map((e) => [
        e.id,
        e.timestamp.toISOString(),
        e.event.type,
        e.event.action,
        e.event.outcome,
        e.event.actorId ?? e.event.actor?.id ?? "",
        e.event.resourceId ?? e.event.resource?.id ?? "",
        e.event.description ?? "",
      ]);
      content =
        headers.join(",") +
        "\n" +
        rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      break;

    default:
      throw new Error(`Unknown export format: ${format}`);
  }

  await fs.promises.writeFile(filePath, content, "utf-8");
}
