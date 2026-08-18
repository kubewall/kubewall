import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeaderList, Pods } from "@/types";
import { createEventStreamQueryObject, defaultSkeletonRow, getEventStreamUrl } from "@/utils";
import { memo, useEffect } from "react";
import { resetWorkloadPods, updateWorkloadPods } from "@/data/Workloads/WorkloadPodsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { DataTable } from "@/components/app/Table";
import { PODS_ENDPOINT } from "@/constants";
import { RootState } from "@/redux/store";
import { cn } from "@/lib/utils";
import { kwDetails } from "@/routes";
import { podsColumnConfig } from "@/utils/ListType/ListDefinations";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import useGenerateColumns from "@/components/app/Common/Hooks/TableColumns";
import { useSidebar } from "@/components/ui/sidebar";

type WorkloadPodsListProps = {
  /**
   * Endpoint of the workload being viewed - the pods it owns are served under
   * `<endpoint>/<name>/pods`.
   */
  endpoint: string;
};

const WorkloadPodsList = memo(function ({ endpoint }: WorkloadPodsListProps) {
  const { config } = kwDetails.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const {
    loading,
    workloadPodDetails
  } = useAppSelector((state: RootState) => state.workloadPods);
  const { open } = useSidebar();
  const dispatch = useAppDispatch();

  const sendMessage = (message: Pods[]) => {
    dispatch(updateWorkloadPods(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      endpoint,
      createEventStreamQueryObject(
        config,
        cluster,
        namespace
      ),
      `/${resourcename}/pods`
    ),
    sendMessage
  });

  // Clear on the way out so navigating to another workload shows skeleton rows
  // rather than the previous workload's pods until its first event arrives.
  useEffect(() => {
    return () => {
      dispatch(resetWorkloadPods());
    };
  }, [dispatch, endpoint, resourcename, namespace]);

  return (
    <div className="mt-2">
      <Card className="rounded-lg shadow-none">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Pods <span className="text-xs">({workloadPodDetails.length})</span></CardTitle>
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
                    count: workloadPodDetails.length,
                  })
                }
                data={loading ? defaultSkeletonRow() : workloadPodDetails}
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
  WorkloadPodsList
};
