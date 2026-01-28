/**
 * Audit event types matching PyLogger
 */
export enum EventType {
  AUTH = "auth",
  AUTHZ = "authz",
  DATA_ACCESS = "data_access",
  DATA_MODIFY = "data_modify",
  CONFIG_CHANGE = "config_change",
  ADMIN_ACTION = "admin_action",
  SECURITY_EVENT = "security_event",
  USER_LIFECYCLE = "user_lifecycle",
  API_ACCESS = "api_access",
  SYSTEM = "system",
  CUSTOM = "custom",
}

/**
 * Outcome of an audit event
 */
export enum Outcome {
  SUCCESS = "success",
  FAILURE = "failure",
  PENDING = "pending",
  UNKNOWN = "unknown",
}

/**
 * Compliance presets matching PyLogger
 */
export enum Compliance {
  SOC2 = "soc2",
  HIPAA = "hipaa",
  PCI_DSS = "pci_dss",
  GDPR = "gdpr",
  FEDRAMP = "fedramp",
}

/**
 * Actor information for audit events
 */
export interface AuditActor {
  /** Actor unique identifier */
  id?: string;

  /** Actor type (user, service, system) */
  type?: string;

  /** Actor name or email */
  name?: string;

  /** IP address */
  ip?: string;

  /** User agent */
  userAgent?: string;

  /** Session ID */
  sessionId?: string;

  /** Additional actor metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resource information for audit events
 */
export interface AuditResource {
  /** Resource unique identifier */
  id?: string;

  /** Resource type */
  type?: string;

  /** Resource name */
  name?: string;

  /** Resource path or location */
  path?: string;

  /** Additional resource metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Distributed tracing context
 */
export interface TraceContext {
  /** Trace ID */
  traceId?: string;

  /** Span ID */
  spanId?: string;

  /** Parent span ID */
  parentSpanId?: string;

  /** Trace flags */
  traceFlags?: number;

  /** Trace state */
  traceState?: string;
}

/**
 * Audit event structure
 */
export interface AuditEvent {
  /** Event type */
  type: EventType;

  /** Action performed */
  action: string;

  /** Outcome of the action */
  outcome: Outcome;

  /** Event description */
  description?: string;

  /** Actor information */
  actor?: AuditActor;

  /** Shorthand for actor.id */
  actorId?: string;

  /** Shorthand for actor.type */
  actorType?: string;

  /** Shorthand for actor.ip */
  actorIp?: string;

  /** Resource information */
  resource?: AuditResource;

  /** Shorthand for resource.id */
  resourceId?: string;

  /** Shorthand for resource.type */
  resourceType?: string;

  /** Trace context for distributed tracing */
  trace?: TraceContext;

  /** Request ID */
  requestId?: string;

  /** Additional event data */
  data?: Record<string, unknown>;

  /** Tags for filtering */
  tags?: string[];

  /** Duration in milliseconds */
  durationMs?: number;

  /** Error information if outcome is failure */
  error?: {
    code?: string;
    message?: string;
    stack?: string;
  };
}

/**
 * Stored audit entry (with metadata)
 */
export interface AuditEntry {
  /** Unique entry ID */
  id: string;

  /** Entry timestamp */
  timestamp: Date;

  /** The audit event */
  event: AuditEvent;

  /** Service information */
  service?: {
    name: string;
    version: string;
    environment: string;
  };

  /** Hash chain values */
  chain?: {
    hash: string;
    previousHash: string;
    sequence: number;
  };

  /** Digital signature (for compliance) */
  signature?: string;
}

/**
 * Query parameters for searching audit logs
 */
export interface AuditQuery {
  /** Time range to search */
  timeRange?: {
    start?: Date;
    end?: Date;
  };

  /** Filter by event types */
  eventTypes?: EventType[];

  /** Filter by actions */
  actions?: string[];

  /** Filter by outcomes */
  outcomes?: Outcome[];

  /** Filter by actor IDs */
  actorIds?: string[];

  /** Filter by resource types */
  resourceTypes?: string[];

  /** Filter by resource IDs */
  resourceIds?: string[];

  /** Filter by tags */
  tags?: string[];

  /** Text search in description */
  search?: string;

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort order */
  sort?: "asc" | "desc";
}

/**
 * Query result
 */
export interface AuditQueryResult {
  /** Matching entries */
  entries: AuditEntry[];

  /** Total count (before pagination) */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Export format options
 */
export enum ExportFormat {
  JSON = "json",
  JSONL = "jsonl",
  CSV = "csv",
}

/**
 * Sink type for audit logs
 */
export type AuditSink =
  | { type: "file"; path: string; rotate?: boolean }
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "console" }
  | { type: "custom"; handler: (entry: AuditEntry) => void | Promise<void> };
