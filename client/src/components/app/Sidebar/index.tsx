import './index.css';

import { CUSTOM_RESOURCES_ENDPOINT, NAVIGATION_ROUTE } from "@/constants";
import { ChevronRight, DatabaseIcon, LayersIcon, LayoutGridIcon, NetworkIcon, ShieldHalf, SlidersHorizontalIcon, UngroupIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarContent, SidebarGroup, SidebarGroupLabel, Sidebar as SidebarMainComponent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme } from "@/utils";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";

import { CustomResources } from "@/types";
import { SidebarNavigator } from "./Navigator";
import { SvgRenderer } from '../Common/SvgRenderer';
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import kwLogoDark from '../../../assets/kw-dark-theme.svg';
import kwLogoDarkIcon from '../../../assets/kw-dark-theme-icon.svg';
import kwLogoLight from '../../../assets/kw-light-theme.svg';
import kwLogoLightIcon from '../../../assets/kubewall-logo-dark.svg';
import { resetCustomResourcesList } from "@/data/CustomResources/CustomResourcesListSlice";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { updateCustomResources } from "@/data/CustomResources/CustomResourcesSlice";
import { useEventSource } from "../Common/Hooks/EventSource";

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
      Object.keys(NAVIGATION_ROUTE).forEach((category) => {
        if (NAVIGATION_ROUTE[category].some(({ route }) => route === currentRoute)) {
          setOpenMenus(() => ({
            [category]: true,
          }));
          return;
        }
      });
    }
  }, []);


  const toggleMenu = (route: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [route]: !prev[route],
    }));
  };

  const onNavClick = (routeValue: string) => {
    dispatch(resetListTableFilter());
    setActiveTab(routeValue);
    navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=${routeValue}` });
    routerForce.invalidate();
  };

  const onCustomResourcesNavClick = (route: string, name: string) => {
    dispatch(resetListTableFilter());
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


  const sendMessage = (message: CustomResources[]) => {
    dispatch(updateCustomResources(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      CUSTOM_RESOURCES_ENDPOINT,
      createEventStreamQueryObject(
        configName,
        clusterName
      )),
    sendMessage
  });

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
      default:
        return <LayersIcon width={16} />;
    }
  };

  const getActiveNav = (route: string, check = false) => {
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
                              className={`transition-all duration-300 ease-in-out ${open || openMobile ? "w-28" : "w-4 max-w-none"}`}
                              src={getSystemTheme() === 'light' ? (open || openMobile ? kwLogoLight : kwLogoLightIcon) : (open || openMobile ? kwLogoDark : kwLogoDarkIcon)}
                              alt="kubewall"
                            />

                          </a>
                        </div>
                      </SidebarMenuButton>
                      <SidebarNavigator setOpenMenus={setOpenMenus} />
                    </SidebarMenuItem>
                    {
                      Object.keys(NAVIGATION_ROUTE).map((route) => (
                        <Collapsible
                          key={route}
                          asChild
                          open={openMenus[route]}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <DropdownMenu>
                              <CollapsibleTrigger asChild onClick={(e) => { toggleMenu(route); e.stopPropagation(); }}>
                                <SidebarMenuButton className='group-data-[collapsible=icon]:justify-center' tooltip={route} showTooltipOnExpanded={true}>
                                  <DropdownMenuTrigger asChild>
                                    {getResourceIcon(route.toLowerCase().split(' ').join(''))}
                                  </DropdownMenuTrigger>
                                  <span className='truncate text-gray-800 dark:text-gray-200 group-data-[collapsible=icon]:hidden'>{route}</span>
                                  <ChevronRight size={16} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {
                                    NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
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
                                  sideOffset={12}

                                >
                                  <DropdownMenuLabel className="truncate font-medium text-gray-800 dark:text-gray-200">{route}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup className='overflow-auto max-h-64'>
                                    {
                                      NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
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
                                {getResourceIcon('customesources')}
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
                                <SidebarMenuButton className='group-data-[collapsible=icon]:justify-center' tooltip={customResourceGroup} showTooltipOnExpanded={true}>
                                  <DropdownMenuTrigger asChild>
                                    <div>
                                      <SvgRenderer
                                        name={customResourcesNavigation[customResourceGroup].resources[0].icon}
                                      />
                                    </div>
                                    {/* <ComponentIcon size={16} /> */}
                                  </DropdownMenuTrigger>
                                  <span className='truncate text-gray-800 dark:text-gray-200 group-data-[collapsible=icon]:hidden'>{customResourceGroup}</span>
                                  <ChevronRight size={16} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                                </SidebarMenuButton>
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
                                                  <span className="text-gray-600 dark:text-gray-400 group-data-[collapsible=icon]:hidden">{customResource.name}</span>
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
                                  sideOffset={12}

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