import { CapabilityConfig } from './types';

// ─── Free / community tier defaults ──────────────────────────────────────────
// This file is the source of truth for the free build.
// The enterprise-client submodule ships its own version of this file;
// Vite alias in vite.config.ts points @/capabilities at the submodule's
// version when the submodule is present.
//
// These values are also the fallback before the backend config API responds.
// The backend is the authoritative source — it overwrites these at runtime.

const capabilities: CapabilityConfig = {
  terminal: {
    enabled: true,
    maxSessions: 1,
    sessionTimeoutMinutes: 30,
  },
};

export default capabilities;
