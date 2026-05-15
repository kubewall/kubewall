import { ComponentType } from 'react';
import { Reducer } from '@reduxjs/toolkit';

// ─── Addon API Version ────────────────────────────────────────────────────────
// Bump this when any interface in this file changes in a breaking way.
// Addons declare which version they were built against; the app refuses to
// load addons built against an incompatible version.
export const ADDON_API_VERSION = '1.0' as const;
export type AddonApiVersion = typeof ADDON_API_VERSION;

// ─── Base ─────────────────────────────────────────────────────────────────────
export interface AddonDefinition {
  /** Must match ADDON_API_VERSION. Checked at runtime before mounting. */
  apiVersion: AddonApiVersion;
  /** Redux reducer to inject into the store. */
  reducer?: Reducer;
  /** Key under which the reducer is registered in the store. */
  reducerKey?: string;
}

// ─── Terminal Addon ───────────────────────────────────────────────────────────
export interface TerminalAddonDefinition extends AddonDefinition {
  /**
   * Bottom-bar terminal panel rendered in app.tsx.
   * Receives the current config/cluster from the router.
   */
  TerminalContainer: ComponentType<{
    configName: string;
    clusterName: string;
  }> | null;

  /**
   * SSH icon button rendered next to each container in PodDetailsContainer.
   * Receives everything needed to create a session without a dialog.
   */
  PodSSHButton: ComponentType<{
    podName: string;
    namespace: string;
    containerName: string;
    configName: string;
    clusterName: string;
    started: boolean;
    ready: boolean;
  }> | null;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add a new optional key here for every new addon feature.
export interface AddonRegistry {
  terminal?: TerminalAddonDefinition;
  // future: advancedLogs?: LogsAddonDefinition;
  // future: auditTrail?: AuditAddonDefinition;
}
