import { MutableRefObject, useRef } from "react";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import { getEventStreamUrl } from "@/utils";
import { PodSocketResponse } from "@/types";
import XtermTerminal from "../Xtrem";
import { getColorForContainerName } from "@/utils/Workloads/PodUtils";
import { Terminal } from "@xterm/xterm";
import { SearchAddon } from "@xterm/addon-search";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type SocketLogsProps = {
  pod: string;
  containerName?: string;
  namespace: string;
  configName: string;
  clusterName: string;
  podDetailsSpec: any;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
  updateLogs: (log: PodSocketResponse) => void;
}

export function SocketLogs({ pod, containerName, namespace, configName, clusterName, podDetailsSpec, searchAddonRef,updateLogs }: SocketLogsProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lineCount = useRef<number>(1);
  const xterm = useRef<Terminal | null>(null);
  const navigate = useNavigate();
  
  const printLogLine = (message: PodSocketResponse) => {
    if (xterm.current) {
      const containerColor = getColorForContainerName(message.containerName, podDetailsSpec);
      // const levelColor = level === 'error' ? '\x1b[31m' : '\x1b[32m'; // Red for error, Green for other levels
      const resetCode = '\x1b[0m'; // Reset formatting
      const smallerText = '\x1b[2m'; // ANSI escape code for dim (which may simulate a smaller font)
      const resetSmallText = '\x1b[22m'; // Reset for dim text
      const lineNumberColor = '\u001b[34m';
      // Print the message with the background color
      xterm.current.writeln(`${lineNumberColor}${lineCount.current}:|${resetSmallText}${smallerText} ${message.timestamp}${resetSmallText} ${containerColor}${message.containerName}${resetCode} ${message.log}`);
      lineCount.current++;
    }
  };
  const sendMessage = (lastMessage: PodSocketResponse) => {
    if(lastMessage.log) {
      if(!containerName || lastMessage.containerName === containerName){
        printLogLine(lastMessage as PodSocketResponse);
        updateLogs(lastMessage);
      }
    }
  };

  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  useEventSource({
    url: getEventStreamUrl(`pod/${pod}/logs`, {
      namespace,
      config: configName,
      cluster: clusterName,
      ...(
        containerName ? {container: containerName} : {'all-containers': 'true'}
      )
    }),
    sendMessage,
    onConfigError: handleConfigError,
  });

  return (
    <div ref={logContainerRef} className="m-2">
      <XtermTerminal
        containerNameProp={containerName || ''}
        xterm={xterm}
        searchAddonRef={searchAddonRef}
        updateLogs={updateLogs}
      />
    </div>
  );
}