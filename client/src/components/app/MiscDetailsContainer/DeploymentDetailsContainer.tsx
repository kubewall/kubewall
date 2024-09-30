import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEPLOYMENT_ENDPOINT, PODS_ENDPOINT } from "@/constants";
import { HeaderList, Pods } from "@/types";
import { createEventStreamQueryObject, defaultSkeletonRow, getEventStreamUrl } from "@/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { DataTable } from "@/components/app/Table";
import { RootState } from "@/redux/store";
import { kwDetails } from "@/routes";
import { memo } from "react";
import { podsColumnConfig } from "@/utils/ListType/ListDefinations";
import { updateDeploymentPods } from "@/data/Workloads/Deployments/DeploymentPodsSlice";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import useGenerateColumns from "@/components/app/Common/Hooks/TableColumns";

const DeploymentDetailsContainer = memo(function () {
  const { config } = kwDetails.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const {
    loading,
    deploymentPodDetails
  } = useAppSelector((state: RootState) => state.deploymentPods);

  const dispatch = useAppDispatch();

  const sendMessage = (message: Pods[]) => {
    dispatch(updateDeploymentPods(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      DEPLOYMENT_ENDPOINT,
      createEventStreamQueryObject(
        config,
        cluster,
        namespace
      ),
      `/${resourcename}/pods`
    ),
    sendMessage
  });

  return (

    <div className="mt-4">
      <Card className="rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium">Pods</CardTitle>
        </CardHeader>
        <CardContent className="pl-4 pr-4">
          <div className="col-span-7">
            <div className="h-full">
              <DataTable
                columns={
                  useGenerateColumns<Pods, HeaderList>({
                    clusterName: cluster,
                    configName: config,
                    loading,
                    headersList: podsColumnConfig(config, cluster).headersList,
                    instanceType: PODS_ENDPOINT,
                    count: deploymentPodDetails.length,
                  })
                }
                data={loading ? defaultSkeletonRow() : deploymentPodDetails}
                tableWidthCss="border-r border-l"
                showToolbar={false}
                showNamespaceFilter={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export {
  DeploymentDetailsContainer
};