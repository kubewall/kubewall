import { Link, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDetailsWrapper, useFetchDataForDetails } from "../Hooks/Details";

import { CaretLeftIcon } from "@radix-ui/react-icons";
import helmLogo from '../../../../assets/helm-logo.png';
import { Events } from "../../Details/Events";
import FourOFourError from "../../Errors/404Error";
import { Loader } from "../../Loader";
import { Overview } from "../../Details/Overview";
import { PODS_ENDPOINT, HELM_RELEASES_ENDPOINT } from "@/constants";
import { PodLogs } from "../../MiscDetailsContainer";
import { PodExec } from "../../MiscDetailsContainer/PodExec";
import { RootState } from "@/redux/store";
import { Row } from "@tanstack/react-table";
import { ScaleDeployments } from "../../MiscDetailsContainer/Deployments/ScaleDeployments";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TableDelete } from "../../Table/TableDelete";
import { YamlEditor } from "../../Details/YamlEditor";
import { clearLogs } from "@/data/Workloads/Pods/PodLogsSlice";
import { kwDetails, appRoute } from "@/routes";
import { resetYamlDetails } from "@/data/Yaml/YamlSlice";
import { fetchHelmReleaseResources } from "@/data/Helm/HelmReleaseResourcesSlice";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { HelmReleaseHistory } from "../../Details/HelmReleaseHistory";
import { HelmReleaseValues } from "../../Details/HelmReleaseValues";
import { HelmReleaseResources } from "../../Details/HelmReleaseResources";

const KwDetails = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const router = useRouterState();
  const { config } = appRoute.useParams();
  const { cluster, resourcekind, resourcename, group = '', kind = '', resource = '', version = '', namespace } = kwDetails.useSearch();
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const { clusters, loading: clustersLoading } = useAppSelector((state: RootState) => state.clusters);
  const queryParamsObj: Record<string, string> = { config, cluster, namespace: namespace || '' };
  const hasShownConfigNotFoundToast = useRef(false);
  
  useEffect(() => {
    dispatch(resetYamlDetails());
    dispatch(clearLogs());
  }, []);

  // Fetch Helm release resources when component mounts for Helm releases
  useEffect(() => {
    if (resourcekind === HELM_RELEASES_ENDPOINT) {
      dispatch(fetchHelmReleaseResources({
        config: config,
        cluster: cluster,
        releaseName: resourcename,
        namespace: namespace || ''
      }));
    }
  }, [dispatch, config, cluster, resourcename, namespace, resourcekind]);

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

  const resourceInitialData = useFetchDataForDetails({ cluster, config, group, kind, namespace, resource, resourcekind, resourcename, version });
  const resourceData = useDetailsWrapper({ loading: !!resourceInitialData?.loading, resourcekind });
  if (!resourceInitialData) {
    return <FourOFourError />;
  }

  document.title = `Facets KubeDash - ${resourceInitialData.label.toLowerCase()} - ${resourceData?.subHeading}`;

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
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  const selectedRows = [
    {
      original: {
        name: resourcename,
        namespace
      }
    }
  ] as Row<any>[];
  /* eslint-enable  @typescript-eslint/no-explicit-any */

  const redirectToListPage = () => {
    navigate({ to: `/${config}/list?${getListPageQueryparams()}` });
  };

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 pl-2">
        <span className="text-xs text-blue-600 dark:text-blue-500 hover:underline flex items-center">
          <Link to={`/${config}/list?${getListPageQueryparams()}`} className="flex items-center">
            <CaretLeftIcon className="h-3.5 w-3.5 mr-1" />
            {resourcekind === 'helmreleases' ? (
              <img src={helmLogo} alt="Helm" className="h-3.5 w-3.5 mr-1" />
            ) : null}
            {resourceInitialData.label}
          </Link>
        </span>
      </div>

      <div className="min-h-screen flex-1 flex-col space-y-2 pt-0 p-2 md:flex">
        {
          resourceInitialData?.loading ? <Loader /> :
            <>
              <div className="flex items-center justify-between">
                <SidebarTrigger />
                <Separator orientation="vertical" className="mr-2 h-4 ml-1" />
                <div className="ml-1">
                  <h2 className="text-lg font-bold tracking-tight">
                    {resourceData?.subHeading}
                  </h2>
                </div>
                <div className="ml-auto">
                  {
                    resourcekind === 'deployments' && 
                    <ScaleDeployments resourcename={resourcename} queryParams={new URLSearchParams(queryParamsObj).toString()}/>
                  }
                  
                  <TableDelete selectedRows={selectedRows} postDeleteCallback={redirectToListPage} />
                </div>

              </div>
              {resourceData &&
                <Tabs defaultValue='overview'>
                  <TabsList className="grid w-full grid-cols-6 md:grid-cols-6 sm:grid-cols-4">
                    <TabsTrigger value='overview' autoFocus={true}>Overview</TabsTrigger>
                    {resourcekind === 'helmreleases' ? (
                      <>
                        <TabsTrigger value='history'>History</TabsTrigger>
                        <TabsTrigger value='values'>Values</TabsTrigger>
                        <TabsTrigger value='resources'>Resources</TabsTrigger>
                      </>
                    ) : (
                      <>
                        <TabsTrigger value='yaml'>YAML</TabsTrigger>
                        <TabsTrigger value='events'>Events</TabsTrigger>
                      </>
                    )}
                    {resourceInitialData.label.toLowerCase() === PODS_ENDPOINT && <TabsTrigger value='logs'>Logs</TabsTrigger>}
                    {resourceInitialData.label.toLowerCase() === PODS_ENDPOINT && <TabsTrigger value='exec'>Exec</TabsTrigger>}
                  </TabsList>

                  <TabsContent value='overview'>
                    <Overview
                      details={[resourceData.detailCard]}
                      lableConditions={resourceData.lableConditionsCardDetails}
                      annotations={resourceData.annotationCardDetails}
                      miscComponent={resourceData.miscComponent}
                    />
                  </TabsContent>
                  
                  {resourcekind === 'helmreleases' ? (
                    <>
                      <TabsContent value='history' className="h-full">
                        <HelmReleaseHistory
                          name={resourcename}
                          configName={config}
                          clusterName={cluster}
                          namespace={namespace || ''}
                        />
                      </TabsContent>
                      <TabsContent value='values' className="h-full">
                        <HelmReleaseValues
                          name={resourcename}
                          configName={config}
                          clusterName={cluster}
                          namespace={namespace || ''}
                        />
                      </TabsContent>
                      <TabsContent value='resources'>
                        <HelmReleaseResources
                          name={resourcename}
                          configName={config}
                          clusterName={cluster}
                          namespace={namespace || ''}
                        />
                      </TabsContent>
                    </>
                  ) : (
                    <>
                      <TabsContent value='yaml'>
                        <YamlEditor
                          name={resourcename}
                          configName={config}
                          clusterName={cluster}
                          instanceType={`${resourcekind}${resourceInitialData.label === 'Custom Resources' && namespace ? '/' + namespace : ''}`}
                          namespace={namespace || ''}
                          extraQuery={resourceInitialData.label === 'Custom Resources' ? '&' + new URLSearchParams({ group, kind, resource, version }).toString() : ''}
                        />
                      </TabsContent>
                      <TabsContent value='events'>
                        <Events
                          name={resourcename}
                          configName={config}
                          clusterName={cluster}
                          instanceType={resourcekind === 'pods' ? 'pod' : resourcekind}
                          namespace={namespace || ''}
                        />
                      </TabsContent>
                    </>
                  )}
                  
                  {
                    resourceInitialData.label.toLowerCase() === PODS_ENDPOINT &&
                    <TabsContent value='logs'>
                      <PodLogs
                        name={podDetails?.metadata?.name}
                        configName={config}
                        clusterName={cluster}
                        namespace={podDetails?.metadata?.namespace}
                      />
                    </TabsContent>
                  }
                  {
                    resourceInitialData.label.toLowerCase() === PODS_ENDPOINT &&
                    <TabsContent value='exec'>
                      <PodExec
                        pod={podDetails?.metadata?.name}
                        configName={config}
                        clusterName={cluster}
                        namespace={podDetails?.metadata?.namespace}
                        podDetailsSpec={podDetails?.spec}
                      />
                    </TabsContent>
                  }
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
