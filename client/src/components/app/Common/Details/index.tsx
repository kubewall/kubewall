import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDetailsWrapper, useFetchDataForDetails } from "../Hooks/Details";

import { CaretLeftIcon } from "@radix-ui/react-icons";
import { Events } from "../../Details/Events";
import FourOFourError from "../../Errors/404Error";
import { Link } from "@tanstack/react-router";
import { Loader } from "../../Loader";
import { Overview } from "../../Details/Overview";
import { PODS_ENDPOINT } from "@/constants";
import { PodLogs } from "../../MiscDetailsContainer";
import { RootState } from "@/redux/store";
import { YamlEditor } from "../../Details/YamlEditor";
import { clearLogs } from "@/data/Workloads/Pods/PodLogsSlice";
import { kwDetails } from "@/routes";
import { resetYamlDetails } from "@/data/Yaml/YamlSlice";
import { useAppSelector } from "@/redux/hooks";
import { useDispatch } from "react-redux";
import { useEffect } from "react";

const KwDetails = () => {
  const dispatch = useDispatch();
  const { config, cluster } = kwDetails.useParams();
  const { resourcekind, resourcename, group='', kind='', resource='', version='', namespace } = kwDetails.useSearch();
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);

  useEffect(() => {
    dispatch(resetYamlDetails());
    dispatch(clearLogs());
  },[]);

  const resourceInitialData = useFetchDataForDetails({cluster, config, group, kind, namespace, resource, resourcekind, resourcename, version});
  const resourceData = useDetailsWrapper({loading:!!resourceInitialData?.loading, resourcekind});
  if (!resourceInitialData) {
    return <FourOFourError />;
  }
 
  const getListPageQueryparams = () => {
    const qp : Record<string, string> = {
      resourcekind: resourcekind
    };
    if(resourceInitialData.label === 'Custom Resources') {
      qp['group'] = group;
      qp['kind'] = kind;
      qp['resource'] = resource;
      qp['version'] = version;
    }
    return new URLSearchParams(qp).toString();
  };
 
  return (
    <>
      <span className="text-xs text-blue-600 dark:text-blue-500 hover:underline">
        <Link to={`/${config}/${cluster}/list?${getListPageQueryparams()}`} className="flex items-center pl-3 pt-4">
          <CaretLeftIcon className="h-3.5 w-3.5" />
          {resourceInitialData.label}
        </Link>
      </span>
      <div className="h-screen flex-1 flex-col space-y-2 pt-0 p-4 md:flex">
        {
          resourceInitialData?.loading ? <Loader /> :
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {resourceData?.subHeading}
                  </h2>
                </div>

              </div>
              {resourceData &&
                <Tabs defaultValue='overview'>
                  <TabsList className="grid w-full grid-cols-6 md:grid-cols-10 sm:grid-cols-4">
                    <TabsTrigger value='overview' autoFocus={true}>Overview</TabsTrigger>
                    <TabsTrigger value='yaml'>YAML</TabsTrigger>
                    <TabsTrigger value='events'>Events</TabsTrigger>
                    {resourceInitialData.label.toLowerCase() === PODS_ENDPOINT && <TabsTrigger value='logs'>Logs</TabsTrigger>}
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
                      instanceType={`${resourcekind}${resourceInitialData.label === 'Custom Resources' && namespace ?  '/' + namespace : ''}`}
                      namespace={namespace || ''}
                      extraQuery={resourceInitialData.label === 'Custom Resources' ? '&' + new URLSearchParams({group,kind,resource,version}).toString() : ''}
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
                </Tabs>
              }
            </>
        }
      </div>
    </>
  );
};

export {
  KwDetails
};
