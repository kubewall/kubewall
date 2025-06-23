import { Dialog, DialogContent, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { deploymentScale, resetDeploymentScale } from "@/data/Workloads/Deployments/DeploymentScaleSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { ScaleIcon, SlidersHorizontal, XIcon } from "lucide-react";
import { toast } from "sonner";
type ScaleDeploymentsProps = {
  resourcename: string;
  queryParams: string;
}

const ScaleDeployments = ({ resourcename, queryParams }: ScaleDeploymentsProps) => {
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.deploymentScale);
  const {
    deploymentDetails
  } = useAppSelector((state: RootState) => state.deploymentDetails);
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const dispatch = useAppDispatch();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Allow empty input so user can clear
    if (inputValue === '') {
      setValue('');
      return;
    }

    // Only digits allowed
    if (/^\d+$/.test(inputValue)) {
      // Remove leading zeros unless it's just "0"
      if (inputValue.length > 1 && inputValue.startsWith('0')) {
        inputValue = inputValue.replace(/^0+/, '0');
      }

      // After removing leading zeros, check for max value
      const numericValue = Number(inputValue);
      if (numericValue <= 2147483647) {
        setValue(inputValue);
      } else {
        // If over max, don't update OR clamp it
        setValue('2147483647');
      }
    }
  };

  const updateDeploymentScale = () => {
    dispatch(deploymentScale({
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
      dispatch(resetDeploymentScale());
      resetDialog();
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetDeploymentScale());
      resetDialog();
    }
  }, [message, error]);


  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                disabled={loading}
                variant='ghost'
                size='icon'
                className='right-0 mt-1 rounded z-10 border w-20 mr-1'
                onClick={() => setModalOpen(true)}
              >
                {
                  loading ?
                    <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                    <SlidersHorizontal className='h-4 w-4' />
                }
                <span className='text-xs'>Scale</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Scale Deployment
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scale Deployment</DialogTitle>
          <DialogDescription className="text-sm">
            Update the number of replicas for the deployment.
          </DialogDescription>
          <DialogDescription>
            <div className="mt-3 space-y-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Current Replicas:</span>
                <span className="px-2 py-1 rounded bg-muted text-black">
                  {deploymentDetails.status.replicas}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="desired-replicas" className="w-32 font-medium text-foreground">
                  Desired Replicas:
                </label>
                <Input
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && value) {
                      e.preventDefault();
                      updateDeploymentScale();
                    }
                  }}
                  id="desired-replicas"
                  type="number"
                  min="0"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  placeholder="e.g. 5"
                  onChange={handleChange}
                  value={value}
                />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline"><XIcon className="h-4 w-4" />Cancel</Button>
          </DialogClose>
          <Button type="submit" onClick={updateDeploymentScale}><ScaleIcon className="h-4 w-4" />Scale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
};

export {
  ScaleDeployments
};
