import { CRON_JOBS_ENDPOINT, JOBS_ENDPOINT } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeaderList, Jobs, JobsResponse } from "@/types";
import { createEventStreamQueryObject, defaultSkeletonRow, getEventStreamUrl } from "@/utils";
import { memo, useEffect } from "react";
import { resetCronJobJobs, updateCronJobJobs } from "@/data/Workloads/CronJobs/CronJobJobsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { DataTable } from "@/components/app/Table";
import { RootState } from "@/redux/store";
import { cn } from "@/lib/utils";
import { jobsColumnConfig } from "@/utils/ListType/ListDefinations";
import { kwDetails } from "@/routes";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import useGenerateColumns from "@/components/app/Common/Hooks/TableColumns";
import { useSidebar } from "@/components/ui/sidebar";

const CronJobJobsList = memo(function () {
  const { config } = kwDetails.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const {
    loading,
    cronJobJobDetails
  } = useAppSelector((state: RootState) => state.cronJobJobs);
  const { open } = useSidebar();
  const dispatch = useAppDispatch();

  const sendMessage = (message: JobsResponse[]) => {
    dispatch(updateCronJobJobs(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      CRON_JOBS_ENDPOINT,
      createEventStreamQueryObject(
        config,
        cluster,
        namespace
      ),
      `/${resourcename}/jobs`
    ),
    sendMessage
  });

  // Clear on the way out so navigating to another CronJob shows skeleton rows
  // rather than the previous one's jobs until its first event arrives.
  useEffect(() => {
    return () => {
      dispatch(resetCronJobJobs());
    };
  }, [dispatch, resourcename, namespace]);

  return (
    <div className="mt-2">
      <Card className="rounded-lg shadow-none">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Jobs <span className="text-xs">({cronJobJobDetails.length})</span></CardTitle>
        </CardHeader>
        <CardContent className="pl-4 pr-4">
          <div className="col-span-7">
            <div className="h-full">
              <DataTable
                columns={
                  useGenerateColumns<Jobs, HeaderList>({
                    clusterName: cluster,
                    configName: config,
                    loading,
                    headersList: jobsColumnConfig(config, cluster, false).headersList,
                    instanceType: JOBS_ENDPOINT,
                    count: cronJobJobDetails.length,
                  })
                }
                data={loading ? defaultSkeletonRow() : cronJobJobDetails}
                tableWidthCss={cn("rounded-md border-r rounded-md border-l", open ? 'deployment-list-table-max-width-expanded' : 'deployment-list-table-max-width-collapsed')}
                instanceType={JOBS_ENDPOINT}
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
  CronJobJobsList
};
