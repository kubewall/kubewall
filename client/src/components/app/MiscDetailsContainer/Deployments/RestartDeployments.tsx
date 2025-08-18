import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { deploymentRestart, resetDeploymentRestart } from "@/data/Workloads/Deployments/DeploymentRestartSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";

type RestartDeploymentsProps = {
  resourcename: string;
  queryParams: string;
}

const RestartDeployments = ({ resourcename, queryParams }: RestartDeploymentsProps) => {
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.deploymentRestart);
  const {
    deploymentDetails
  } = useAppSelector((state: RootState) => state.deploymentDetails);
  const [modalOpen, setModalOpen] = useState(false);
  const [restartType, setRestartType] = useState<'rolling' | 'recreate'>('rolling');
  const dispatch = useAppDispatch();
  
  // Parse config, cluster, namespace from provided queryParams string
  const qp = useMemo(() => new URLSearchParams(queryParams), [queryParams]);
  const config = qp.get('config') || '';
  const cluster = qp.get('cluster') || '';
  const namespaceFromQP = qp.get('namespace') || '';

  const [canRestart, setCanRestart] = useState<boolean>(true);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);

  const namespaceForCheck = useMemo(
    () => namespaceFromQP || deploymentDetails?.metadata?.namespace || '',
    [namespaceFromQP, deploymentDetails]
  );

  useEffect(() => {
    const checkPermission = async () => {
      if (!config || !cluster) return;
      setCheckingPermission(true);
      try {
        const qp: Record<string, string> = { config, cluster, resourcekind: 'deployments', verb: 'update' };
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

  const handleRestart = () => {
    dispatch(deploymentRestart({
      name: resourcename,
      queryParams,
      restartType
    }));
  };

  const resetDialog = () => {
    setModalOpen(false);
    setRestartType('rolling'); // Reset to default
  };

  useEffect(() => {
    if (message) {
      const successMessage = restartType === 'recreate' 
        ? "Recreate restart initiated - pods will be restarted in the background"
        : "Rolling restart initiated - pods will be replaced gradually";
      
      toast.success("Success", {
        description: successMessage,
      });
      dispatch(resetDeploymentRestart());
      resetDialog();
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetDeploymentRestart());
      resetDialog();
    }
  }, [message, error, restartType]);

  const getRestartTypeDescription = (type: 'rolling' | 'recreate') => {
    if (type === 'rolling') {
      return "Gradually replaces pods one by one, maintaining availability during the restart process.";
    } else {
      return "Terminates all pods at once and creates new ones. This will cause a brief service interruption.";
    }
  };

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
            {checkingPermission ? 'Checking permissions...' : (!canRestart ? "You don't have permission to restart" : 'Restart Deployment')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restart Deployment</DialogTitle>
          <DialogDescription>
            <div className="mt-2">
              <div className="flex flex-col gap-4 text-sm">
                <p>
                  Are you sure you want to restart the deployment <strong>{resourcename}</strong>?
                </p>
                
                <div className="space-y-3">
                  <Label className="text-base font-medium">Restart Strategy:</Label>
                  <RadioGroup value={restartType} onValueChange={(value: 'rolling' | 'recreate') => setRestartType(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rolling" id="rolling" />
                      <Label htmlFor="rolling" className="font-medium">Rolling Restart</Label>
                    </div>
                    <p className="text-muted-foreground ml-6 text-xs">
                      {getRestartTypeDescription('rolling')}
                    </p>
                    
                    <div className="flex items-center space-x-2 mt-3">
                      <RadioGroupItem value="recreate" id="recreate" />
                      <Label htmlFor="recreate" className="font-medium">Recreate Restart</Label>
                    </div>
                    <p className="text-muted-foreground ml-6 text-xs">
                      {getRestartTypeDescription('recreate')}
                    </p>
                  </RadioGroup>
                </div>
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
            onClick={handleRestart}
            className="md:w-2/4 w-full"
            type="submit"
            variant="destructive"
          >Restart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export {
  RestartDeployments
};
