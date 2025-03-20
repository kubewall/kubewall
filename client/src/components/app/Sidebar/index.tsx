import './index.css';

import { CUSTOM_RESOURCES_ENDPOINT, NAVIGATION_ROUTE } from "@/constants";
import { ChevronRight, ComponentIcon, DatabaseIcon, LayersIcon, LayoutGridIcon, NetworkIcon, ShieldHalf, SlidersHorizontalIcon, UngroupIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarHeader, Sidebar as SidebarMainComponent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme } from "@/utils";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";

import { CustomResources } from "@/types";
import { SidebarNavigator } from "./Navigator";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import kwLogoDark from '../../../assets/kw-dark-theme.svg';
import kwLogoDarkIcon from '../../../assets/kw-dark-theme-icon.svg';
import kwLogoLight from '../../../assets/kw-light-theme.svg';
import kwLogoLightIcon from '../../../assets/kw-light-theme-icon.svg';
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
  const { open, isMobile } = useSidebar();

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

  const getActive = (route: string) => {
    const currentRoute = new URL(location.href).searchParams.get('resourcekind') || '';
    if (currentRoute.toLowerCase() === 'customresources') {
      return route === queryParams.get('group');
    }
    if (currentRoute.toLowerCase() !== 'customresourcedefinitions') {
      for (const category in NAVIGATION_ROUTE) {
        const isCurrentRoutePresent = NAVIGATION_ROUTE[category].some(({ route }) => route === currentRoute.toLowerCase());
        if (isCurrentRoutePresent) {
          return category === route;
        }
      }
    }
    return false;
  };

  const getActiveNAv = (route: string, check = false) => {
    return route === (!check ? queryParams.get('kind') : queryParams.get('resourcekind'));
  };
  return (
    <div className={cn("col-span-1", className)}>
      <div className="h-screen space-y-4 py-1">
        {
          <>
            <SidebarMainComponent collapsible="icon">

              <SidebarHeader>
                <SidebarMenu>
                  <SidebarMenuItem className="cursor-pointer">
                    <SidebarMenuButton asChild>
                      <a onClick={() => onNavClick('pods')} id="kubewall-icon">
                        <img
                          className={`transition-all duration-300 ease-in-out ${open ? "w-28" : "w-20 max-w-none"}`}
                          src={getSystemTheme() === 'light' ? (open ? kwLogoLight : kwLogoLightIcon) : (open ? kwLogoDark : kwLogoDarkIcon)}
                          alt="kubewall"
                        />

                      </a>
                    </SidebarMenuButton>
                    <SidebarNavigator />
                  </SidebarMenuItem>
                </SidebarMenu>

              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarMenu>
                    {
                      Object.keys(NAVIGATION_ROUTE).map((route) => (
                        <Collapsible
                          key={route}
                          asChild
                          defaultOpen={getActive(route)}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <DropdownMenu>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton tooltip={route}>
                                  <DropdownMenuTrigger asChild>
                                    {getResourceIcon(route.toLowerCase().split(' ').join(''))}
                                  </DropdownMenuTrigger>
                                  <span>{route}</span>
                                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {
                                    NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
                                      return (
                                        <SidebarMenuSubItem key={routeValue} className="cursor-pointer">
                                          <SidebarMenuSubButton asChild isActive={getActiveNAv(routeValue, true)}>
                                            <a onClick={() => onNavClick(routeValue)}>
                                              <span>{name}</span>
                                            </a>
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      );
                                    })
                                  }

                                </SidebarMenuSub>
                              </CollapsibleContent>

                              <DropdownMenuContent
                                className=" min-w-56 rounded-lg"
                                align="start"
                                side={isMobile ? "bottom" : "right"}
                                sideOffset={4}

                              >
                                {
                                  NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
                                    return (
                                      <DropdownMenuItem
                                        key={routeValue}
                                        onClick={() => onNavClick(routeValue)}
                                        className="gap-2 p-2 cursor-pointer"
                                      >
                                        {name}
                                      </DropdownMenuItem>
                                    );
                                  })
                                }

                              </DropdownMenuContent>
                            </DropdownMenu>

                          </SidebarMenuItem>
                        </Collapsible>
                      ))
                    }
                  </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>Custom Resources</SidebarGroupLabel>
                  <SidebarMenu>
                    <SidebarMenuItem className="cursor-pointer">
                      <SidebarMenuButton asChild tooltip='Definitions'>
                        <a onClick={() => onNavClick('customresourcedefinitions')}>
                          {getResourceIcon('customesources')}
                          <span>Definitions</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {
                      Object.keys(customResourcesNavigation).map((customResourceGroup) => (
                        <Collapsible
                          key={customResourceGroup}
                          asChild
                          defaultOpen={getActive(customResourceGroup)}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem >
                            <DropdownMenu>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton tooltip={customResourceGroup}>
                                  <DropdownMenuTrigger asChild>
                                    <ComponentIcon width={16} />
                                  </DropdownMenuTrigger>
                                  <span title={customResourceGroup} className='truncate'>{customResourceGroup}</span>

                                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />

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
                                              <SidebarMenuSubButton asChild isActive={getActiveNAv(customResource.name)}>
                                                <a onClick={() => onCustomResourcesNavClick(customResource.route, customResource.name)}>
                                                  <span>{customResource.name}</span>
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
                              <DropdownMenuContent
                                className=" min-w-56 rounded-lg"
                                align="start"
                                side={isMobile ? "bottom" : "right"}
                                sideOffset={4}

                              >
                                {
                                  customResourcesNavigation[customResourceGroup].resources.map((customResource) => (
                                    <DropdownMenuItem
                                      key={customResource.name}
                                      onClick={() => onCustomResourcesNavClick(customResource.route, customResource.name)}
                                      className="gap-2 p-2 cursor-pointer"
                                    >
                                      {customResource.name}
                                    </DropdownMenuItem>
                                  )
                                  )
                                }
                              </DropdownMenuContent>
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