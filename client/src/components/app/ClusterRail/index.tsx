import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetAllStates, useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Fragment, useLayoutEffect, useRef, useState } from "react";

import { BRAND } from "@/branding.config";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { RootState } from "@/redux/store";
import { armArrivalCue } from "@/lib/sound";
import { cn } from "@/lib/utils";

const TILE_SIZE_CLASS = 'size-8 shrink-0';
const SEPARATOR_CLASS = 'my-1 h-px w-4 shrink-0 bg-border';

const getClusterLabel = (name: string) => {
  const arn = name.match(/:cluster\/(.+)$/);
  if (arn) {
    return arn[1];
  }
  if (name.startsWith('gke_')) {
    return name.split('_').pop() || name;
  }
  const at = name.lastIndexOf('@');
  if (at > -1 && at < name.length - 1) {
    return name.slice(at + 1);
  }
  return name;
};

const getInitials = (name: string) => {
  const label = getClusterLabel(name);
  const parts = label.split(/[^a-zA-Z0-9]+/).filter(Boolean);

  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // 'cluster1' -> C1 rather than CL, which would collide with 'cluster.local'.
  const trailingDigits = parts[0]?.match(/^([a-zA-Z]+)(\d+)/);
  if (trailingDigits) {
    return (trailingDigits[1][0] + trailingDigits[2][0]).toUpperCase();
  }
  return (parts[0] || label).slice(0, 2).toUpperCase();
};

type ClusterRailProps = {
  configName: string;
  clusterName: string;
  selectedResource: string;
};

const ClusterRail = ({ configName, clusterName, selectedResource }: ClusterRailProps) => {
  const dispatch = useAppDispatch();

  // Both the rail tiles and the overflow list route into a cluster, so switching
  // is defined once here. Clicking the cluster you're already on is not a switch:
  // it resets nothing and, just as importantly, arms nothing — an armed cue with
  // no load to consume it would sit there and go off on the next unrelated list
  // load (a sidebar resource-kind change, say).
  //
  // resetAllStates() puts every list slice back to `loading: true`, which is the
  // edge useArrivalCue waits for. armArrivalCue then decides whether this
  // selection deserves the cue at all: only a cluster that isn't connected yet
  // does, so hopping between clusters already in the rail stays silent.
  const selectCluster = (config: string, name: string, connected: boolean, isActive: boolean) => {
    if (isActive) return;
    dispatch(resetAllStates());
    armArrivalCue(config, name, connected);
  };
  const { clusters } = useAppSelector((state: RootState) => state.clusters);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const groups = Object.keys(clusters.kubeConfigs ?? {})
    .filter((config) => clusters.kubeConfigs[config].fileExists)
    .map((config) => ({
      config,
      label: clusters.kubeConfigs[config].name || config,
      clusters: Object.keys(clusters.kubeConfigs[config].clusters).map(
        (key) => clusters.kubeConfigs[config].clusters[key]
      ),
    }));

  const allClusters = groups.flatMap(({ config, label, clusters: configClusters }) =>
    configClusters.map(({ name, connected }) => ({ config, configLabel: label, name, connected }))
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const cloneTileRefs = useRef<Array<HTMLElement | null>>([]);
  const cloneAddRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(allClusters.length);

  useLayoutEffect(() => {
    const container = listRef.current;
    const cloneAdd = cloneAddRef.current;
    if (!container || !cloneAdd) return;

    const recompute = () => {
      const n = allClusters.length;
      const containerBottom = container.getBoundingClientRect().bottom;

      if (n === 0) {
        setVisibleCount((prev) => (prev === 0 ? prev : 0));
        return;
      }

      // Everything (all clusters + the always-present Add-cluster tile)
      // fits with nothing hidden - no "+N" tile needed.
      if (cloneAdd.getBoundingClientRect().bottom <= containerBottom + 0.5) {
        setVisibleCount((prev) => (prev === n ? prev : n));
        return;
      }

      const lastCloneTileBottom = cloneTileRefs.current[n - 1]?.getBoundingClientRect().bottom ?? 0;
      const rowAdvance =
        n > 1
          ? (cloneTileRefs.current[1]?.getBoundingClientRect().top ?? 0) -
            (cloneTileRefs.current[0]?.getBoundingClientRect().top ?? 0)
          : 0;
      const addTileSpan = cloneAdd.getBoundingClientRect().bottom - lastCloneTileBottom;

      let count = 0;
      for (let k = n - 1; k >= 0; k--) {
        const priorTileBottom =
          k > 0 ? cloneTileRefs.current[k - 1]?.getBoundingClientRect().bottom ?? 0 : container.getBoundingClientRect().top;
        // priorTileBottom + one row for the "+N" tile + the Add-tile's span.
        const required = priorTileBottom + rowAdvance + addTileSpan;
        if (required <= containerBottom + 0.5) {
          count = k;
          break;
        }
      }
      setVisibleCount((prev) => (prev === count ? prev : count));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [allClusters.length]);

  const visibleClusters = allClusters.slice(0, visibleCount);
  const hiddenClusters = allClusters.slice(visibleCount);

  return (
    <div className="relative flex w-11 shrink-0 flex-col items-center overflow-hidden border-r bg-muted/40 pt-1.5">
      <TooltipProvider delayDuration={0}>
        <div ref={listRef} className="relative flex w-full min-h-0 flex-1 flex-col items-center gap-1 overflow-hidden">
          <div aria-hidden className="invisible absolute inset-x-0 top-0 flex flex-col items-center gap-1">
            {allClusters.map(({ config }, index) => {
              const showSeparator = index > 0 && config !== allClusters[index - 1].config;
              return (
                <Fragment key={`${config}-${index}`}>
                  {showSeparator && <div className={SEPARATOR_CLASS} />}
                  <div
                    ref={(el) => {
                      cloneTileRefs.current[index] = el;
                    }}
                    className={TILE_SIZE_CLASS}
                  />
                </Fragment>
              );
            })}
            <div ref={cloneAddRef} className={TILE_SIZE_CLASS} />
          </div>

          {visibleClusters.map(({ config, configLabel, name, connected }, index) => {
            const isActive = config === configName && name === clusterName;
            const showSeparator = index > 0 && config !== visibleClusters[index - 1].config;

            return (
              <Fragment key={`${config}::${name}`}>
                {showSeparator && <div className={SEPARATOR_CLASS} />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/${config}/list?cluster=${name}&resourcekind=${selectedResource}`}
                      onClick={() => selectCluster(config, name, connected, isActive)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center justify-center rounded-md border text-[11.5px] font-medium',
                        TILE_SIZE_CLASS,
                        'outline-none transition-colors',
                        'focus-visible:ring-1 focus-visible:ring-ring',
                        isActive
                          ? 'border-transparent bg-foreground text-background'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      {getInitials(name)}
                      <span
                        className={cn(
                          'absolute -bottom-px -right-px size-[7px] rounded-full ring-2 ring-muted',
                          connected ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                        )}
                        aria-hidden
                      />
                      <span className="sr-only">{name}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="font-medium">{getClusterLabel(name)}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 opacity-70">
                      <span className="truncate">{configLabel}</span>
                      {!connected && <span>· unreachable</span>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </Fragment>
            );
          })}

          {hiddenClusters.length > 0 && (
            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${hiddenClusters.length} more clusters`}
                  className={cn(
                    'flex items-center justify-center rounded-md border text-[11px] font-medium text-muted-foreground',
                    TILE_SIZE_CLASS,
                    'outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:ring-1 focus-visible:ring-ring'
                  )}
                >
                  +{hiddenClusters.length}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" className="w-64 p-1">
                <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                  {hiddenClusters.map(({ config, configLabel, name, connected }) => {
                    const isActive = config === configName && name === clusterName;

                    return (
                      <Link
                        key={`${config}::${name}`}
                        to={`/${config}/list?cluster=${name}&resourcekind=${selectedResource}`}
                        onClick={() => {
                          selectCluster(config, name, connected, isActive);
                          setOverflowOpen(false);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium',
                            isActive ? 'border-transparent bg-foreground text-background' : 'text-foreground'
                          )}
                          aria-hidden
                        >
                          {getInitials(name)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{getClusterLabel(name)}</span>
                          <span className="truncate text-xs text-muted-foreground">{configLabel}</span>
                        </span>
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            connected ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                          )}
                          aria-hidden
                        />
                      </Link>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/kwconfig"
                className={cn(
                  'flex items-center justify-center rounded-md border border-dashed border-border text-muted-foreground',
                  TILE_SIZE_CLASS,
                  'outline-none transition-colors hover:border-foreground/30 hover:bg-accent hover:text-foreground',
                  'focus-visible:ring-1 focus-visible:ring-ring'
                )}
              >
                <PlusIcon className="size-3.5" />
                <span className="sr-only">Add cluster</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Add cluster</TooltipContent>
          </Tooltip>
        </div>

        {BRAND.showGithubLink && (
          <div className="flex w-full shrink-0 justify-center border-t bg-muted/40 py-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => window.open('https://github.com/kubewall/kubewall', '_blank')}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <GitHubLogoIcon className="size-3.5" />
                  <span className="sr-only">kubewall on GitHub</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">kubewall on GitHub</TooltipContent>
            </Tooltip>
          </div>
        )}
      </TooltipProvider>
    </div>
  );
};

export { ClusterRail };
