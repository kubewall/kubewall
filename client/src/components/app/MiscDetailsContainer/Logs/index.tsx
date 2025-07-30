import './index.css';

import { DownloadIcon, ClockIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useRef, useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { CotainerSelector } from "./ContainerSelector";
import { DebouncedInput } from "@/components/app/Common/DeboucedInput";
import { PodSocketResponse } from '@/types';
import { RootState } from "@/redux/store";
import { SearchAddon } from '@xterm/addon-search';
import { SocketLogs } from "./SocketLogs";
import { useAppSelector } from "@/redux/hooks";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
}

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [podLogFilter, setPodLogFilter] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('realtime');
  const podLogFilterRef = useRef(podLogFilter);
  const {
    podDetails
  } = useAppSelector((state: RootState) => state.podDetails);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [logs, setLogs] = useState<PodSocketResponse[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<PodSocketResponse[]>([]);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  
  // Performance optimization: limit logs to prevent memory issues
  const MAX_LOGS = 10000; // Keep only last 10k logs
  const updateQueue = useRef<PodSocketResponse[]>([]);
  const updateTimeout = useRef<NodeJS.Timeout | null>(null);

  const downloadLogs = () => {
    const a = document.createElement('a');
    let logString = '';
    filteredLogs.forEach((log) => {
      if (log.containerChange) {
        logString += `-------------------${log.containerName || 'All Containers'}-------------------\n`;
      } else {
        // eslint-disable-next-line no-control-regex
        logString += `${log.containerName ? `${log.containerName}:` : ''} ${log.log.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')}\n`;
      }
    });
    a.href = `data:text/plain,${logString}`;
    a.download = `${podDetails.metadata.name}-filtered-logs.txt`;
    document.body.appendChild(a);
    a.click();
  };

  // Throttled log update function
  const updateLogs = useCallback((currentLog: PodSocketResponse) => {
    updateQueue.current.push(currentLog);
    
    // Clear existing timeout
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }
    
    // Set new timeout to batch process logs
    updateTimeout.current = setTimeout(() => {
      const newLogs = [...updateQueue.current];
      updateQueue.current = [];
      
      setLogs((prevLogs) => {
        const updatedLogs = [...prevLogs, ...newLogs];
        // Keep only the last MAX_LOGS entries to prevent memory issues
        if (updatedLogs.length > MAX_LOGS) {
          return updatedLogs.slice(-MAX_LOGS);
        }
        return updatedLogs;
      });
    }, 100); // Batch updates every 100ms
  }, []);

  // Helper function to safely parse timestamp
  const parseTimestamp = (timestamp: string): Date | null => {
    try {
      return new Date(timestamp);
    } catch {
      return null;
    }
  };

  // Helper function to check if log matches filter (grep-like functionality)
  const matchesFilter = (log: PodSocketResponse, filter: string): boolean => {
    if (!filter.trim()) return true;
    
    const searchText = filter.toLowerCase();
    const logText = log.log.toLowerCase();
    const containerText = log.containerName.toLowerCase();
    
    // Check if filter contains regex-like patterns
    if (searchText.includes('|') || searchText.includes('.*') || searchText.includes('^') || searchText.includes('$')) {
      try {
        // Convert simple patterns to regex
        let regexPattern = searchText
          .replace(/\.\*/g, '.*') // .* for any characters
          .replace(/\|/g, '|') // | for OR
          .replace(/\^/g, '^') // ^ for start
          .replace(/\$/g, '$'); // $ for end
        
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(logText) || regex.test(containerText);
      } catch {
        // If regex is invalid, fall back to simple search
        return logText.includes(searchText) || containerText.includes(searchText);
      }
    }
    
    // Simple case-insensitive search
    return logText.includes(searchText) || containerText.includes(searchText);
  };

  // Filter logs based on search term and timeline
  const filterLogs = useCallback(() => {
    let filtered = logs;

    // Apply timeline filter
    if (timelineFilter !== 'realtime') {
      const now = new Date();
      let cutoffTime: Date;

      // Calculate cutoff time based on timeline filter
      switch (timelineFilter) {
        case '5min':
          cutoffTime = new Date(now.getTime() - 5 * 60 * 1000);
          break;
        case '15min':
          cutoffTime = new Date(now.getTime() - 15 * 60 * 1000);
          break;
        case '1hour':
          cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6hours':
          cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24hours':
          cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffTime = now;
          break;
      }

      filtered = filtered.filter(log => {
        if (log.timestamp) {
          const logTime = parseTimestamp(log.timestamp);
          return logTime && logTime >= cutoffTime;
        }
        return true; // Keep logs without timestamps
      });
    }

    // Apply text filter with grep-like functionality
    if (podLogFilter.trim()) {
      filtered = filtered.filter(log => matchesFilter(log, podLogFilter));
    }

    setFilteredLogs(filtered);
  }, [logs, podLogFilter, timelineFilter]);

  // Update filtered logs when logs, filter, or timeline changes
  useEffect(() => {
    filterLogs();
  }, [filterLogs]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
    };
  }, []);

  return (
    <div className="logs flex-col md:flex border rounded-lg">
      <div className="flex items-start justify-between py-4 flex-row items-center h-10 border-b bg-muted/50">
        <div className="mx-2 flex basis-9/12 items-center space-x-2">
          <div className="flex-1 relative">
            <DebouncedInput
              placeholder="Filter logs (supports regex patterns like .*, |, ^, $)..."
              value={podLogFilter}
              onChange={(value) => { setPodLogFilter(String(value)), podLogFilterRef.current = String(value); }}
              className="h-8 font-medium text-xs shadow-none w-full pr-8"
              debounce={300}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-0 h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <InfoCircledIcon className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <div className="space-y-2">
                    <p className="font-medium">Log Filtering Tips:</p>
                    <ul className="text-xs space-y-1">
                      <li>• <code>error</code> - Find lines containing "error"</li>
                      <li>• <code>error|warn</code> - Find lines with "error" OR "warn"</li>
                      <li>• <code>^2024</code> - Lines starting with "2024"</li>
                      <li>• <code>.*exception.*</code> - Lines containing "exception"</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      <strong>Keyboard shortcuts:</strong><br/>
                      Ctrl/Cmd + End: Scroll to bottom
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center space-x-1">
            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={timelineFilter} onValueChange={setTimelineFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">Realtime</SelectItem>
                <SelectItem value="5min">Last 5 min</SelectItem>
                <SelectItem value="15min">Last 15 min</SelectItem>
                <SelectItem value="1hour">Last 1 hour</SelectItem>
                <SelectItem value="6hours">Last 6 hours</SelectItem>
                <SelectItem value="24hours">Last 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="ml-auto flex w-full space-x-2 sm:justify-end items-center">
          <div className="text-xs text-muted-foreground mr-2">
            {filteredLogs.length} / {logs.length} logs
          </div>
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
        filteredLogs={filteredLogs}
      />
    </div>
  );
};

export {
  PodLogs
};