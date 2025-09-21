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
import { PodDetailsContainer } from "@/types";
import { RootState } from "@/redux/store";
import { toast } from "sonner";

type ContainersPortForwardingProps = {
  resourcename: string;
  queryParams: string;
  config: string;
  cluster: string;
}

const ContainersPortForwarding = ({ resourcename, queryParams, config, cluster }: ContainersPortForwardingProps) => {
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.portForwarding);
  const {
    podDetails
  } = useAppSelector((state: RootState) => state.podDetails);
  const {
    portForwardingList
  } = useAppSelector((state: RootState) => state.portForwardingList);
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const [containerPort, setContainerPort] = useState('');
  const [customContainerPort, setCustomContainerPort] = useState('');
  const [isCustomPort, setIsCustomPort] = useState(false);
  const dispatch = useAppDispatch();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    const id = e.target.id;
    // Allow empty input so user can clear
    if (inputValue === '') {
      if (id === 'localPort') {
        setValue('');
      }
      else if (id === 'defaultPort') {
        setCustomContainerPort('')
      }
      // setContainerPort('');
      return;
    }

    // Only digits allowed
    if (/^\d+$/.test(inputValue)) {
      // Remove leading zeros unless it's just "0"
      if (inputValue.length > 1 && inputValue.startsWith('0')) {
        inputValue = inputValue.replace(/^0+/, '0');
      }
    }
    if (id === 'localPort') {
      setValue(inputValue);
    } else if (id === 'defaultPort') {
      setCustomContainerPort(inputValue);
    }
  };

  const savePortForwarding = () => {
    dispatch(portForwarding({
      queryParams,
      pod: podDetails.metadata.name,
      containerPort: isCustomPort ? Number(customContainerPort) : Number(containerPort.split(': ')[1]),
      localPort: Number(value),
      namespace: podDetails.metadata.namespace,
      containerName: containerPort.split(': ')[0]
    }));
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

  const getPortNumber = (container: PodDetailsContainer) => {
    const containerPort = (container?.ports?.filter(({ protocol }) => protocol === "TCP"));
    return containerPort ? `: ${containerPort[0]?.containerPort}` : '';
  }

  const setContainerPortSelection = (val: string) => {
    setContainerPort(val);
    const currentPort = val.split(': ')[1];
    if (currentPort) {
      setIsCustomPort(false);
    } else {
      setIsCustomPort(true);
    }
  };

  const isPortForwardDisabled =  !value || !containerPort || (isCustomPort && !customContainerPort);

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
                    portForwardingList.filter(item => item.pod === resourcename).length > 0 ? <PlugZap className='h-4 w-4' /> : <UnplugIcon className='h-4 w-4' />
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
            Update the port forwarding settings for the pod.
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
          {/* <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Local Port:</span>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {deploymentDetails.status.replicas}
            </span>
          </div> */}
          <div className="flex items-center gap-2">
            <label className="font-medium text-foreground">
              Container:
            </label>
            {/* <Input
              onKeyDown={(e) => {
                if (e.key === 'Enter' && value) {
                  e.preventDefault();
                  savePortForwarding();
                }
              }}
              id="desired-replicas"
              type="number"
              min="0"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              placeholder="e.g. 5"
              onChange={handleChange}
              value={value}
            /> */}
            <Select onValueChange={setContainerPortSelection} value={containerPort}>
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder="Select Container" />
              </SelectTrigger>
              <SelectContent>
                {
                  [...(podDetails.spec.initContainers || []), ...(podDetails.spec.containers || [])].map((container) => {
                    const portNumber = getPortNumber(container);
                    return (
                      <SelectItem key={container.name} value={`${container.name}${portNumber}`}>
                        {container.name}{portNumber}
                      </SelectItem>
                    );
                  })
                }
                {/* <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem> */}
              </SelectContent>
            </Select>
          </div>
          {
            isCustomPort &&
            <div className="flex items-center gap-2">
              <label htmlFor="defaultPort" className="font-medium text-foreground">
                Specify Port:
              </label>
              <Input
                defaultValue={0}
                id="defaultPort"
                type="number"
                min="0"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm "
                placeholder="e.g. 8080"
                onChange={handleChange}
                value={customContainerPort}
              />
            </div>
          }

          <div className="mt-2 flex items-center gap-2">
            {/* <span><strong>Note: </strong></span> */}
            <span className="text-sm">Set the local port to <strong>0</strong> to allow Kubernetes to assign a random port automatically.</span>
          </div>
          {
            portForwardingList.filter(item => item.pod === resourcename).length > 0 &&  (
              <div>
                <span className="text-xs">You have <strong>{portForwardingList.filter(item => item.pod === resourcename).length}</strong> port forwarding rules for this pod.
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
  ContainersPortForwarding
};
