import { MutableRefObject, useRef } from "react";
import { PodDetailsSpec, PodSocketResponse } from "@/types";
import { getColorForContainerName, getEventStreamUrl } from "@/utils";

import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import XtermTerminal from "../Xtrem";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";

type SocketLogsProps = {
  pod: string;
  namespace: string;
  containerName: string;
  configName: string;
  clusterName: string;
  podDetailsSpec: PodDetailsSpec;
  updateLogs: (currentLog: PodSocketResponse) => void;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
}

export function SocketLogs({ pod, containerName, namespace, configName, clusterName, podDetailsSpec, searchAddonRef,updateLogs }: SocketLogsProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lineCount = useRef<number>(1);
  const xterm = useRef<Terminal | null>(null);
  
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
  });

  return (
    <div ref={logContainerRef} className="m-2">
      <XtermTerminal
        containerNameProp={containerName}
        xterm={xterm}
        searchAddonRef={searchAddonRef}
        updateLogs={updateLogs}
      />
    </div>
  );
}