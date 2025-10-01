import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlugZap, UnplugIcon, XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { portForwarding, resetPortForwarding } from "@/data/Workloads/Pods/PortForwardingSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { toast } from "sonner";

type ServicesPortForwardingProps = {
  resourcename: string;
  queryParams: string;
  config: string;
  cluster: string;
}

const ServicesPortForwarding = ({ resourcename, queryParams, config, cluster }: ServicesPortForwardingProps) => {
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.portForwarding);
  const {
    serviceDetails
  } = useAppSelector((state: RootState) => state.serviceDetails);
  const {
    portForwardingList
  } = useAppSelector((state: RootState) => state.portForwardingList);
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const [containerPort, setContainerPort] = useState('');
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
    }
    setValue(inputValue);
  };

  const savePortForwarding = () => {
    dispatch(portForwarding({
      queryParams,
      name: serviceDetails.metadata.name || "",
      containerPort: Number(containerPort.split('/')[1]),
      localPort: Number(value),
      namespace: serviceDetails.metadata.namespace || "",
      kind: "service"
    }));
    setModalOpen(false);
  };

  const resetDialog = () => {
    setValue('');
    setContainerPort('');
    setModalOpen(false);
  };

  useEffect(() => {
    if (message) {
      toast.success("Success", {
        description: message,
      });
      dispatch(resetPortForwarding());
      resetDialog();
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetPortForwarding());
      resetDialog();
    }
  }, [message, error]);

  const setContainerPortSelection = (val: string) => {
    setContainerPort(val);
  };

  const isPortForwardDisabled = !value || !containerPort;

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
                className='z-10 border w-8 mr-1 h-8'
                onClick={() => setModalOpen(true)}
              >
                {
                  loading ?
                    <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                    portForwardingList.filter(item => item.kind === "Service" && item.name === resourcename).length > 0 ? <PlugZap className='h-4 w-4' /> : <UnplugIcon className='h-4 w-4' />
                }
                {/* <span className='text-xs'>Port Forwarding</span> */}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Port Forwarding
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Port Forwarding</DialogTitle>
          <DialogDescription className="text-sm">
            Update the port forwarding settings for the service.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 space-y-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <label htmlFor="localPort" className="font-medium text-foreground">
              Local Port:
            </label>
            <Input
              defaultValue={0}
              id="localPort"
              type="number"
              min="0"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm "
              placeholder="e.g. 8080"
              onChange={handleChange}
              value={value}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-medium text-foreground">
              Container:
            </label>
            <Select onValueChange={setContainerPortSelection} value={containerPort}>
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder="Select Service Port" />
              </SelectTrigger>
              <SelectContent>
                {
                  serviceDetails.spec.ports?.map((portObj) => {
                    if (!portObj || portObj.protocol?.toLowerCase() !== 'tcp') return null;
                    const protocol = portObj.protocol ? portObj.protocol + '/' : '';
                    const port = portObj.port;
                    return (
                      <SelectItem key={`${protocol}${port}`} value={`${protocol}${port}`}>
                        {protocol}{port}
                      </SelectItem>
                    );
                  })
                }
              </SelectContent>
            </Select>
          </div>

          {
            portForwardingList.filter(item => item.name === resourcename).length > 0 && (
              <div>
                <span className="text-xs">You have <strong>{portForwardingList.filter(item => item.kind === "Service" && item.name === resourcename).length}</strong> port forwarding rules for this pod.
                  Click <Link className="text-blue-600" to={`/${config}/list?cluster=${cluster}&resourcekind=portforwards`}>here</Link> to view them.
                </span>
              </div>
            )
          }
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline"><XIcon className="h-4 w-4" />Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isPortForwardDisabled} onClick={savePortForwarding}><UnplugIcon className="h-4 w-4" />Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
};

export {
  ServicesPortForwarding
};
