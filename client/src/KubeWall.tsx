import { GitHubLogoIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetAllStates, useAppDispatch, useAppSelector } from "@/redux/hooks";


import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function KubeWall() {
  const router = useRouterState();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const pathname = router.location.pathname;
  const hasShownConfigNotFoundToast = useRef(false);

  const configName = router.location.pathname.split('/')[1];
  const clusterName = new URL(location.href).searchParams.get('cluster') || '';
  const selectedResource = new URL(location.href).searchParams.get('resourcekind') || '';
  const {
    clusters,
    loading: clustersLoading,
  } = useAppSelector((state) => state.clusters);

  useEffect(() => {
    if (!clusters.kubeConfigs) {
      dispatch(fetchClusters());
    }
  }, [clusters, dispatch]);

  // Check if current route's config exists and redirect if it doesn't
  useEffect(() => {
    const currentPath = router.location.pathname;
    const pathSegments = currentPath.split('/');
    
    // Check if we're on a config-specific route (not /config or /)
    if (pathSegments.length > 1 && pathSegments[1] !== 'config' && pathSegments[1] !== '') {
      const configId = pathSegments[1];
      
      // Only check if clusters are loaded and not empty, and not currently loading
      if (!clustersLoading && clusters?.kubeConfigs && Object.keys(clusters.kubeConfigs).length > 0) {
        if (!clusters.kubeConfigs[configId]) {
          // Config doesn't exist, redirect to config page
          if (!hasShownConfigNotFoundToast.current) {
            toast.info("Configuration not found", {
              description: "The configuration you were viewing has been deleted. Redirecting to configuration page.",
            });
            hasShownConfigNotFoundToast.current = true;
          }
          navigate({ to: '/config' });
        }
      }
    } else {
      // Reset the flag when we're not on a config-specific route
      hasShownConfigNotFoundToast.current = false;
    }
  }, [clusters, navigate, router.location.pathname]);

  const isSelected = (config: string, cluster: string) => {
    return config === configName && cluster === clusterName;
  };
  return (
    <>
      {pathname === '/config' || pathname === "/" ? (
        <Outlet />
      ) : (
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
                      to="/config"
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
            <div className="sticky bottom-0 w-full flex justify-center p-2 bg-muted/50">
              <GitHubLogoIcon className="w-6 h-6 cursor-pointer" onClick={() => window.open('https://github.com/Facets-cloud/kube-dash')} />
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <Outlet />
          </div>
        </div>
      )}
    </>
  );
}
