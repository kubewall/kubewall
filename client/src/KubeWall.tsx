import { GitHubLogoIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetAllStates, useAppDispatch, useAppSelector } from "@/redux/hooks";

import { App } from "./app";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { useEffect } from "react";

export function KubeWall() {
  const router = useRouterState();
  const dispatch = useAppDispatch();
  const pathname = router.location.pathname;

  const configName = router.location.pathname.split('/')[1];
  const clusterName = router.location.pathname.split('/')[2];
  const selectedResource = new URL(location.href).searchParams.get('resourcekind') || '';
  const {
    clusters
  } = useAppSelector((state) => state.clusters);

  useEffect(() => {
    if (!clusters.kubeConfigs) {
      dispatch(fetchClusters());
    }
  }, [clusters, dispatch]);

  const isSelected = (config: string, cluster: string) => config === configName && cluster === clusterName;
  return (
    <>
      {
        pathname !== '/kwconfig' && pathname !== "/" ?
        <div className="col-span-1 flex flex-col">
        <div className="h-screen flex">
          <div className="border-r basis-12 bg-muted/50 flex flex-col items-center overflow-hidden relative">
            <div className="flex-1 overflow-auto w-full">
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
                                to={`/${config}/${name}/list?resourcekind=${selectedResource}`}
                                onClick={() => dispatch(resetAllStates())}
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
                      className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-10 w-10', 'border-2', 'shadow-none', 'mt-1')}
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
            <div className="sticky bottom-0 w-full flex justify-center p-2 bg-muted/50">
              <GitHubLogoIcon className="w-6 h-6 cursor-pointer" onClick={()=> window.open('https://github.com/kubewall/kubewall')}/>
            </div>
          </div>
          <App />
        </div>
      </div>
       :
          <Outlet />
      }
    </>
  );
}
