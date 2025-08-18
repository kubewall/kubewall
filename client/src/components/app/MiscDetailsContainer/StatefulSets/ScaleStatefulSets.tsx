import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { statefulSetScale, resetStatefulSetScale } from "@/data/Workloads/StatefulSets/StatefulSetScaleSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";

type ScaleStatefulSetsProps = {
  resourcename: string;
  queryParams: string;
}

const ScaleStatefulSets = ({ resourcename, queryParams }: ScaleStatefulSetsProps) => {
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.statefulSetScale);
  const {
    statefulSetDetails
  } = useAppSelector((state: RootState) => state.statefulSetDetails);
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const dispatch = useAppDispatch();
  
  // Parse config, cluster, namespace from provided queryParams string
  const qp = useMemo(() => new URLSearchParams(queryParams), [queryParams]);
  const config = qp.get('config') || '';
  const cluster = qp.get('cluster') || '';
  const namespaceFromQP = qp.get('namespace') || '';

  const [canScale, setCanScale] = useState<boolean>(true);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);

  const namespaceForCheck = useMemo(
    () => namespaceFromQP || statefulSetDetails?.metadata?.namespace || '',
    [namespaceFromQP, statefulSetDetails]
  );

  useEffect(() => {
    const checkPermission = async () => {
      if (!config || !cluster) return;
      setCheckingPermission(true);
      try {
        const qp: Record<string, string> = { config, cluster, resourcekind: 'statefulsets', verb: 'update', subresource: 'scale' };
        if (namespaceForCheck) qp['namespace'] = namespaceForCheck;
        const url = `${API_VERSION}/permissions/check?${new URLSearchParams(qp).toString()}`;
        const res = await kwFetch(url, { method: 'GET' });
        setCanScale(Boolean((res as any)?.allowed));
      } catch (_) {
        setCanScale(false);
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermission();
  }, [config, cluster, namespaceForCheck]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '' || /^\d+$/.test(inputValue)) {
      setValue(inputValue);
    }
  };

  const updateStatefulSetScale = () => {
    dispatch(statefulSetScale({
      name: resourcename,
      replicaCount: Number(value),
      queryParams
    }));
  };

  const resetDialog = () => {
    setValue('');
    setModalOpen(false);
  };

  useEffect(() => {
    if (message) {
      toast.success("Success", {
        description: message,
      });
      dispatch(resetStatefulSetScale());
      resetDialog();
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetStatefulSetScale());
      resetDialog();
    }
  }, [message, error]);


  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {(() => {
              const isDisabled = loading || checkingPermission || !canScale;
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
                    <SlidersHorizontal className='h-4 w-4' />
                  )}
                  <span className='text-xs'>Scale</span>
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
            {checkingPermission ? 'Checking permissions...' : (!canScale ? "You don't have permission to scale" : 'Scale StatefulSet')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scale StatefulSet</DialogTitle>
          <DialogDescription>
            <div className="mt-2">
              <div className="flex flex-col gap-4 text-sm">
                <p>
                  Are you sure you want to scale the statefulset <strong>{resourcename}</strong>?
                </p>
                <div className="flex items-center gap-2">
                  <label htmlFor="desired-replicas" className="text-sm font-medium">
                    Desired Replicas:
                  </label>
                  <Input
                    id="desired-replicas"
                    type="number"
                    min="0"
                    className="w-50 shadow-none h-7 text-sm rounded-sm px-1"
                    placeholder="e.g. 5"
                    onChange={handleChange}
                    value={value}
                  />
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
            onClick={updateStatefulSetScale}
            className="md:w-2/4 w-full"
            type="submit"
            disabled={!value}
          >Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export {
  ScaleStatefulSets
};