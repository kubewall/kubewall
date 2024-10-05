import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CUSTOM_RESOURCES_ENDPOINT, NAVIGATION_ROUTE } from "@/constants";
import { ComponentIcon, DatabaseIcon, LayersIcon, LayoutGridIcon, NetworkIcon, ShieldHalf, SlidersHorizontalIcon, UngroupIcon } from "lucide-react";
import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme, toggleValueInCollection } from "@/utils";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { CustomResources } from "@/types";
import { SidebarNavigator } from "./Navigator";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import kwLogoDark from '../../../assets/kw-dark-theme.svg';
import kwLogoLight from '../../../assets/kw-light-theme.svg';
import { resetCustomResourcesList } from "@/data/CustomResources/CustomResourcesListSlice";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { updateCustomResources } from "@/data/CustomResources/CustomResourcesSlice";
import { useEventSource } from "../Common/Hooks/EventSource";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
}


const Sidebar = memo(function ({ className }: SidebarProps) {
  const [activeTab, setActiveTab] = useState('');
  const [activeAccordion, setActiveAccordion] = useState<string[]>([]);
  const [activeCustomResourcesAccordian, setActiveCustomResourcesAccordian] = useState<string[]>([]);
  const setButtonClass = (currentTab: string) => {
    return currentTab.toLowerCase() === activeTab.toLowerCase() ? 'default' : 'ghost';
  };
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

  useEffect(() => {
    const currentRoute = new URL(location.href).searchParams.get('resourcekind') || '';
    if (currentRoute.toLowerCase() === 'customresources') {
      setActiveAccordion([...activeAccordion, 'customResources']);
      setActiveCustomResourcesAccordian([...activeCustomResourcesAccordian, queryParams.get('group') || '']);
      setActiveTab((queryParams.get('kind') || '').toLowerCase());
    } else if(currentRoute.toLowerCase() === 'customresourcedefinitions') {
      setActiveAccordion([...activeAccordion, 'customResources']);
      setActiveTab(currentRoute.toLowerCase());
    }
    else {
      for (const category in NAVIGATION_ROUTE) {
        const isCurrentRoutePresent = NAVIGATION_ROUTE[category].some(({ route }) => route === currentRoute.toLowerCase());
        if (isCurrentRoutePresent) {
          setActiveAccordion([...activeAccordion, category]);
          setActiveTab(currentRoute.toLowerCase());
        }
      }
    }
  }, [location.href]);

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

  const updateOpenAccordian = (selectedAccordian: string) => {
    setActiveAccordion((prevItems) => toggleValueInCollection(prevItems, selectedAccordian));
  };

  const updateOpenCustomResourceAccordian = (selectedAccordian: string) => {
    setActiveCustomResourcesAccordian((prevItems) => toggleValueInCollection(prevItems, selectedAccordian));
  };

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
  return (
    <div className={cn("col-span-1", className)}>
      <div className="h-screen flex space-y-4 py-1">
        <div className="px-2 py-2">
          <div className="flex items-center justify-between">
            <img className="w-28" src={getSystemTheme() === 'light' ? kwLogoLight : kwLogoDark} alt="kubewall" />
          </div>
          <SidebarNavigator />
          <div className="sidebar-max-height overflow-auto">
            <Accordion type="multiple" value={activeAccordion}>
              {
                Object.keys(NAVIGATION_ROUTE).map((route) => {
                  return (
                    <AccordionItem value={route} key={route}>
                      <AccordionTrigger onClick={() => { updateOpenAccordian(route); }}>
                        <div className="flex items-center space-x-1">
                          {getResourceIcon(route.toLowerCase().split(' ').join(''))}
                          <span>{route}</span>
                        </div>

                      </AccordionTrigger>
                      {/* </div> */}

                      <AccordionContent>
                        {
                          NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
                            return (
                              <Button
                                onClick={() => onNavClick(routeValue)}
                                variant={setButtonClass(routeValue)}
                                size="sm"
                                className="w-full justify-start"
                                key={routeValue}
                              >
                                {name}
                              </Button>
                            );
                          })
                        }
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              }
              <AccordionItem value='customResources' key='customResources'>
                <AccordionTrigger onClick={() => { updateOpenAccordian('customResources'); }}>
                  <div className="flex items-center space-x-1">
                    {getResourceIcon('customesources')}
                    <span>Custom Resources</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="border-b pb-2">
                  <Button
                    onClick={() => onNavClick('customresourcedefinitions')}
                    variant={setButtonClass('customresourcedefinitions')}
                    size="sm"
                    className="text-sm w-full justify-start  shadow-none hover:rounded-md"
                  >
                    Definitions
                  </Button>
                  </div>
                  <Accordion type="multiple" value={activeCustomResourcesAccordian}>
                    {
                      Object.keys(customResourcesNavigation).map((customResourceGroup) => {
                        return (
                          <AccordionItem value={customResourceGroup} key={customResourceGroup}>
                            <AccordionTrigger onClick={() => { updateOpenCustomResourceAccordian(customResourceGroup); }}>
                              <div className="flex items-center space-x-1">
                                <ComponentIcon width={12} />
                                <span>{customResourceGroup}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              {
                                customResourcesNavigation[customResourceGroup].resources.map((customResource) => {
                                  return (
                                    <Button
                                      onClick={() => onCustomResourcesNavClick(customResource.route, customResource.name)}
                                      variant={setButtonClass(customResource.name)}
                                      size="sm"
                                      className="w-full justify-start"
                                      key={customResource.name}
                                    >
                                      {customResource.name}
                                    </Button>
                                  );
                                })
                              }
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })
                    }
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
});
export {
  Sidebar
};