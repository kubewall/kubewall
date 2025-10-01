import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlugZap, UnplugIcon, XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { portForwarding, resetPortForwarding } from "@/data/Workloads/Pods/PortForwardingSlice";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { Loader } from "../Loader";
import { toast } from "sonner";
import { useAppDispatch } from "@/redux/hooks";

type PortForwardingDialogProps = {
  resourcename: string;
  queryParams: string;
  config: string;
  cluster: string;
  resourceKind: "pod" | "service";
  details: any; // podDetails or serviceDetails
  portForwardingList: any[];
  loading: boolean;
  error: any;
  message: string;
  getPortOptions: () => { value: string; label: string }[];
  getPortValue: (selected: string, custom?: string) => number;
  showCustomPortInput?: boolean;
}

export function PortForwardingDialog({
  resourcename,
  queryParams,
  config,
  cluster,
  resourceKind,
  details,
  portForwardingList,
  loading,
  error,
  message,
  getPortOptions,
  getPortValue,
  showCustomPortInput = false,
}: PortForwardingDialogProps) {
  const dispatch = useAppDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const [containerPort, setContainerPort] = useState('');
  const [customContainerPort, setCustomContainerPort] = useState('');
  const [isCustomPort, setIsCustomPort] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    const id = e.target.id;
    if (inputValue === '') {
      if (id === 'localPort') setValue('');
      else if (id === 'defaultPort') setCustomContainerPort('');
      return;
    }
    if (/^\d+$/.test(inputValue)) {
      if (inputValue.length > 1 && inputValue.startsWith('0')) {
        inputValue = inputValue.replace(/^0+/, '0');
      }
    }
    if (id === 'localPort') setValue(inputValue);
    else if (id === 'defaultPort') setCustomContainerPort(inputValue);
  };

  const savePortForwarding = () => {
    dispatch(portForwarding({
      queryParams,
      name: details.metadata.name,
      containerPort: getPortValue(containerPort, customContainerPort),
      localPort: Number(value),
      namespace: details.metadata.namespace,
      kind: resourceKind,
    }));
    setModalOpen(false);
  };

  const resetDialog = () => {
    setValue('');
    setContainerPort('');
    setCustomContainerPort('');
    setModalOpen(false);
    setIsCustomPort(false);
  };

  useEffect(() => {
    if (message) {
      toast.success("Success", { description: message });
      dispatch(resetPortForwarding())
      resetDialog();
    } else if (error) {
      toast.error("Failure", { description: error.message });
      dispatch(resetPortForwarding())
      resetDialog();
    }
  }, [message, error]);

  const setContainerPortSelection = (val: string) => {
    setContainerPort(val);
    if (showCustomPortInput) {
      const currentPort = val.split(': ')[1];
      if (currentPort) {
        setIsCustomPort(false);
      } else {
        setIsCustomPort(true);
      }
      // setIsCustomPort(val === "custom");
    }
  };

  const isPortForwardDisabled =
    !value ||
    !containerPort ||
    (showCustomPortInput && isCustomPort && !customContainerPort);

  const filteredList = portForwardingList.filter(
    item => item.kind.toLowerCase() === resourceKind && item.name === resourcename
  );

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
                {loading ? (
                  <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
                ) : filteredList.length > 0 ? (
                  <PlugZap className='h-4 w-4' />
                ) : (
                  <UnplugIcon className='h-4 w-4' />
                )}
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
            Update the port forwarding settings for the {resourceKind}.
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
              {resourceKind === "pod" ? "Container:" : "Service Port:"}
            </label>
            <Select onValueChange={setContainerPortSelection} value={containerPort}>
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder={`Select ${resourceKind === "pod" ? "Container" : "Service Port"}`} />
              </SelectTrigger>
              <SelectContent>
                {getPortOptions().map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                {/* {showCustomPortInput && (
                  <SelectItem value="custom">Custom Port</SelectItem>
                )} */}
              </SelectContent>
            </Select>
          </div>
          {showCustomPortInput && isCustomPort && (
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
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">Set the local port to <strong>0</strong> to allow Kubernetes to assign a random port automatically.</span>
          </div>
          {filteredList.length > 0 && (
            <div>
              <span className="text-xs">
                You have <strong>{filteredList.length}</strong> port forwarding rules for this {resourceKind}.
                Click <Link className="text-blue-600" to={`/${config}/list?cluster=${cluster}&resourcekind=portforwards`}>here</Link> to view them.
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline"><XIcon className="h-4 w-4" />Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isPortForwardDisabled} onClick={savePortForwarding}><UnplugIcon className="h-4 w-4" />Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}