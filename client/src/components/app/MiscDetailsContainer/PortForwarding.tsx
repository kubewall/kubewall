import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Dices, MoveRight, PlugZap, UnplugIcon, XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { portForwarding, resetPortForwarding } from "@/data/Workloads/Pods/PortForwardingSlice";
import { resetStopPortForwarding, stopPortForwarding } from "@/data/Workloads/Pods/StopPortForwardingSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { Loader } from "../Loader";
import { PortForwardingListResponse } from "@/types";
import { RawRequestError } from "@/data/kwFetch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const RANDOM_LOCAL_PORT_MIN = 10000;
const RANDOM_LOCAL_PORT_MAX = 65535;

type PortOption = {
  value: string;
  label: string;
  containerName?: string;
};

type PortForwardingDialogProps = {
  resourcename: string;
  queryParams: string;
  config: string;
  cluster: string;
  resourceKind: "pod" | "service";
  details: any; // podDetails or serviceDetails
  portForwardingList: PortForwardingListResponse[];
  loading: boolean;
  error: RawRequestError | null;
  message: string;
  getPortOptions: () => PortOption[];
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
  const { stoppingId, message: stopMessage, error: stopError } = useAppSelector((state) => state.stopPortForwarding);
  const [modalOpen, setModalOpen] = useState(false);
  const [localPort, setLocalPort] = useState('');
  const [selectedPortOption, setSelectedPortOption] = useState('');
  const [customContainerPort, setCustomContainerPort] = useState('');
  const [isCustomPort, setIsCustomPort] = useState(false);
  const namespace = details.metadata?.namespace;
  const portOptions = getPortOptions();
  const activeForwards = portForwardingList.filter(
    (forward) => forward.kind.toLowerCase() === resourceKind && forward.name === resourcename && forward.namespace === namespace
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    const id = e.target.id;
    if (inputValue === '') {
      if (id === 'localPort') setLocalPort('');
      else if (id === 'defaultPort') setCustomContainerPort('');
      return;
    }
    if (/^\d+$/.test(inputValue)) {
      if (inputValue.length > 1 && inputValue.startsWith('0')) {
        inputValue = inputValue.replace(/^0+/, '0');
      }
    }
    if (id === 'localPort') setLocalPort(inputValue);
    else if (id === 'defaultPort') setCustomContainerPort(inputValue);
  };

  const generateRandomLocalPort = () => {
    const usedPorts = new Set(portForwardingList.map(({ localPort }) => localPort));
    let randomPort = 0;
    do {
      randomPort = RANDOM_LOCAL_PORT_MIN + Math.floor(Math.random() * (RANDOM_LOCAL_PORT_MAX - RANDOM_LOCAL_PORT_MIN + 1));
    } while (usedPorts.has(randomPort));
    setLocalPort(String(randomPort));
  };

  const selectPortOption = (option: string) => {
    setSelectedPortOption(option);
    if (showCustomPortInput) {
      setIsCustomPort(!option.includes(': '));
    }
  };

  const savePortForwarding = () => {
    dispatch(portForwarding({
      queryParams,
      name: details.metadata.name,
      containerName: portOptions.find(({ value }) => value === selectedPortOption)?.containerName || '',
      containerPort: getPortValue(selectedPortOption, customContainerPort),
      localPort: Number(localPort),
      namespace,
      kind: resourceKind,
    }));
    setModalOpen(false);
  };

  const resetDialog = () => {
    setLocalPort('');
    setSelectedPortOption('');
    setCustomContainerPort('');
    setModalOpen(false);
    setIsCustomPort(false);
  };

  useEffect(() => {
    if (modalOpen && portOptions.length === 1) {
      selectPortOption(portOptions[0].value);
    }
  }, [modalOpen, portOptions.length]);

  useEffect(() => {
    if (message) {
      toast.success("Success", { description: message });
      dispatch(resetPortForwarding());
      resetDialog();
    } else if (error) {
      toast.error("Failure", { description: error.message });
      dispatch(resetPortForwarding());
      resetDialog();
    }
  }, [message, error]);

  useEffect(() => {
    if (stopMessage) {
      toast.success("Success", { description: stopMessage });
      dispatch(resetStopPortForwarding());
    } else if (stopError) {
      toast.error("Failure", { description: stopError.message });
      dispatch(resetStopPortForwarding());
    }
  }, [stopMessage, stopError]);

  const isPortForwardDisabled =
    !localPort ||
    !selectedPortOption ||
    (showCustomPortInput && isCustomPort && !customContainerPort);

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                disabled={loading}
                variant={activeForwards.length > 0 ? 'default' : 'ghost'}
                size='icon'
                className='z-10 border w-8 mr-1 h-8'
                onClick={() => setModalOpen(true)}
              >
                {loading ? (
                  <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
                ) : activeForwards.length > 0 ? (
                  <PlugZap className='h-4 w-4' />
                ) : (
                  <UnplugIcon className='h-4 w-4' />
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Port Forwarding{activeForwards.length > 0 && ` (${activeForwards.length} active)`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Port Forwarding</DialogTitle>
          <DialogDescription className="text-sm">
            Forward a local port to this {resourceKind}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
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
              value={localPort}
            />
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 shrink-0 gap-1.5 px-3 text-xs font-normal text-muted-foreground"
                    onClick={generateRandomLocalPort}
                  >
                    <Dices className="h-4 w-4" />
                    Random
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Pick a random unused port
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-medium text-foreground">
              {resourceKind === "pod" ? "Container:" : "Service Port:"}
            </label>
            <Select onValueChange={selectPortOption} value={selectedPortOption}>
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder={`Select ${resourceKind === "pod" ? "Container" : "Service Port"}`} />
              </SelectTrigger>
              <SelectContent>
                {portOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
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
          <span className="block text-xs">Use <strong>Random</strong> to pick an unused port, or set the local port to <strong>0</strong> to let Kubernetes assign one automatically.</span>
          {activeForwards.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">Active ({activeForwards.length})</span>
                <Link className="text-blue-600 dark:text-blue-500 hover:underline" to={`/${config}/list?cluster=${cluster}&resourcekind=portforwards`}>
                  View all
                </Link>
              </div>
              {activeForwards.map(({ id, localPort, containerPort, containerName }) => (
                <div key={id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-foreground">localhost:{localPort}</span>
                    <MoveRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">{containerName ? `${containerName}:${containerPort}` : containerPort}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 font-normal text-destructive hover:text-destructive [&_svg]:size-3"
                    disabled={!!stoppingId}
                    onClick={() => dispatch(stopPortForwarding({ id, queryParams }))}
                  >
                    {stoppingId === id
                      ? <Loader className='w-3 h-3 text-gray-200 animate-spin dark:text-gray-600 fill-red-600' />
                      : <UnplugIcon />}
                    Stop
                  </Button>
                </div>
              ))}
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
