// ─── Capability Types ─────────────────────────────────────────────────────────
// These interfaces define what limits/flags each feature supports.
// Values live in capabilities/index.ts (free defaults) or in the
// enterprise-client submodule (premium overrides).
//
// -1 means unlimited in all numeric fields.

export interface TerminalCapabilities {
  /** Whether the terminal feature is enabled at all. */
  enabled: boolean;
  /** Max concurrent exec sessions. -1 = unlimited. */
  maxSessions: number;
  /** Session idle timeout in minutes. -1 = unlimited. */
  sessionTimeoutMinutes: number;
}

// Add a new key here for every new feature's capability config.
export interface CapabilityConfig {
  terminal: TerminalCapabilities;
  // future: advancedLogs: LogsCapabilities;
  // future: auditTrail: AuditCapabilities;
}
