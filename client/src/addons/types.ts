import { ComponentType, ReactNode } from 'react';
import { NavigationRoutes } from '@/types';
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

// ─── Deployment Revisions Addon ───────────────────────────────────────────────
export interface DeploymentRevisionsAddonDefinition extends AddonDefinition {
  /**
   * Rollout history for one deployment, rendered as the Details page's
   * "Revisions" tab. Self-contained: it opens its own SSE stream against
   * `api/v1/deployments/{name}/revisions` (served by the premium backend
   * addon) and links each revision to its ReplicaSet's details page.
   */
  RevisionsTab: ComponentType<{
    deploymentName: string;
    namespace: string;
    configName: string;
    clusterName: string;
  }> | null;
}

// ─── Topology Addon ────────────────────────────────────────────────────────────
export interface TopologyAddonDefinition extends AddonDefinition {
  /**
   * Full-page Topology view (sidebar entry above Cluster). Renders the
   * resource graph for the config/cluster the router resolved, backed by
   * the premium backend addon's `GET api/v1/topology` SSE stream.
   */
  TopologyView: ComponentType<{
    configName: string;
    clusterName: string;
  }> | null;

  /**
   * A single resource's own topology neighborhood, rendered as the Details
   * page's "Topology" tab. Self-contained: it opens its own subscription
   * against the premium backend addon's dedicated per-resource route
   * (`GET api/v1/{resourceKind}/{resourceName}/topology`), separate from
   * TopologyView's whole-cluster stream. Only offer this tab (check
   * `resourceTopologyKinds.has(resourcekind)` first) for a kind the backend
   * actually routes — notably not Custom Resources, which have no such
   * route at all.
   */
  ResourceTopologyTab: ComponentType<{
    resourceKind: string;
    resourceName: string;
    namespace?: string;
    configName: string;
    clusterName: string;
  }> | null;

  /** Every `resourcekind` URL slug the backend has a topology route for — see ResourceTopologyTab. */
  resourceTopologyKinds: ReadonlySet<string> | null;
}

// ─── Dashboard Addon ───────────────────────────────────────────────────────────
export interface DashboardAddonDefinition extends AddonDefinition {
  /**
   * Full-page cluster dashboard (sidebar entry above Topology). Renders the
   * live overview for the config/cluster the router resolved, backed by the
   * premium backend addon's `GET api/v1/dashboard` SSE stream. Reads the
   * optional `namespace` search param itself.
   */
  DashboardView: ComponentType<{
    configName: string;
    clusterName: string;
  }> | null;
}

// ─── SSO Addon ─────────────────────────────────────────────────────────────────
// Neutral extension points; the behaviour behind each one lives in the addon.

/** A page the addon adds to the router. `bare`: standalone (no cluster rail, no cluster list); `rail`: beside the rail, no resource sidebar. */
export interface AddonRoute {
  path: string;
  layout?: 'bare' | 'rail';
  component?: ComponentType<{ params: Record<string, string>; search: Record<string, unknown> }>;
  /** Sends this path to another one instead of rendering a component. */
  redirectTo?: string;
  validateSearch?: (search: Record<string, unknown>) => Record<string, string>;
}

/** What a control acts on; `sub` is a subresource: scale, exec, portforward or log. */
export type CanTarget = { kind: string; group?: string; resource?: string; kindName?: string; sub?: string };
/** The reason an action is refused, or null when it is allowed or unknown. */
export type DeniedCheck = (verb: string, target: CanTarget) => string | null;
export type VisibleNavigation = { navigation: NavigationRoutes; isCustomResourceVisible: (route: string) => boolean };

export interface SsoAddonDefinition extends AddonDefinition {
  routes?: AddonRoute[];
  /** Wraps the whole app, e.g. to load state before any page renders. */
  AppProvider?: ComponentType<{ children: ReactNode }>;
  /** Bottom of the cluster rail, and the overview page's header. */
  AccountButton?: ComponentType<{ placement: 'rail' | 'header' }>;
  /** Switches the wrapped control off with a reason; untouched without one. */
  PermissionGate?: ComponentType<{ deniedReason?: string | null; className?: string; children: ReactNode }>;
  /** Replaces the overview page when the person can reach no cluster (`clusterCount` 0). */
  ClusterGate?: ComponentType<{ clusterCount: number | null; rail: ReactNode; children: ReactNode }>;
  // Hooks, called unconditionally by the host; the registry is static per build.
  useIsAdmin?: () => boolean;
  useDenied?: (config: string, cluster: string, namespace?: string) => DeniedCheck;
  useVisibleNavigation?: (config: string, cluster: string) => VisibleNavigation;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add a new optional key here for every new addon feature.
export interface AddonRegistry {
  terminal?: TerminalAddonDefinition;
  kubeEndOfLife?: KubeEndOfLifeAddonDefinition;
  clusterTags?: ClusterTagsAddonDefinition;
  deploymentRevisions?: DeploymentRevisionsAddonDefinition;
  topology?: TopologyAddonDefinition;
  dashboard?: DashboardAddonDefinition;
  sso?: SsoAddonDefinition;
}
