import { createHash } from "crypto";
import type { HashAlgorithm } from "./config";
import type { AuditEntry } from "./types";

/**
 * Hash chain entry
 */
export interface ChainEntry {
  hash: string;
  previousHash: string;
  sequence: number;
}

/**
 * Hash chain for tamper detection
 */
export class HashChain {
  private algorithm: HashAlgorithm;
  private previousHash: string;
  private sequence: number;

  constructor(algorithm: HashAlgorithm = "sha256") {
    this.algorithm = algorithm;
    this.previousHash = this.computeGenesisHash();
    this.sequence = 0;
  }

  /**
   * Compute genesis hash for the chain
   */
  private computeGenesisHash(): string {
    const hash = createHash(this.algorithm);
    hash.update("GENESIS");
    return hash.digest("hex");
  }

  /**
   * Compute hash for an entry
   */
  private computeHash(entry: AuditEntry, previousHash: string): string {
    const hash = createHash(this.algorithm);

    // Include key fields in hash
    const data = {
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      event: entry.event,
      previousHash,
    };

    hash.update(JSON.stringify(data));
    return hash.digest("hex");
  }

  /**
   * Add an entry to the chain
   */
  addEntry(entry: AuditEntry): ChainEntry {
    const hash = this.computeHash(entry, this.previousHash);
    const chainEntry: ChainEntry = {
      hash,
      previousHash: this.previousHash,
      sequence: this.sequence++,
    };

    this.previousHash = hash;

    return chainEntry;
  }

  /**
   * Verify an entry in the chain
   */
  verifyEntry(entry: AuditEntry, expectedPreviousHash: string): boolean {
    if (!entry.chain) {
      return false;
    }

    const computedHash = this.computeHash(entry, expectedPreviousHash);
    return computedHash === entry.chain.hash;
  }

  /**
   * Verify chain integrity for a sequence of entries
   */
  verifyChain(entries: AuditEntry[]): {
    valid: boolean;
    brokenAt?: number;
    error?: string;
  } {
    if (entries.length === 0) {
      return { valid: true };
    }

    // Sort by sequence
    const sorted = [...entries].sort((a, b) => (a.chain?.sequence ?? 0) - (b.chain?.sequence ?? 0));

    // Verify first entry
    const first = sorted[0];
    if (!first.chain) {
      return { valid: false, brokenAt: 0, error: "Missing chain data" };
    }

    // For genesis entry, previous hash should be the genesis hash
    const genesisHash = this.computeGenesisHash();
    if (first.chain.sequence === 0 && first.chain.previousHash !== genesisHash) {
      return {
        valid: false,
        brokenAt: 0,
        error: "Invalid genesis hash",
      };
    }

    // Verify each subsequent entry
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];

      if (!current.chain || !previous.chain) {
        return { valid: false, brokenAt: i, error: "Missing chain data" };
      }

      // Current's previous hash should match previous entry's hash
      if (current.chain.previousHash !== previous.chain.hash) {
        return {
          valid: false,
          brokenAt: i,
          error: `Chain broken: expected previousHash ${previous.chain.hash}, got ${current.chain.previousHash}`,
        };
      }

      // Verify sequence is continuous
      if (current.chain.sequence !== previous.chain.sequence + 1) {
        return {
          valid: false,
          brokenAt: i,
          error: `Sequence gap: expected ${previous.chain.sequence + 1}, got ${current.chain.sequence}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get current chain state
   */
  getState(): { previousHash: string; sequence: number } {
    return {
      previousHash: this.previousHash,
      sequence: this.sequence,
    };
  }

  /**
   * Restore chain state (e.g., from persistence)
   */
  restoreState(previousHash: string, sequence: number): void {
    this.previousHash = previousHash;
    this.sequence = sequence;
  }
}
