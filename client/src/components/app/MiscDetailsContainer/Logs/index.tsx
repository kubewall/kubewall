import './index.css';

import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { Button } from "@/components/ui/button";
import { CotainerSelector } from "./ContainerSelector";
import { DebouncedInput } from "@/components/app/Common/DeboucedInput";
import { DownloadIcon } from '@radix-ui/react-icons';
import { RootState } from "@/redux/store";
import { SocketLogs } from "./SocketLogs";
import { setIsFollowingLogs } from "@/data/Workloads/Pods/PodLogsSlice";
import { useState } from "react";

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
}

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [podLogSearch, setPodLogSearch] = useState('');
  const dispatch = useAppDispatch();
  const {
    podDetails
  } = useAppSelector((state: RootState) => state.podDetails);
  const {
    logs,
    selectedContainer,
    isFollowingLogs
  } = useAppSelector((state: RootState) => state.podLogs);

  const downloadLogs = () => {
    const a = document.createElement('a');
    let logString = '';
    logs.forEach((log) => {
      if (log.containerChange) {
        logString += `-------------------${log.containerName || 'All Containers'}-------------------\n`;
      } else {
        logString += `[${log.containerName}]: ${log.log}\n`;
      }
    });
    a.href = `data:text/plain,${logString}`;
    a.download = `${podDetails.metadata.name}-logs.txt`;
    document.body.appendChild(a);
    a.click();
  };

  return (
    <div className="logs flex-col md:flex border rounded-lg">
      <div className="flex items-start justify-between py-4 flex-row items-center h-10 border-b bg-muted/50">
        <div className="mx-2 basis-9/12">
          <DebouncedInput
            placeholder="Search... (/)"
            value={podLogSearch}
            onChange={(value) => setPodLogSearch(String(value))}
            className="h-8 font-medium text-xs shadow-none"
            debounce={0}
          />
        </div>
        <div className="ml-auto flex w-full space-x-2 sm:justify-end">

          <CotainerSelector podDetailsSpec={podDetails.spec} selectedContainer={selectedContainer} />
          <div className="flex justify-end pr-3">
            <Button
              variant="outline"
              role="combobox"
              aria-label="Containers"
              className="flex-1 text-xs shadow-none h-8 mr-1"
              onClick={() => dispatch(setIsFollowingLogs(!isFollowingLogs))}
            >
              {isFollowingLogs ? 'Stop Following' : 'Follow Log'}
            </Button>
            <Button
              variant="outline"
              role="combobox"
              aria-label="Containers"
              className="flex-1 text-xs shadow-none h-8"
              onClick={downloadLogs}
            >
              <DownloadIcon className="h-3.5 w-3.5 cursor-pointer" />
            </Button>
          </div>
        </div>
      </div>
      <SocketLogs
        containerName={selectedContainer}
        namespace={namespace}
        pod={name}
        podLogSearch={podLogSearch}
        isFollowingLogs={isFollowingLogs}
        configName={configName}
        clusterName={clusterName}
        podDetailsSpec={podDetails.spec}
      />
    </div>
  );
};

export {
  PodLogs
};