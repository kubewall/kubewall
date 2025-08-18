import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { daemonSetRestart, resetDaemonSetRestart } from "@/data/Workloads/DaemonSets/DaemonSetRestartSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";

type RestartDaemonSetsProps = {
  resourcename: string;
  queryParams: string;
}

const RestartDaemonSets = ({ resourcename, queryParams }: RestartDaemonSetsProps) => {
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.daemonSetRestart);
  const {
    daemonSetDetails
  } = useAppSelector((state: RootState) => state.daemonSetDetails);
  const [modalOpen, setModalOpen] = useState(false);
  const dispatch = useAppDispatch();
  
  // Parse config, cluster, namespace from provided queryParams string
  const qp = useMemo(() => new URLSearchParams(queryParams), [queryParams]);
  const config = qp.get('config') || '';
  const cluster = qp.get('cluster') || '';
  const namespaceFromQP = qp.get('namespace') || '';

  const [canRestart, setCanRestart] = useState<boolean>(true);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);

  const namespaceForCheck = useMemo(
    () => namespaceFromQP || daemonSetDetails?.metadata?.namespace || '',
    [namespaceFromQP, daemonSetDetails]
  );

  useEffect(() => {
    const checkPermission = async () => {
      if (!config || !cluster) return;
      setCheckingPermission(true);
      try {
        const qp: Record<string, string> = { config, cluster, resourcekind: 'daemonsets', verb: 'patch' };
        if (namespaceForCheck) qp['namespace'] = namespaceForCheck;
        const url = `${API_VERSION}/permissions/check?${new URLSearchParams(qp).toString()}`;
        const res = await kwFetch(url, { method: 'GET' });
        setCanRestart(Boolean((res as any)?.allowed));
      } catch (_) {
        setCanRestart(false);
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermission();
  }, [config, cluster, namespaceForCheck]);

  const updateDaemonSetRestart = () => {
    dispatch(daemonSetRestart({
      name: resourcename,
      queryParams,
      restartType: 'rolling'
    }));
  };

  const resetDialog = () => {
    setModalOpen(false);
  };

  useEffect(() => {
    if (message) {
      toast.success("Success", {
        description: message,
      });
      dispatch(resetDaemonSetRestart());
      resetDialog();
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetDaemonSetRestart());
      resetDialog();
    }
  }, [message, error]);


  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {(() => {
              const isDisabled = loading || checkingPermission || !canRestart;
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
                    <RotateCcw className='h-4 w-4' />
                  )}
                  <span className='text-xs'>Restart</span>
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
            {checkingPermission ? 'Checking permissions...' : (!canRestart ? "You don't have permission to restart" : 'Restart DaemonSet')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restart DaemonSet</DialogTitle>
          <DialogDescription>
            <div className="mt-2">
              <div className="flex flex-col gap-4 text-sm">
                <p>
                  Are you sure you want to restart the daemonset <strong>{resourcename}</strong>?
                </p>
                <p className="text-muted-foreground">
                  This will perform a rolling restart of all pods in the DaemonSet.
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
            onClick={updateDaemonSetRestart}
            className="md:w-2/4 w-full"
            type="submit"
          >Restart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export {
  RestartDaemonSets
};