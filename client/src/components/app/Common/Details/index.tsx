import { Link } from "@tanstack/react-router";
import { PodLogs, PortForwardingDialog } from "../../MiscDetailsContainer";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createEventStreamQueryObject, getEventStreamUrl } from "@/utils";
import { resetYamlDetails, updateYamlDetails } from "@/data/Yaml/YamlSlice";
import { useDetailsWrapper, useFetchDataForDetails } from "../Hooks/Details";
import { useEffect, useState } from "react";

import { AiChat } from "../../kwAI";
import { CaretLeftIcon } from "@radix-ui/react-icons";
import { Events } from "../../Details/Events";
import FourOFourError from "../../Errors/404Error";
import { Loader } from "../../Loader";
import { Overview } from "../../Details/Overview";
import { PODS_ENDPOINT } from "@/constants";
import { RootState } from "@/redux/store";

import { Separator } from "@/components/ui/separator";
import { Sparkles } from "lucide-react";
import { ThemeModeSelector } from "../ThemeModeSelector";
import { YamlEditor } from "../../Details/YamlEditor";
import { clearLogs } from "@/data/Workloads/Pods/PodLogsSlice";
import { kwDetails } from "@/routes";
import { useAppSelector } from "@/redux/hooks";
import { useDispatch } from "react-redux";
import { useEventSource } from "../Hooks/EventSource";
import { useSidebarSize } from "@/hooks/use-get-sidebar-size";

const KwDetails = () => {
  const dispatch = useDispatch();
  const [showChat, setShowChat] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const { isMobile } = useSidebar();
  const leftSize = useSidebarSize("left-sidebar");
  const { config } = kwDetails.useParams();
  const { cluster, resourcekind, resourcename, group = '', kind = '', resource = '', version = '', namespace } = kwDetails.useSearch();
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const { serviceDetails } = useAppSelector((state: RootState) => state.serviceDetails);
  const { portForwardingList } = useAppSelector((state: RootState) => state.portForwardingList);
  const { loading, error, message } = useAppSelector((state: RootState) => state.portForwarding);
  const queryParamsObj: Record<string, string> = { config, cluster, namespace: namespace || '' };
  const resourceInitialData = useFetchDataForDetails({ cluster, config, group, kind, namespace, resource, resourcekind, resourcename, version });
  const resourceData = useDetailsWrapper({ loading: !!resourceInitialData?.loading, resourcekind });
  useEffect(() => {
    dispatch(resetYamlDetails());
    dispatch(clearLogs());
  }, []);

  // Fetch yaml for kwAi
  const sendMessage = (message: Event[]) => {
    dispatch(updateYamlDetails(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      `${resourcekind}${resourceInitialData?.label === 'Custom Resources' && namespace ? '/' + namespace : ''}`,
      createEventStreamQueryObject(
        config,
        cluster,
        namespace
      ),
      `/${resourcename}/yaml`,
      resourceInitialData?.label === 'Custom Resources' ? '&' + new URLSearchParams({ group, kind, resource, version }).toString() : ''
    ),
    sendMessage
  });

  if (!resourceInitialData) {
    return <FourOFourError />;
  }

  document.title = `kubewall - ${resourceInitialData.label.toLowerCase()} - ${resourceData?.subHeading}`;

  const getListPageQueryparams = () => {
    const qp: Record<string, string> = {
      cluster: cluster,
      resourcekind: resourcekind
    };
    if (resourceInitialData.label === 'Custom Resources') {
      qp['group'] = group;
      qp['kind'] = kind;
      qp['resource'] = resource;
      qp['version'] = version;
    }
    return new URLSearchParams(qp).toString();
  };

  const onChatClose = () => {
    setShowChat(false);
    setFullScreen(false);
  };

  const getMaxWidth = () => {
    if (isMobile) {
      return 48;
    } else {
      return 47 + leftSize.width;
    }
  };

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 pl-2">
        <span className="text-xs text-blue-600 dark:text-blue-500 hover:underline flex items-center">
          <Link to={`/${config}/list?${getListPageQueryparams()}`} className="flex items-center">
            <CaretLeftIcon className="h-3.5 w-3.5 mr-1" />
            {resourceInitialData.label}
          </Link>
        </span>
      </div>

      <div className="h-screen flex-1 flex-col space-y-2 pt-0 p-2 md:flex" style={{ width: `calc(100vw - ${(getMaxWidth())}px)` }}>
        {
          resourceInitialData?.loading ? <Loader /> :
            <>
              <div className="flex items-center justify-between gap-1 mt-1">
                <SidebarTrigger />
                <Separator orientation="vertical" className="data-[orientation=vertical]:h-4 mr-2" />
                <h2 className="text-lg font-bold tracking-tight">
                  {resourceData?.subHeading}
                </h2>
                <div className="ml-auto">
                  {
                    resourcekind === 'pods' &&
                    <PortForwardingDialog
                      resourcename={resourcename}
                      queryParams={new URLSearchParams(queryParamsObj).toString()}
                      config={config}
                      cluster={cluster}
                      resourceKind="pod"
                      details={podDetails}
                      portForwardingList={portForwardingList}
                      loading={loading}
                      error={error}
                      message={message}
                      getPortOptions={() =>
                        [...(podDetails.spec.initContainers || []), ...(podDetails.spec.containers || [])].map(container => {
                          const portObj = container.ports?.find(p => p.protocol?.toLowerCase() === 'tcp');
                          return {
                            value: `${container.name}${portObj ? `: ${portObj.containerPort}` : ""}`,
                            label: `${container.name}${portObj ? `: ${portObj.containerPort}` : ""}`,
                          };
                        })
                      }
                      getPortValue={(selected, custom) =>
                        custom ? Number(custom) : Number(selected.split(": ")[1])
                      }
                      showCustomPortInput={true}
                    />
                  }
                  {
                    resourcekind === 'services' &&
                    <PortForwardingDialog
                      resourcename={resourcename}
                      queryParams={new URLSearchParams(queryParamsObj).toString()}
                      config={config}
                      cluster={cluster}
                      resourceKind="service"
                      details={serviceDetails}
                      portForwardingList={portForwardingList}
                      loading={loading}
                      error={error}
                      message={message}
                      getPortOptions={() =>
                        serviceDetails.spec.ports?.filter(portObj => portObj?.protocol?.toLowerCase() === 'tcp').map(portObj => ({
                          value: `${portObj?.protocol}/${portObj?.port}`,
                          label: `${portObj?.protocol}/${portObj?.port}`,
                        })) || []
                      }
                      getPortValue={selected => Number(selected.split('/')[1])}
                    />
                  }
                  <ThemeModeSelector />
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div className="ml-2 relative inline-block cursor-pointer" onClick={() => setShowChat(!showChat)}>
                          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-600 to-blue-500 rounded-sm blur-[3px] animate-pulse"></div>
                          <div className="relative inline-flex i gap-[0.125rem] w-12 h-8 bg-background rounded-md flex items-center justify-center border border-gray-200 dark:border-none shadow-sm  hover:bg-accent hover:text-accent-foreground">
                            <Sparkles className="w-4 h-4" />
                            <span className='text-xs'>AI</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        kwAI Chat
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

              </div>
              {resourceData &&
                <Tabs defaultValue='overview'>
                  <TabsList className="grid w-full grid-cols-6 md:grid-cols-6 sm:grid-cols-4 mb-2">
                    <TabsTrigger value='overview' autoFocus={true}>Overview</TabsTrigger>
                    <TabsTrigger value='yaml'>YAML</TabsTrigger>
                    <TabsTrigger value='events'>Events</TabsTrigger>
                    {resourceInitialData.label.toLowerCase() === PODS_ENDPOINT && <TabsTrigger value='logs'>Logs</TabsTrigger>}
                  </TabsList>

                  <ResizablePanelGroup
                    direction="horizontal"
                  >
                    {
                      !fullScreen &&
                      <ResizablePanel className="border-t-0 mr-2 min-w-80 !overflow-auto" id="details" order={1} defaultSize={showChat ? 55 : 100}>
                        <TabsContent className="mt-0" value='overview'>
                          <Overview
                            details={[resourceData.detailCard]}
                            lableConditions={resourceData.lableConditionsCardDetails}
                            annotations={resourceData.annotationCardDetails}
                            miscComponent={resourceData.miscComponent}
                          />
                        </TabsContent>
                        <TabsContent className="mt-0" value='yaml'>
                          <YamlEditor
                            name={resourcename}
                            configName={config}
                            clusterName={cluster}
                            instanceType={`${resourcekind}${resourceInitialData.label === 'Custom Resources' && namespace ? '/' + namespace : ''}`}
                            namespace={namespace || ''}
                            extraQuery={resourceInitialData.label === 'Custom Resources' ? '&' + new URLSearchParams({ group, kind, resource, version }).toString() : ''}
                          />
                        </TabsContent>
                        <TabsContent className="mt-0" value='events'>
                          <Events
                            name={resourcename}
                            configName={config}
                            clusterName={cluster}
                            instanceType={resourcekind}
                            namespace={namespace || ''}
                          />
                        </TabsContent>
                        {
                          resourceInitialData.label.toLowerCase() === PODS_ENDPOINT &&
                          <TabsContent className="mt-0" value='logs'>
                            <PodLogs
                              name={podDetails?.metadata?.name}
                              configName={config}
                              clusterName={cluster}
                              namespace={podDetails?.metadata?.namespace}
                            />
                          </TabsContent>

                        }
                      </ResizablePanel>
                    }
                    {
                      showChat &&
                      <>
                        {!fullScreen && <ResizableHandle withHandle className="mt-2 w-0" />}
                        <ResizablePanel className="border-t border-r border-l rounded-lg" id="ai-chat" order={2} minSize={30} defaultSize={fullScreen ? 100 : 45}>
                          <AiChat isDetailsPage={true} customHeight="chatbot-details-height" onClose={onChatClose} isFullscreen={fullScreen} onToggleFullscreen={() => setFullScreen(!fullScreen)} />
                        </ResizablePanel>
                      </>
                    }
                  </ResizablePanelGroup>
                </Tabs>

              }

            </>
        }
      </div>
    </div>
  );
};

export {
  KwDetails
};
