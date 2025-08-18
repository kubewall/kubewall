import './index.css';

import { API_VERSION, CUSTOM_RESOURCES_ENDPOINT, getFilteredNavigationRoutes } from "@/constants";
import { ChevronRight, DatabaseIcon, LayersIcon, LayoutGridIcon, NetworkIcon, ShieldHalf, SlidersHorizontalIcon, UngroupIcon, Terminal, Activity } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarContent, SidebarGroup, SidebarGroupLabel, Sidebar as SidebarMainComponent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getSystemTheme } from "@/utils";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useRuntimeFeatureFlags } from "@/hooks/useRuntimeFeatureFlags";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";

import { SidebarNavigator } from "./Navigator";
import { SvgRenderer } from '../Common/SvgRenderer';
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import kwLogoDark from '../../../assets/facets-dark-theme.svg';
import kwLogoDarkIcon from '../../../assets/facets-logo-light.svg';
import kwLogoLight from '../../../assets/facets-light-theme.svg';
import kwLogoLightIcon from '../../../assets/facets-logo-dark.svg';
import helmLogo from '../../../assets/helm-logo.png';
import { resetCustomResourcesList } from "@/data/CustomResources/CustomResourcesListSlice";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { clearPermissionError } from "@/data/PermissionErrors/PermissionErrorsSlice";
import kwFetch from "@/data/kwFetch";
import { updateCustomResources } from "@/data/CustomResources/CustomResourcesSlice";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
}


const Sidebar = memo(function ({ className }: SidebarProps) {
  const [activeTab, setActiveTab] = useState('');
  const router = useRouterState();
  const navigate = useNavigate();
  const routerForce = useRouter();
  const dispatch = useAppDispatch();
  const configName = router.location.pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';
  const {
    clusters
  } = useAppSelector((state) => state.clusters);
  const {
    customResourcesNavigation
  } = useAppSelector((state) => state.customResources);
  const { open, isMobile, openMobile } = useSidebar();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const { featureFlags, isLoading: featureFlagsLoading } = useRuntimeFeatureFlags();
  const [navigationRoutes, setNavigationRoutes] = useState(() => getFilteredNavigationRoutes());

  // Update navigation routes when feature flags change
  useEffect(() => {
    if (!featureFlagsLoading) {
      setNavigationRoutes(getFilteredNavigationRoutes());
    }
  }, [featureFlags, featureFlagsLoading]);

  useEffect(() => {
    const currentRoute = new URL(location.href).searchParams.get('resourcekind') || '';
    if (currentRoute.toLowerCase() === 'customresources') {
      const route = queryParams.get('group');
      if (route) {
        setOpenMenus({
          [route]: true
        });
      }
    }
    else if (currentRoute.toLowerCase() !== 'customresourcedefinitions') {
      Object.keys(navigationRoutes).forEach((category) => {
        if (navigationRoutes[category].some(({ route }) => route === currentRoute)) {
          setOpenMenus(() => ({
            [category]: true,
          }));
          return;
        }
      });
    }
  }, []);

  // Background-load Custom Resource Definitions for sidebar (non-blocking)
  useEffect(() => {
    const shouldLoadCRDs = Boolean(configName) && Boolean(clusterName) && Object.keys(customResourcesNavigation || {}).length === 0;
    if (!shouldLoadCRDs) return;
    const params = new URLSearchParams({ config: configName, cluster: clusterName });
    // Fire-and-forget load; do not block other page loads
    kwFetch(`${API_VERSION}/${CUSTOM_RESOURCES_ENDPOINT}?${params.toString()}`)
      .then((res) => {
        if (Array.isArray(res)) {
          dispatch(updateCustomResources(res));
        }
      })
      .catch(() => {
        // silently ignore; sidebar will still work without CRDs
      });
  }, [configName, clusterName, dispatch]);


  const toggleMenu = (route: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [route]: !prev[route],
    }));
  };

  const onNavClick = (routeValue: string) => {
    dispatch(resetListTableFilter());
    // Clear any existing permission errors when navigating to a different resource
    dispatch(clearPermissionError());
    // setActiveTab(routeValue);
    
    // Handle special routes differently
    if (routeValue === 'cloudshell') {
      navigate({ to: `/${configName}/cloudshell?cluster=${encodeURIComponent(clusterName)}` });
    } else if (routeValue === 'helmcharts') {
      navigate({ to: `/${configName}/helmcharts?cluster=${encodeURIComponent(clusterName)}` });
    } else if (routeValue === 'settings') {
      navigate({ to: `/${configName}/settings?cluster=${encodeURIComponent(clusterName)}` });
    } else if (routeValue === 'overview') {
      navigate({ to: `/${configName}/overview?cluster=${encodeURIComponent(clusterName)}` });
    } else if (routeValue === 'tools/tracing') {
      navigate({ to: `/${configName}/tools/tracing?cluster=${encodeURIComponent(clusterName)}` });
    } else if (routeValue === 'tools/tracing/settings') {
      navigate({ to: `/${configName}/tools/tracing/settings?cluster=${encodeURIComponent(clusterName)}` });
    } else {
      navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=${routeValue}` });
    }
    routerForce.invalidate();
  };

  

  const onCustomResourcesNavClick = (route: string, name: string) => {
    dispatch(resetListTableFilter());
    // Clear any existing permission errors when navigating to a different resource
    dispatch(clearPermissionError());
    const routeKeys = new URLSearchParams(route);
    setActiveTab((routeKeys.get('kind') || '').toLowerCase());
    if (activeTab.toLowerCase() !== name.toLowerCase()) {
      dispatch(resetCustomResourcesList());
    }

    navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=customresources&${route}` });
  };

  useEffect(() => {
    if (!clusters.kubeConfigs) {
      dispatch(fetchClusters());
    }
  }, [clusters, dispatch]);

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'cluster':
        return <LayoutGridIcon width={16} />;
      case 'workloads':
        return <UngroupIcon width={16} />;
      case 'configuration':
        return <SlidersHorizontalIcon width={16} />;
      case 'accesscontrol':
        return <ShieldHalf width={16} />;
      case 'network':
        return <NetworkIcon width={16} />;
      case 'storage':
        return <DatabaseIcon width={16} />;
      case 'helm':
        return <img src={helmLogo} alt="Helm" width={16} height={16} />;
      case 'tools':
        return <Terminal width={16} />;
      case 'tracing':
        return <Activity width={16} />;
      case 'preferences':
        return <SlidersHorizontalIcon width={16} />;
      default:
        return <LayersIcon width={16} />;
    }
  };

  const getActiveNav = (route: string, check = false) => {
    // For overview route, check if current pathname contains '/overview'
    if (route === 'overview') {
      return router.location.pathname.includes('/overview');
    }
    // For tracing routes, check if current pathname contains the route
    if (route === 'tools/tracing') {
      return router.location.pathname.includes(`/${route}`);
    }
    // For other routes, check resourcekind parameter
    return route === (!check ? queryParams.get('kind') : queryParams.get('resourcekind'));
  };

  
  return (
    <div className={cn("col-span-1", className)}>
      <div className="h-screen space-y-4 py-1">
        {
          <>
            <SidebarMainComponent collapsible="icon">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarMenu>
                    <SidebarMenuItem className="cursor-pointer">
                      <SidebarMenuButton asChild>
                        <div className='flex items-center justify-center'>
                          <a onClick={() => onNavClick('pods')}>
                            <img
                              className={`transition-all duration-300 ease-in-out ${open || openMobile ? "w-16" : "w-4 max-w-none"}`}
                              src={getSystemTheme() === 'light' ? (open || openMobile ? kwLogoLight : kwLogoLightIcon) : (open || openMobile ? kwLogoDark : kwLogoDarkIcon)}
                              alt="Facets KubeDash"
                            />

                          </a>
                        </div>
                      </SidebarMenuButton>
                      <SidebarNavigator setOpenMenus={setOpenMenus} />
                    </SidebarMenuItem>
                    
                    {
                      Object.keys(navigationRoutes).map((route) => (
                        <Collapsible
                          key={route}
                          asChild
                          open={openMenus[route]}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <DropdownMenu>
                              <CollapsibleTrigger asChild onClick={(e) => { toggleMenu(route); e.stopPropagation(); }}>
                                <DropdownMenuTrigger asChild>
                                  <SidebarMenuButton className='group-data-[collapsible=icon]:justify-center' tooltip={route} showTooltipOnExpanded={true}>
                                    {getResourceIcon(route.toLowerCase().split(' ').join(''))}
                                    <span className='truncate text-gray-800 dark:text-gray-200 group-data-[collapsible=icon]:hidden'>{route}</span>
                                    <ChevronRight size={16} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                                  </SidebarMenuButton>
                                </DropdownMenuTrigger>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {
                                    navigationRoutes[route].map(({ name, route: routeValue }) => {
                                      return (
                                        <SidebarMenuSubItem key={routeValue} className="cursor-pointer">
                                          <TooltipProvider delayDuration={0}>
                                            <Tooltip >
                                              <TooltipTrigger asChild>
                                                <SidebarMenuSubButton asChild isActive={getActiveNav(routeValue, true)}>
                                                  <a onClick={() => onNavClick(routeValue)}>
                                                    <span className="text-gray-600 dark:text-gray-400">{name}</span>
                                                  </a>
                                                </SidebarMenuSubButton>
                                              </TooltipTrigger>
                                              <TooltipContent side="right">
                                                <p>{name}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </SidebarMenuSubItem>
                                      );
                                    })
                                  }

                                </SidebarMenuSub>
                              </CollapsibleContent>

                              {
                                !open && <DropdownMenuContent
                                  className=" min-w-56 rounded-lg"
                                  align="start"
                                  side={isMobile ? "bottom" : "right"}
                                >
                                  <DropdownMenuLabel className="truncate font-medium text-gray-800 dark:text-gray-200">{route}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup className='overflow-auto max-h-64'>
                                    {
                                      navigationRoutes[route].map(({ name, route: routeValue }) => {
                                        return (
                                          <DropdownMenuItem
                                            key={routeValue}
                                            onClick={() => onNavClick(routeValue)}
                                            className="gap-2 cursor-pointer text-gray-600 dark:text-gray-400"
                                          >
                                            {name}
                                          </DropdownMenuItem>
                                        );
                                      })
                                    }
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              }

                            </DropdownMenu>

                          </SidebarMenuItem>
                        </Collapsible>
                      ))
                    }
                  </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Custom Resources</SidebarGroupLabel>
                  <SidebarMenu>
                    <SidebarMenuItem className="cursor-pointer">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip >
                          <TooltipTrigger asChild>
                            <SidebarMenuButton className='group-data-[collapsible=icon]:justify-center' asChild tooltip='Definitions'>
                              <a onClick={() => onNavClick('customresourcedefinitions')}>
                                {getResourceIcon('customresources')}
                                <span className='truncate text-gray-800 dark:text-gray-200 group-data-[collapsible=icon]:hidden'>Definitions</span>
                              </a>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Definitions</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                    {
                      Object.keys(customResourcesNavigation).map((customResourceGroup) => (
                        <Collapsible
                          key={customResourceGroup}
                          asChild
                          open={openMenus[customResourceGroup]}
                          // defaultOpen={openMenus[customResourceGroup]}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <DropdownMenu>
                              <CollapsibleTrigger asChild onClick={() => toggleMenu(customResourceGroup)}>
                                <DropdownMenuTrigger asChild>
                                  <SidebarMenuButton className='group-data-[collapsible=icon]:justify-center' tooltip={customResourceGroup} showTooltipOnExpanded={true}>

                                    <div>
                                      <SvgRenderer
                                        name={customResourcesNavigation[customResourceGroup].resources[0].icon}
                                        minWidth={16}
                                      />
                                    </div>
                                    <span className='truncate text-gray-800 dark:text-gray-200 group-data-[collapsible=icon]:hidden'>{customResourceGroup}</span>
                                    <ChevronRight size={16} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                                  </SidebarMenuButton>
                                </DropdownMenuTrigger>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {
                                    customResourcesNavigation[customResourceGroup].resources.map((customResource) => (
                                      <SidebarMenuSubItem key={customResource.name} className="cursor-pointer">
                                        <TooltipProvider delayDuration={0}>
                                          <Tooltip >
                                            <TooltipTrigger asChild>
                                              <SidebarMenuSubButton asChild isActive={getActiveNav(customResource.name)}>
                                                <a onClick={() => onCustomResourcesNavClick(customResource.route, customResource.name)}>
                                                  <span className="text-gray-600 dark:text-gray-400 group-data-[collapsible=icon]:hidden flex items-center gap-2">
                                                    <SvgRenderer name={customResource.icon} minWidth={16} />
                                                    {customResource.name}
                                                  </span>
                                                </a>
                                              </SidebarMenuSubButton>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                              <p>{customResource.name}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>

                                      </SidebarMenuSubItem>
                                    ))
                                  }


                                </SidebarMenuSub>
                              </CollapsibleContent>
                              {
                                !open && <DropdownMenuContent
                                  className=" min-w-56 rounded-lg"
                                  align="start"
                                  side={isMobile ? "bottom" : "right"}
                                >
                                  <DropdownMenuLabel className="truncate font-medium text-gray-800 dark:text-gray-200">{customResourceGroup}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup className='overflow-auto max-h-64'>
                                    {
                                      customResourcesNavigation[customResourceGroup].resources.map((customResource) => (
                                        <DropdownMenuItem
                                          key={customResource.name}
                                          onClick={() => onCustomResourcesNavClick(customResource.route, customResource.name)}
                                          className="gap-2 p-2 cursor-pointer text-gray-600 dark:text-gray-400"
                                        >
                                          {customResource.name}
                                        </DropdownMenuItem>
                                      )
                                      )
                                    }
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              }

                            </DropdownMenu>
                          </SidebarMenuItem>
                        </Collapsible>
                      ))
                    }
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>
              <SidebarRail />
            </SidebarMainComponent>
          </>
        }

      </div>
    </div>
  );
});
export {
  Sidebar
};