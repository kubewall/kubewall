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

  /**
   * SSH icon button rendered in the pod details page top bar.
   * Opens a terminal directly if the pod has one runnable container,
   * or offers a picker when it has several.
   */
  PodSSHTopBarButton: ComponentType<{
    podName: string;
    namespace: string;
    configName: string;
    clusterName: string;
    containers: { name: string; started: boolean; ready: boolean }[];
  }> | null;
}

// ─── Kube End-of-Life Addon ───────────────────────────────────────────────────
export interface KubeEndOfLifeAddonDefinition extends AddonDefinition {
  ClusterEOLBadge: ComponentType<{
    configName: string;
    clusterName: string;
  }> | null;
}

// ─── Cluster Tags Addon ───────────────────────────────────────────────────────
export interface ClusterTagsAddonDefinition extends AddonDefinition {
  /** Self-contained badge + edit-dialog rendered per cluster row/card. */
  ClusterTagBadge: ComponentType<{
    configName: string;
    clusterName: string;
    /** 'inline' (default, compact, used in the table) or 'footer' (tags left, edit control pinned right and always visible — used in the card view). */
    layout?: 'inline' | 'footer';
  }> | null;

  /**
   * Presentational editor for a cluster's full tag list (label + color per
   * tag, add/remove rows), reused in the Add Config dialog. The backend's
   * PUT replaces the whole tags array, so this always manages the complete
   * list, not a single tag.
   */
  ClusterTagListEditor: ComponentType<{
    value: { label: string; color: string }[];
    onChange: (value: { label: string; color: string }[]) => void;
    idPrefix?: string;
    /** 'stacked' (default) or 'inline' (Tag and Color side by side). */
    layout?: 'stacked' | 'inline';
  }> | null;

  /**
   * Deliberate deviation from the components-and-reducer-only shape above:
   * base-client code (AddConfiguration) needs to trigger a tag write as a
   * step in its own submit sequence, not just render an addon-owned
   * component. Returns a Redux thunk action — dispatch it via the caller's
   * own useAppDispatch(), e.g.
   *   dispatch(addons.clusterTags.upsertClusterTags(config, cluster, tags)).unwrap()
   * Sends the COMPLETE desired tags array (the backend replaces, not merges).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertClusterTags: ((config: string, cluster: string, tags: { label: string; color: string }[]) => any) | null;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add a new optional key here for every new addon feature.
export interface AddonRegistry {
  terminal?: TerminalAddonDefinition;
  kubeEndOfLife?: KubeEndOfLifeAddonDefinition;
  clusterTags?: ClusterTagsAddonDefinition;
}
