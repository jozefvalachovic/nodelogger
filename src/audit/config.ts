import { Compliance, AuditSink } from "./types";

/**
 * Hash algorithm options
 */
export type HashAlgorithm = "sha256" | "sha512";

/**
 * Store type options
 */
export type StoreType = "memory" | "file";

/**
 * Store configuration
 */
export interface StoreConfig {
  /** Store type */
  type: StoreType;

  /** File path (required for file store) */
  filePath?: string;

  /** Maximum entries for memory store */
  maxSize?: number;

  /** Buffer size for file store */
  bufferSize?: number;

  /** Flush interval for file store (ms) */
  flushInterval?: number;
}

/**
 * Audit logger configuration
 */
export interface AuditConfig {
  /** Enable structured audit logging */
  enableStructured: boolean;

  /** Enable hash chain for tamper detection */
  hashChain: boolean;

  /** Hash algorithm for chain */
  hashAlgorithm: HashAlgorithm;

  /** Service name */
  serviceName: string;

  /** Service version */
  serviceVersion: string;

  /** Environment (production, staging, etc.) */
  environment: string;

  /** Retention period in days */
  retentionDays: number;

  /** Enable digital signatures */
  enableSignatures: boolean;

  /** Signing key (for signatures) */
  signingKey?: string;

  /** Output sinks */
  sinks: AuditSink[];

  /** Include stack traces in errors */
  includeStackTraces: boolean;

  /** Auto-delete after retention period */
  autoDelete: boolean;

  /** Buffer size for batch writes */
  bufferSize: number;

  /** Flush interval in milliseconds */
  flushInterval: number;

  /** Store configuration */
  store?: StoreConfig;
}

/**
 * Default audit configuration
 */
export const defaultAuditConfig: AuditConfig = {
  enableStructured: true,
  hashChain: false,
  hashAlgorithm: "sha256",
  serviceName: process.env.SERVICE_NAME ?? "unknown",
  serviceVersion: process.env.SERVICE_VERSION ?? "0.0.0",
  environment: process.env.NODE_ENV ?? "development",
  retentionDays: 365,
  enableSignatures: false,
  signingKey: undefined,
  sinks: [{ type: "console" }],
  includeStackTraces: process.env.NODE_ENV !== "production",
  autoDelete: false,
  bufferSize: 100,
  flushInterval: 1000,
};

/**
 * Compliance preset configurations
 */
export const compliancePresets: Record<Compliance, Partial<AuditConfig>> = {
  [Compliance.SOC2]: {
    hashChain: true,
    hashAlgorithm: "sha256",
    retentionDays: 365,
    enableSignatures: false,
    autoDelete: false,
  },
  [Compliance.HIPAA]: {
    hashChain: true,
    hashAlgorithm: "sha512",
    retentionDays: 365 * 6, // 6 years
    enableSignatures: true,
    autoDelete: false,
  },
  [Compliance.PCI_DSS]: {
    hashChain: true,
    hashAlgorithm: "sha256",
    retentionDays: 365,
    enableSignatures: false,
    autoDelete: false,
  },
  [Compliance.GDPR]: {
    hashChain: true,
    hashAlgorithm: "sha256",
    retentionDays: 90,
    enableSignatures: false,
    autoDelete: true,
  },
  [Compliance.FEDRAMP]: {
    hashChain: true,
    hashAlgorithm: "sha512",
    retentionDays: 365 * 3, // 3 years
    enableSignatures: true,
    autoDelete: false,
  },
};

/**
 * Create configuration with compliance preset
 */
export function withCompliance(
  compliance: Compliance,
  overrides: Partial<AuditConfig> = {},
): AuditConfig {
  return {
    ...defaultAuditConfig,
    ...compliancePresets[compliance],
    ...overrides,
  };
}

/**
 * Merge configuration with defaults
 */
export function mergeAuditConfig(config: Partial<AuditConfig>): AuditConfig {
  return {
    ...defaultAuditConfig,
    ...config,
  };
}
