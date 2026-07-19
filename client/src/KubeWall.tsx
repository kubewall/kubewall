import { GitHubLogoIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetAllStates, useAppDispatch, useAppSelector } from "@/redux/hooks";

import { App } from "./app";
import { BRAND } from "@/branding.config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { useEffect } from "react";

export function KubeWall() {
  // Narrow selector (shallow-compared) so this component only re-renders
  // when the pathname actually changes, not on every router state transition.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dispatch = useAppDispatch();

  const configName = pathname.split('/')[1];
  const clusterName = new URL(location.href).searchParams.get('cluster') || '';
  const selectedResource = new URL(location.href).searchParams.get('resourcekind') || '';
  const {
    clusters
  } = useAppSelector((state) => state.clusters);

  useEffect(() => {
    if (!clusters.kubeConfigs) {
      dispatch(fetchClusters());
    }
  }, [clusters, dispatch]);

  const isSelected = (config: string, cluster: string) => {
    return config === configName && cluster === clusterName;
  };
  return (
    <>
      {
        pathname !== '/kwconfig' && pathname !== "/" ?
            <div className="h-screen flex">
              <div className="flex-shrink-0 border-r basis-12 bg-muted/50 flex flex-col items-center overflow-hidden relative">
                <div className="flex-1 overflow-auto w-full pl-[2px]">
                  <TooltipProvider>
                    {clusters.kubeConfigs &&
                      Object.keys(clusters.kubeConfigs).map((config) => {
                        return (
                          clusters.kubeConfigs[config].fileExists &&
                          Object.keys(clusters.kubeConfigs[config].clusters).map((cluster) => {
                            const { name } = clusters.kubeConfigs[config].clusters[cluster];

                            return (
                              <Tooltip key={name} delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <Link
                                    to={`/${config}/list?cluster=${name}&resourcekind=${selectedResource}`}
                                    onClick={() => !isSelected(config, name) && dispatch(resetAllStates())}
                                    href="#"
                                    className={cn(
                                      buttonVariants({ variant: isSelected(config, name) ? 'default' : 'ghost', size: 'icon' }),
                                      'h-10 w-10',
                                      'border',
                                      'shadow-none',
                                      'm-0.5',
                                      isSelected(config, clusterName) ? '' : 'dark:border',
                                    )}
                                  >
                                    <span className="text-[16px] font-normal">{name.substring(0, 2).toUpperCase()}</span>
                                    <span className="sr-only">{name}</span>
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="flex items-center gap-4">
                                  {name}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })
                        );
                      })}
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to="/kwconfig"
                          href="#"
                          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-10 w-10', 'border', 'shadow-none', 'mt-1', 'ml-0.5')}
                        >
                          <PlusCircledIcon className="w-5 h-5" />
                          <span className="sr-only">Add Cluster</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-4">
                        Add Cluster
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {BRAND.showGithubLink && (
                  <div className="sticky bottom-0 w-full flex justify-center p-2 bg-muted/50">
                    <GitHubLogoIcon className="w-6 h-6 cursor-pointer" onClick={() => window.open('https://github.com/kubewall/kubewall')} />
                  </div>
                )}
              </div>
              <div className="flex-1 flex overflow-hidden"><App /></div>
            </div>
          :
          <Outlet />
      }
    </>
  );
}
