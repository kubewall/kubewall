import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import { PlusCircledIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resetAllStates, useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useEffect, useMemo, useState } from 'react';

import { AddConfig } from './AddConfiguration';
import { BRAND } from '@/branding.config';
import { Button } from '@/components/ui/button';
import { ClustersDetails } from '@/types';
import { ConfigCards } from './ConfigCards';
import { ConfigGroup, clusterCountLabel, configCountLabel } from './types';
import { ConfigSection } from './ConfigSection';
import { ConfigSidebar } from './ConfigSidebar';
import { Input } from '@/components/ui/input';
import { Search } from "lucide-react";
import { fetchClusters } from '@/data/KwClusters/ClustersSlice';
import kwLogoDark from '@/assets/kw-dark-theme.svg';
import kwLogoLight from '@/assets/kw-light-theme.svg';
import { resetDeleteConfig } from '@/data/KwClusters/DeleteConfigSlice';
import { toast } from "sonner";
import { useNavigate } from '@tanstack/react-router';
import { useTheme } from '@/components/app/ThemeProvider';

type ViewMode = 'table' | 'card';
const VIEW_MODE_STORAGE_KEY = 'kwconfig-view-mode';

export function KubeConfiguration() {
  const {
    clusters,
  } = useAppSelector((state) => state.clusters);
  const {
    deleteConfigResponse,
    error
  } = useAppSelector((state) => state.deleteConfig);
  // Read loosely: the clusterTags addon may not be present in this build, and
  // base-client code doesn't know its exact reducer shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterTagsByKey = useAppSelector((state: any) => state.clusterTags?.byKey) as
    | Record<string, { label: string; color: string }[]>
    | undefined;

  const [search, setSearch] = useState('');
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode) || 'table'
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  useEffect(() => {
    dispatch(fetchClusters());
    dispatch(resetAllStates());
  }, [dispatch]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Fall back to "All Clusters" if the selected config disappears — e.g. it was
  // deleted while selected, which would otherwise strand the page on a stale
  // heading, a count of 0 and "No results.".
  useEffect(() => {
    if (selectedConfig && clusters.kubeConfigs && !clusters.kubeConfigs[selectedConfig]) {
      setSelectedConfig(null);
    }
  }, [clusters, selectedConfig]);

  const isSystemConfig = (absolutePath: string): boolean => {
    return absolutePath.includes('/.kube/') && !absolutePath.includes('/.kubewall/');
  };

  // Full, unfiltered split — the sidebar's counts stay stable while the user
  // types a search, and this is the source for the ordered group list below.
  const { addedConfigs, systemConfigs } = useMemo(() => {
    const added: { [key: string]: ClustersDetails } = {};
    const system: { [key: string]: ClustersDetails } = {};

    Object.entries(clusters.kubeConfigs || {}).forEach(([key, config]) => {
      if (isSystemConfig(config.absolutePath)) {
        system[key] = config;
      } else {
        added[key] = config;
      }
    });

    return { addedConfigs: added, systemConfigs: system };
  }, [clusters]);

  // Multi-term AND search across every visible column (config name, cluster
  // name, namespace, status, tags) — e.g. "prod east" matches a cluster where
  // "prod" and "east" each appear somewhere in its row, not necessarily in
  // the same field.
  const searchTerms = useMemo(
    () => search.toLowerCase().trim().split(/\s+/).filter(Boolean),
    [search]
  );

  // Ordered (system configs first, then added), sidebar-filtered, then
  // search-filtered list of groups to render — a config is only kept if at
  // least one of its clusters matches.
  const groups = useMemo<ConfigGroup[]>(() => {
    const ordered: ConfigGroup[] = [
      ...Object.entries(systemConfigs).map(([configKey, details]) => ({ configKey, details, isSystem: true })),
      ...Object.entries(addedConfigs).map(([configKey, details]) => ({ configKey, details, isSystem: false })),
    ];

    const scoped = selectedConfig ? ordered.filter((group) => group.configKey === selectedConfig) : ordered;

    if (searchTerms.length === 0) {
      return scoped;
    }

    return scoped
      .map((group) => {
        const matchingClusters: typeof group.details.clusters = {};

        Object.keys(group.details.clusters).forEach((clusterKey) => {
          const cluster = group.details.clusters[clusterKey];
          const tagLabels = (clusterTagsByKey?.[`${group.configKey}/${clusterKey}`] ?? []).map((t) => t.label);
          const searchableText = [
            group.configKey,
            cluster.name,
            cluster.namespace,
            cluster.connected ? 'connected' : 'disconnected',
            ...tagLabels,
          ].join(' ').toLowerCase();

          if (searchTerms.every((term) => searchableText.includes(term))) {
            matchingClusters[clusterKey] = cluster;
          }
        });

        return { ...group, details: { ...group.details, clusters: matchingClusters } };
      })
      .filter((group) => Object.keys(group.details.clusters).length > 0);
  }, [systemConfigs, addedConfigs, selectedConfig, searchTerms, clusterTagsByKey]);

  useEffect(() => {
    if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(fetchClusters());
      dispatch(resetDeleteConfig());
    } else if (deleteConfigResponse.message) {
      toast.success("Success", {
        description: deleteConfigResponse.message,
      });
      dispatch(resetDeleteConfig());
      dispatch(fetchClusters());
    }
  }, [deleteConfigResponse, error, dispatch]);

  const navigateTo = (config: string, name: string) => {
    navigate({ to: `/${config}/list?cluster=${encodeURIComponent(name)}&resourcekind=pods` });
  };

  const totalClusters = useMemo(
    () => Object.values(clusters.kubeConfigs || {}).reduce((sum, c) => sum + Object.keys(c.clusters).length, 0),
    [clusters]
  );
  const totalConfigs = Object.keys(clusters.kubeConfigs || {}).length;

  const nextViewMode: ViewMode = viewMode === 'table' ? 'card' : 'table';
  const heading = selectedConfig ? `${selectedConfig} Clusters` : 'All Clusters';
  // Scoped to the selection so the count matches what's actually listed. The
  // config name is already in the heading, so it isn't repeated here. Counts
  // come from the unfiltered data, matching the sidebar.
  const stats = selectedConfig
    ? clusterCountLabel(Object.keys(clusters.kubeConfigs?.[selectedConfig]?.clusters ?? {}).length)
    : `${clusterCountLabel(totalClusters)} across ${configCountLabel(totalConfigs)}`;

  return (
    // Two stacked regions rather than two full-height columns: the top region
    // holds the logo beside the page title, so the sidebar below it starts at
    // exactly the same y as the search row it sits next to.
    <div className="flex h-screen flex-col">
      {/* Top region — logo | title + Add Config. `items-end` drops the logo to
          the bottom of this block so it sits level with the heading rather than
          with the smaller stats line above it. */}
      <div className="flex shrink-0 items-end gap-3 px-3 pt-3">
        <div className="flex w-64 shrink-0 items-center gap-2 px-2">
          <img className="w-[9rem]" src={isDark ? kwLogoDark : kwLogoLight} alt={BRAND.appName} />
          <span className="text-xs text-muted-foreground">({clusters.version})</span>
        </div>
        <div className="min-w-0 flex-1 pr-3">
          <p className="text-xs text-muted-foreground">{stats}</p>
          <h1 className="truncate text-2xl font-semibold" title={heading}>{heading}</h1>
        </div>
      </div>

      {/* Bottom region — sidebar | (search row + content). The sidebar's top
          lines up with the search row rather than with the table below it. */}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="flex w-64 shrink-0 flex-col">
          <ConfigSidebar
            addedConfigs={addedConfigs}
            systemConfigs={systemConfigs}
            selectedConfig={selectedConfig}
            onSelect={setSelectedConfig}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter clusters..."
                className="h-8 w-full pl-8 pr-2 shadow-none"
              />
            </div>
            {/* Labelled rather than icon-only, so no Tooltip is needed — which
                also sidesteps AddConfig's root being a Radix Dialog, which
                renders no DOM node for TooltipTrigger's `asChild` to ref. */}
            <AddConfig
              trigger={
                <Button variant="outline" className="h-8 shrink-0 gap-1.5 px-3">
                  <PlusCircledIcon className="h-4 w-4" />
                  Add config
                </Button>
              }
            />
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => window.location.href = '/api/v1/app/config/reload'}
                  >
                    <ReloadIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh Clusters</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  {/* One button showing the view it switches TO. */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Switch to ${nextViewMode} view`}
                    onClick={() => setViewMode(nextViewMode)}
                  >
                    {nextViewMode === 'card' ? <LayoutGrid className="h-4 w-4" /> : <TableIcon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to {nextViewMode} view</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Scrolling lives on the view itself (see ConfigSection/ConfigCards)
              so the table's sticky header can pin inside its own rounded card. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {groups.length > 0 ? (
              viewMode === 'table' ? (
                <ConfigSection groups={groups} onNavigate={navigateTo} />
              ) : (
                <ConfigCards groups={groups} onNavigate={navigateTo} />
              )
            ) : (
              <div className="rounded-xl border bg-muted/40">
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  No results.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
