import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cronJobTrigger, resetCronJobTrigger } from "@/data/Workloads/CronJobs/CronJobTriggerSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { Play, PlayIcon, PauseIcon } from "lucide-react";
import { toast } from "sonner";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";

type CronJobTriggerProps = {
  resourcename: string;
  queryParams: string;
}

const CronJobTrigger = ({ resourcename, queryParams }: CronJobTriggerProps) => {
  const {
    loading,
    error,
    message,
    jobName
  } = useAppSelector((state: RootState) => state.cronJobTrigger);
  const {
    cronJobDetails
  } = useAppSelector((state: RootState) => state.cronJobDetails);
  const [modalOpen, setModalOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Parse config, cluster, namespace from provided queryParams string
  const qp = useMemo(() => new URLSearchParams(queryParams), [queryParams]);
  const config = qp.get('config') || '';
  const cluster = qp.get('cluster') || '';
  const namespaceFromQP = qp.get('namespace') || '';

  const [canTrigger, setCanTrigger] = useState<boolean>(true);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);
  const [canSuspend, setCanSuspend] = useState<boolean>(true);
  const [checkingSuspendPermission, setCheckingSuspendPermission] = useState<boolean>(false);
  const [isSuspendLoading, setIsSuspendLoading] = useState<boolean>(false);
  const [localSuspendState, setLocalSuspendState] = useState<boolean>(false);

  const namespaceForCheck = useMemo(
    () => namespaceFromQP || cronJobDetails?.metadata?.namespace || '',
    [namespaceFromQP, cronJobDetails]
  );

  // Initialize local suspend state from cronJobDetails
  useEffect(() => {
    if (cronJobDetails?.spec?.suspend !== undefined) {
      setLocalSuspendState(cronJobDetails.spec.suspend || false);
    }
  }, [cronJobDetails?.spec?.suspend]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!config || !cluster) return;
      setCheckingPermission(true);
      setCheckingSuspendPermission(true);
      
      try {
        // Check trigger permission
        const triggerQp: Record<string, string> = { config, cluster, resourcekind: 'cronjobs', verb: 'create', subresource: 'jobs' };
        if (namespaceForCheck) triggerQp['namespace'] = namespaceForCheck;
        const triggerUrl = `${API_VERSION}/permissions/check?${new URLSearchParams(triggerQp).toString()}`;
        const triggerRes = await kwFetch(triggerUrl, { method: 'GET' });
        setCanTrigger(Boolean((triggerRes as any)?.allowed));
        
        // Check suspend permission
        const suspendQp: Record<string, string> = { config, cluster, resourcekind: 'cronjobs', verb: 'patch' };
        if (namespaceForCheck) suspendQp['namespace'] = namespaceForCheck;
        const suspendUrl = `${API_VERSION}/permissions/check?${new URLSearchParams(suspendQp).toString()}`;
        const suspendRes = await kwFetch(suspendUrl, { method: 'GET' });
        setCanSuspend(Boolean((suspendRes as any)?.allowed));
      } catch (_) {
        setCanTrigger(false);
        setCanSuspend(false);
      } finally {
        setCheckingPermission(false);
        setCheckingSuspendPermission(false);
      }
    };
    checkPermissions();
  }, [config, cluster, namespaceForCheck]);

  const triggerCronJob = () => {
    dispatch(cronJobTrigger({
      name: resourcename,
      namespace: namespaceForCheck,
      queryParams
    }));
  };

  const handleSuspendToggle = async () => {
    setIsSuspendLoading(true);
    const newSuspendState = !localSuspendState;
    
    try {
      const queryParams = new URLSearchParams({
        config,
        cluster,
      }).toString();
      
      const url = `${API_VERSION}/cronjobs/${namespaceForCheck}/${resourcename}/suspend?${queryParams}`;
      
      await kwFetch(url, {
        method: 'PATCH',
        body: JSON.stringify({ suspend: newSuspendState }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Update local state immediately for instant UI feedback
      setLocalSuspendState(newSuspendState);
      
      const action = newSuspendState ? 'suspended' : 'resumed';
      toast.success('Success', {
        description: `CronJob ${action} successfully`,
      });
    } catch (error: any) {
      toast.error('Error', {
        description: error?.message || 'Failed to update CronJob suspend state',
      });
    } finally {
      setIsSuspendLoading(false);
    }
  };

  const resetDialog = () => {
    setModalOpen(false);
  };

  useEffect(() => {
    if (message && jobName) {
      toast.success("Success", {
        description: message,
      });
      dispatch(resetCronJobTrigger());
      resetDialog();
      
      // Redirect to the created job
      navigate({
        to: `/${config}/details`,
        search: {
          cluster,
          resourcekind: 'jobs',
          resourcename: jobName,
          namespace: namespaceForCheck
        }
      });
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetCronJobTrigger());
      resetDialog();
    }
  }, [message, error, jobName, dispatch, navigate, config, cluster, namespaceForCheck, queryParams]);

  const suspendButtonText = localSuspendState ? 'Resume' : 'Suspend';
  const SuspendIcon = localSuspendState ? PlayIcon : PauseIcon;
  const suspendTooltipText = localSuspendState 
    ? 'Resume this CronJob to allow scheduled executions' 
    : 'Suspend this CronJob to prevent scheduled executions';

  return (
    <div className="flex items-center gap-2">
      {/* Suspend/Resume Button */}
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSuspendToggle}
              disabled={isSuspendLoading || checkingSuspendPermission || !canSuspend}
              className="right-0 mt-1 rounded z-10 border w-20 mr-1"
            >
              {isSuspendLoading ? (
                <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
              ) : (
                <SuspendIcon className="h-4 w-4" />
              )}
              <span className='text-xs'>{suspendButtonText}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {checkingSuspendPermission ? 'Checking permissions...' : (!canSuspend ? "You don't have permission to suspend/resume" : suspendTooltipText)}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Trigger Button */}
      <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {(() => {
                const isDisabled = loading || checkingPermission || !canTrigger;
                const buttonEl = (
                  <Button
                    disabled={isDisabled}
                    variant='ghost'
                    size='icon'
                    className='right-0 mt-1 rounded z-10 border w-20 mr-1'
                    onClick={() => setModalOpen(true)}
                  >
                    {loading ? (
                      <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
                    ) : (
                      <Play className='h-4 w-4' />
                    )}
                    <span className='text-xs'>Trigger</span>
                  </Button>
                );
                return isDisabled ? (
                  <span className="inline-flex" role="button" aria-disabled tabIndex={0}>
                    {buttonEl}
                  </span>
                ) : (
                  <DialogTrigger asChild>
                    {buttonEl}
                  </DialogTrigger>
                );
              })()} 
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {checkingPermission ? 'Checking permissions...' : (!canTrigger ? "You don't have permission to trigger" : 'Trigger CronJob')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger CronJob</DialogTitle>
          <DialogDescription>
            <div className="mt-2">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">CronJob:</span>
                  <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                    {resourcename}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Namespace:</span>
                  <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                    {namespaceForCheck}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2">
                  This will create a new job from the CronJob template and redirect you to the job details page.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button
            className="md:w-2/4 w-full"
            type="submit"
            onClick={resetDialog}
          >Cancel</Button>
          <Button
            onClick={triggerCronJob}
            className="md:w-2/4 w-full"
            type="submit"
            disabled={loading}
          >Trigger</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export {
  CronJobTrigger
};
