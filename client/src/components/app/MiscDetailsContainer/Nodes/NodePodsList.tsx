import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeaderList, Pods } from "@/types";
import { NODES_ENDPOINT, PODS_ENDPOINT } from "@/constants";
import { createEventStreamQueryObject, defaultSkeletonRow, getEventStreamUrl } from "@/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { DataTable } from "@/components/app/Table";
import { RootState } from "@/redux/store";
import { cn } from "@/lib/utils";
import { kwDetails } from "@/routes";
import { memo } from "react";
import { podsColumnConfig } from "@/utils/ListType/ListDefinations";
import { updateNodePods } from "@/data/Clusters/Nodes/NodePodsSlice";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import useGenerateColumns from "@/components/app/Common/Hooks/TableColumns";
import { useSidebar } from "@/components/ui/sidebar";

const NodePodsList = memo(function () {
  const { config } = kwDetails.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const {
    loading,
    nodePodDetails
  } = useAppSelector((state: RootState) => state.nodePods);
  const { open } = useSidebar();
  const dispatch = useAppDispatch();

  const sendMessage = (message: Pods[]) => {
    dispatch(updateNodePods(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      NODES_ENDPOINT,
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
    <div className="mt-2">
      <Card className="rounded-lg shadow-none">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Pods <span className="text-xs">({nodePodDetails.length})</span></CardTitle>
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
                    headersList: podsColumnConfig(config, cluster, false).headersList,
                    instanceType: PODS_ENDPOINT,
                    count: nodePodDetails.length,
                  })
                }
                data={loading ? defaultSkeletonRow() : nodePodDetails}
                tableWidthCss={cn("rounded-md border-r rounded-md border-l", open ? 'deployment-list-table-max-width-expanded' : 'deployment-list-table-max-width-collapsed')}
                instanceType={PODS_ENDPOINT}
                showToolbar={false}
                showNamespaceFilter={false}
                setShowChat={() => { }}
                showChat={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export {
  NodePodsList
};