import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useRef, useState } from "react";

import Highlighter from "react-highlight-words";
import { PodDetailsSpec } from "@/types";
import { RootState } from "@/redux/store";
import { addLog } from "@/data/Workloads/Pods/PodLogsSlice";
import { getColorForContainerName } from "@/utils";
import useWebSocket from 'react-use-websocket';

type SocketLogsProps = {
  pod: string;
  namespace: string;
  containerName: string;
  podLogSearch: string;
  isFollowingLogs: boolean;
  configName: string;
  clusterName: string;
  podDetailsSpec: PodDetailsSpec
}

export function SocketLogs({ pod, containerName, namespace, podLogSearch, isFollowingLogs, configName, clusterName, podDetailsSpec }: SocketLogsProps) {
  const dispatch = useAppDispatch();
  const { logs } = useAppSelector((state: RootState) => state.podLogs);
  const porotocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
  const port = process.env.NODE_ENV === 'production' ?  window.location.port : '7080';
  const [socketUrl, setSocketUrl] = useState(`${porotocol}//${window.location.hostname}:${port}/api/v1/pods/${pod}/logsWS?namespace=${namespace}&all-containers=true&config=${configName}&cluster=${clusterName}`);
  const { lastMessage } = useWebSocket(socketUrl);
  const [localContainerName, setLocalContainerName] = useState(containerName);
  const logContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lastMessage !== null) {
      dispatch(addLog(JSON.parse(lastMessage.data)));
    }
  }, [lastMessage, dispatch]);

  useEffect(() => {
    if (isFollowingLogs) {
      if (!logContainerRef.current) return;
      // Scroll to the bottom of the log container when isFollowingLogs changes
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [isFollowingLogs, logs]);

  useEffect(() => {
    let containerQuery = '&all-containers=true';
    if (containerName) {
      containerQuery = `&container=${containerName}`;
    }
    setSocketUrl(`${porotocol}//${window.location.hostname}:${port}/api/v1/pods/${pod}/logsWS?namespace=${namespace}${containerQuery}&config=${configName}&cluster=${clusterName}`);
    if (logs.length > 0 && localContainerName !== containerName) {
      dispatch(addLog([{ containerName: containerName, log: '', containerChange: true }]));
      setLocalContainerName(containerName);
    }
  }, [pod, containerName, namespace, dispatch]);


  return (
    <div ref={logContainerRef} className="m-2 overflow-auto">
      {
        logs.length == 0 &&
        <div className="empty-table flex items-center justify-center text-sm">
          No Logs.
        </div>
      }
      {
        logs.map((message, index) => {
          return (
            <div className='' key={message.log + index}>
              {
                message.containerChange ? (
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-dashed border-t border-gray-400"></div>
                    <span className="flex-shrink mx-4 text-xs font-medium text-muted-foreground">{message.containerName || 'All Containers'}</span>
                    <div className="flex-grow border-dashed border-t border-gray-400"></div>
                  </div>
                ) : (
                  <>
                    <span className='text-xs font-medium text-muted-foreground'>
                      <Highlighter
                        highlightClassName="bg-amber-200"
                        searchWords={[podLogSearch]}
                        autoEscape={true}
                        textToHighlight={`${message.timestamp} `}
                      />
                    </span>
                    <span className='text-xs font-medium text-muted-foreground'>
                      <Highlighter
                        highlightClassName="bg-amber-200"
                        searchWords={[podLogSearch]}
                        autoEscape={true}
                        textToHighlight={`[${message.containerName}]:`}
                        className={getColorForContainerName(message.containerName, podDetailsSpec)}
                      />
                    </span>
                    <span className="text-sm font-normal break-all">
                      <Highlighter
                        highlightClassName="bg-amber-200"
                        searchWords={[podLogSearch]}
                        autoEscape={true}
                        textToHighlight={message.log}
                      />
                    </span>
                  </>
                )
              }
            </div>
          );
        })
      }
    </div>
  );
}