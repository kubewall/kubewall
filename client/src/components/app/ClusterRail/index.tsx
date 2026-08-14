import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetAllStates, useAppDispatch, useAppSelector } from "@/redux/hooks";

import { BRAND } from "@/branding.config";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { RootState } from "@/redux/store";
import { cn } from "@/lib/utils";

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
  const { clusters } = useAppSelector((state: RootState) => state.clusters);

  const groups = Object.keys(clusters.kubeConfigs ?? {})
    .filter((config) => clusters.kubeConfigs[config].fileExists)
    .map((config) => ({
      config,
      label: clusters.kubeConfigs[config].name || config,
      clusters: Object.keys(clusters.kubeConfigs[config].clusters).map(
        (key) => clusters.kubeConfigs[config].clusters[key]
      ),
    }));

  return (
    <div className="relative flex w-11 shrink-0 flex-col items-center overflow-hidden border-r bg-muted/40">
      <TooltipProvider delayDuration={0}>
        <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1.5">
          {groups.map(({ config, label, clusters: configClusters }, groupIndex) => (
            <div key={config} className="flex w-full flex-col items-center gap-1">
              {/* Separator per kubeconfig: the same cluster name can appear under
                  several files, and without a break they read as duplicates. */}
              {groupIndex > 0 && <div className="my-1 h-px w-4 bg-border" />}
              {configClusters.map(({ name, connected }) => {
                const isActive = config === configName && name === clusterName;

                return (
                  <Tooltip key={`${config}::${name}`}>
                    <TooltipTrigger asChild>
                      <Link
                        to={`/${config}/list?cluster=${name}&resourcekind=${selectedResource}`}
                        onClick={() => !isActive && dispatch(resetAllStates())}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'relative flex size-8 items-center justify-center rounded-md border text-[11.5px] font-medium',
                          'outline-none transition-colors',
                          'focus-visible:ring-1 focus-visible:ring-ring',
                          // foreground/background rather than primary: in the dark
                          // theme --primary is a dark green (154 100% 19%), so an
                          // active tile read as murky green on a near-black rail.
                          // Inverting the neutral pair gives an unmistakable
                          // selected state in both themes and stays distinct from
                          // hover, which already uses accent.
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
                        <span className="truncate">{label}</span>
                        {!connected && <span>· unreachable</span>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/kwconfig"
                className={cn(
                  'mt-1 flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground',
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
