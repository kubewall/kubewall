import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/Table";
import { HeaderList } from "@/types";
import { createEventStreamQueryObject, defaultSkeletonRow, getEventStreamUrl } from "@/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { kwDetails, appRoute } from "@/routes";
import { jobsColumnConfig } from "@/utils/ListType/ListDefinations";
import { updateCronJobJobs } from "@/data/Workloads/CronJobs/CronJobJobsSlice";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import useGenerateColumns from "@/components/app/Common/Hooks/TableColumns";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CRON_JOBS_ENDPOINT, JOBS_ENDPOINT } from "@/constants";
import { toast } from "sonner";

const CronJobDetailsContainer = memo(function () {
  const { config } = appRoute.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const navigate = useNavigate();
  const {
    loading,
    cronJobJobDetails
  } = useAppSelector((state) => state.cronJobJobs);
  const { open } = useSidebar();
  const dispatch = useAppDispatch();

  const sendMessage = (message: any[]) => {
    dispatch(updateCronJobJobs(message));
  };

  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  useEventSource({
    url: getEventStreamUrl(
      CRON_JOBS_ENDPOINT,
      createEventStreamQueryObject(
        config,
        cluster,
        namespace
      ),
      `/${namespace}/${resourcename}/jobs`
    ),
    sendMessage,
    onConfigError: handleConfigError,
  });

  const handleViewJobs = () => {
    navigate({ 
      to: `/${config}/list?cluster=${encodeURIComponent(cluster)}&resourcekind=${JOBS_ENDPOINT}&namespace=${encodeURIComponent(namespace || '')}&owner=cronjob&ownerName=${encodeURIComponent(resourcename)}` 
    });
  };

  // Don't render if we don't have the required data
  if (!config || !cluster || !resourcename || !namespace) {
    return null;
  }

  return (
    <div className="mt-2">
      <Card className="rounded-lg">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Jobs</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewJobs}
            className="text-xs"
          >
            View All Jobs
          </Button>
        </CardHeader>
        <CardContent className="pl-4 pr-4">
          <div className="col-span-7">
            <div className="h-full">
              <DataTable
                columns={
                  useGenerateColumns<any, HeaderList>({
                    clusterName: cluster,
                    configName: config,
                    loading,
                    headersList: jobsColumnConfig(config, cluster).headersList,
                    instanceType: JOBS_ENDPOINT,
                    count: cronJobJobDetails.length,
                    queryParams: new URLSearchParams({ config, cluster, namespace: namespace || '' }).toString()
                  })
                }
                data={loading ? defaultSkeletonRow() : cronJobJobDetails}
                tableWidthCss={cn("border-r border-l", open ? 'deployment-list-table-max-width-expanded' : 'deployment-list-table-max-width-collapsed')}
                instanceType={JOBS_ENDPOINT}
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
  CronJobDetailsContainer
};
