import './index.css';

import { ChevronDownIcon, ChevronUpIcon, DownloadIcon } from '@radix-ui/react-icons';
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CotainerSelector } from "./ContainerSelector";
import { DebouncedInput } from "@/components/app/Common/DeboucedInput";
import { PodSocketResponse } from '@/types';
import { RootState } from "@/redux/store";
import { SearchAddon } from '@xterm/addon-search';
import { SocketLogs } from "./SocketLogs";
import { useAppSelector } from "@/redux/hooks";

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
}


const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [podLogSearch, setPodLogSearch] = useState('');
  const podLogSearchRef = useRef(podLogSearch);
  const {
    podDetails
  } = useAppSelector((state: RootState) => state.podDetails);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [logs, setLogs] = useState<PodSocketResponse[]>([]);
  const nextSearchBtnRef = useRef<HTMLButtonElement>(null);
  const previousSearchBtnRef = useRef<HTMLButtonElement>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);


  const downloadLogs = () => {
    const a = document.createElement('a');
    let logString = '';
    logs.forEach((log) => {
      if (log.containerChange) {
        logString += `-------------------${log.containerName || 'All Containers'}-------------------\n`;
      } else {
        // eslint-disable-next-line no-control-regex
        logString += `${log.containerName ? `${log.containerName}:` : ''} ${log.log.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')}\n`;
      }
    });
    a.href = `data:text/plain,${logString}`;
    a.download = `${podDetails.metadata.name}-logs.txt`;
    document.body.appendChild(a);
    a.click();
  };

  const updateLogs = (currentLog: PodSocketResponse) => {
    setLogs((prevLogs) => [...prevLogs, currentLog]);
  };
  return (
    <div className="logs flex-col md:flex border rounded-lg">
      <div className="flex items-start justify-between py-4 flex-row items-center h-10 border-b bg-muted/50">
        <div className="mx-2 flex basis-9/12">
          <DebouncedInput
            placeholder="Search... (/)"
            value={podLogSearch}
            onChange={(value) => { setPodLogSearch(String(value)), podLogSearchRef.current = String(value); }}
            className="h-8 font-medium text-xs shadow-none"
            debounce={0}
          />
          <Button
            ref={nextSearchBtnRef}
            variant="outline"
            className="flex-1 text-xs shadow-none h-8 px-2 py-2 mx-1"
            onClick={() =>
              searchAddonRef.current?.findNext(podLogSearch)}>
            <ChevronDownIcon className="h-3.5 w-3.5 cursor-pointer" />
          </Button>
          <Button
            ref={previousSearchBtnRef}
            variant="outline"
            className="flex-1 text-xs shadow-none h-8 px-2 py-2"
            onClick={() => searchAddonRef.current?.findPrevious(podLogSearch)}>
            <ChevronUpIcon className="h-3.5 w-3.5 cursor-pointer" />
          </Button>
        </div>
        <div className="ml-auto flex w-full space-x-2 sm:justify-end">

          <CotainerSelector podDetailsSpec={podDetails.spec} selectedContainer={selectedContainer} setSelectedContainer={setSelectedContainer} />
          <div className="flex justify-end pr-3">
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
        configName={configName}
        clusterName={clusterName}
        podDetailsSpec={podDetails.spec}
        updateLogs={updateLogs}
        searchAddonRef={searchAddonRef}
      />
    </div>
  );
};

export {
  PodLogs
};