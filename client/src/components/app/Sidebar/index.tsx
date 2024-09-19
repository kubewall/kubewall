import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CUSTOM_RESOURCES_ENDPOINT, NAVIGATION_ROUTE } from "@/constants";
import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme } from "@/utils";
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
  const [activeAccordion, setActiveAccordion] = useState('');
  const [activeCustomResourcesAccordian, setActiveCustomResourcesAccordian] = useState('');
  const setButtonClass = (currentTab: string) => {
    return currentTab.toLowerCase() === activeTab.toLowerCase() ? 'default' : 'ghost';
  };
  const router = useRouterState();
  const navigate = useNavigate();
  const routerForce = useRouter();
  const dispatch = useAppDispatch();
  const configName = router.location.pathname.split('/')[1];
  const clusterName = router.location.pathname.split('/')[2];
  const queryParams = new URLSearchParams(router.location.search);
  const {
    clusters
  } = useAppSelector((state) => state.clusters);
  const {
    customResourcesNavigation
  } = useAppSelector((state) => state.customResources);

  useEffect(() => {
    const currentRoute = new URL(location.href).searchParams.get('resourcekind') || '';
    if (currentRoute.toLowerCase() === 'customresources') {
      setActiveAccordion('customResources');
      setActiveCustomResourcesAccordian(queryParams.get('group') || '');
      setActiveTab((queryParams.get('kind') || '').toLowerCase());
    }
    else {
      for (const category in NAVIGATION_ROUTE) {
        const isCurrentRoutePresent = NAVIGATION_ROUTE[category].some(({ route }) => route === currentRoute.toLowerCase());
        if (isCurrentRoutePresent) {
          setActiveAccordion(category);
          setActiveTab(currentRoute.toLowerCase());
        }
      }
      setActiveCustomResourcesAccordian('');
    }
  }, [location.href]);

  const onNavClick = (routeValue: string, route: string) => {
    dispatch(resetListTableFilter());
    setActiveTab(routeValue);
    navigate({ to: `/${configName}/${clusterName}/list?resourcekind=${routeValue}` });
    setActiveAccordion(route);
    routerForce.invalidate();
  };

  const onCustomResourcesNavClick = (key: string, route: string, name: string) => {
    dispatch(resetListTableFilter());
    setActiveCustomResourcesAccordian(key);
    const routeKeys = new URLSearchParams(route);
    setActiveTab((routeKeys.get('kind') || '').toLowerCase());
    if (activeTab.toLowerCase() !== name.toLowerCase()) {
      dispatch(resetCustomResourcesList());
    }

    navigate({ to: `/${configName}/${clusterName}/list?resourcekind=customresources&${route}` });
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

  return (
    <div className={cn("col-span-1", className)}>
      <div className="h-screen flex space-y-4 py-1">
        <div className="px-2 py-2 basis-[100%]">
          <div className="flex items-center justify-between">
            <img className="w-28" src={getSystemTheme() === 'light' ? kwLogoLight : kwLogoDark} alt="kubewall" />
          </div>
          <SidebarNavigator />
          <div className="list-table-max-height overflow-auto">
            <Accordion type="single" value={activeAccordion}>
              {
                Object.keys(NAVIGATION_ROUTE).map((route) => {
                  return (
                    <AccordionItem value={route} key={route}>
                      <AccordionTrigger onClick={() => { setActiveAccordion(route); }}>{route}</AccordionTrigger>
                      <AccordionContent>
                        {
                          NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
                            return (
                              <Button
                                onClick={() => onNavClick(routeValue, route)}
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
                <AccordionTrigger onClick={() => { setActiveAccordion('customResources'); }}>Custom Resources</AccordionTrigger>
                <AccordionContent>
                  <Accordion type="single" value={activeCustomResourcesAccordian}>
                    {
                      Object.keys(customResourcesNavigation).map((customResourceGroup) => {
                        return (
                          <AccordionItem value={customResourceGroup} key={customResourceGroup}>
                            <AccordionTrigger onClick={() => { setActiveCustomResourcesAccordian(customResourceGroup); }}>{customResourceGroup}</AccordionTrigger>
                            <AccordionContent>
                              {
                                customResourcesNavigation[customResourceGroup].resources.map((customResource) => {
                                  return (
                                    <Button
                                      onClick={() => onCustomResourcesNavClick(customResourceGroup, customResource.route, customResource.name)}
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