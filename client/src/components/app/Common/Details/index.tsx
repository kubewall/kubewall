import { Link, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDetailsWrapper, useFetchDataForDetails } from "../Hooks/Details";

import { CaretLeftIcon } from "@radix-ui/react-icons";
import { Events } from "../../Details/Events";
import FourOFourError from "../../Errors/404Error";
import { Loader } from "../../Loader";
import { Overview } from "../../Details/Overview";
import { PODS_ENDPOINT } from "@/constants";
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
import { kwDetails } from "@/routes";
import { resetYamlDetails } from "@/data/Yaml/YamlSlice";
import { useAppSelector } from "@/redux/hooks";
import { useDispatch } from "react-redux";
import { useEffect } from "react";

const KwDetails = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { config } = kwDetails.useParams();
  const { cluster, resourcekind, resourcename, group = '', kind = '', resource = '', version = '', namespace } = kwDetails.useSearch();
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const queryParamsObj: Record<string, string> = { config, cluster, namespace: namespace || '' };
  useEffect(() => {
    dispatch(resetYamlDetails());
    dispatch(clearLogs());
  }, []);

  const resourceInitialData = useFetchDataForDetails({ cluster, config, group, kind, namespace, resource, resourcekind, resourcename, version });
  const resourceData = useDetailsWrapper({ loading: !!resourceInitialData?.loading, resourcekind });
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
            {resourceInitialData.label}
          </Link>
        </span>
      </div>

      <div className="h-screen flex-1 flex-col space-y-2 pt-0 p-2 md:flex">
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
                    <TabsTrigger value='yaml'>YAML</TabsTrigger>
                    <TabsTrigger value='events'>Events</TabsTrigger>
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
                      instanceType={resourcekind}
                      namespace={namespace || ''}
                    />
                  </TabsContent>
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
