import './index.css';

import { DownloadIcon, ClockIcon, InfoCircledIcon, PlayIcon, PauseIcon, RotateCounterClockwiseIcon } from '@radix-ui/react-icons';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
}

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [podLogFilter, setPodLogFilter] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('realtime');
  const [isLive, setIsLive] = useState(true);
  const [logLevel, setLogLevel] = useState<string>('all');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logBufferSize, setLogBufferSize] = useState(10000);
  const [isPaused, setIsPaused] = useState(false);
  
  const podLogFilterRef = useRef(podLogFilter);
  const {
    podDetails
  } = useAppSelector((state: RootState) => state.podDetails);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [logs, setLogs] = useState<PodSocketResponse[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<PodSocketResponse[]>([]);
  const [logStats, setLogStats] = useState({
    total: 0,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0
  });
  const searchAddonRef = useRef<SearchAddon | null>(null);
  
  // Performance optimization: limit logs to prevent memory issues
  const MAX_LOGS = logBufferSize;
  const updateQueue = useRef<PodSocketResponse[]>([]);
  const updateTimeout = useRef<NodeJS.Timeout | null>(null);

  // Enhanced download logs with multiple formats
  const downloadLogs = (format: 'txt' | 'json' | 'csv' = 'txt') => {
    const a = document.createElement('a');
    let content = '';
    let filename = `${podDetails.metadata.name}-logs.${format}`;
    
    if (format === 'json') {
      content = JSON.stringify(filteredLogs, null, 2);
    } else if (format === 'csv') {
      content = 'Timestamp,Container,Level,Message\n';
      filteredLogs.forEach((log) => {
        if (log.log) {
          const level = getLogLevel(log.log);
          const cleanLog = log.log.replace(/"/g, '""'); // Escape quotes for CSV
          content += `"${log.timestamp || ''}","${log.containerName || ''}","${level}","${cleanLog}"\n`;
        }
      });
    } else {
      // TXT format
      filteredLogs.forEach((log) => {
        if (log.containerChange) {
          content += `-------------------${log.containerName || 'All Containers'}-------------------\n`;
        } else {
          // eslint-disable-next-line no-control-regex
          content += `${log.containerName ? `${log.containerName}:` : ''} ${log.log.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')}\n`;
        }
      });
    }
    
    a.href = `data:text/${format === 'json' ? 'json' : 'plain'};charset=utf-8,${encodeURIComponent(content)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Enhanced log level detection
  const getLogLevel = (logLine: string): string => {
    const lowerLog = logLine.toLowerCase();
    if (lowerLog.includes('error') || lowerLog.includes('fatal') || lowerLog.includes('panic')) return 'error';
    if (lowerLog.includes('warn')) return 'warn';
    if (lowerLog.includes('debug')) return 'debug';
    if (lowerLog.includes('info')) return 'info';
    return 'info';
  };

  // Enhanced log statistics calculation
  const calculateLogStats = useCallback((logArray: PodSocketResponse[]) => {
    const stats = { total: 0, error: 0, warn: 0, info: 0, debug: 0 };
    
    logArray.forEach(log => {
      if (log.log) {
        stats.total++;
        const level = getLogLevel(log.log);
        stats[level as keyof typeof stats]++;
      }
    });
    
    return stats;
  }, []);

  // Enhanced throttled log update function with pause support
  const updateLogs = useCallback((currentLog: PodSocketResponse) => {
    if (isPaused) return;
    
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
    }, isLive ? 50 : 200); // Faster updates when live
  }, [isPaused, isLive, MAX_LOGS]);

  // Helper function to safely parse timestamp
  const parseTimestamp = (timestamp: string): Date | null => {
    try {
      return new Date(timestamp);
    } catch {
      return null;
    }
  };

  // Enhanced filter with log level support
  const matchesFilter = (log: PodSocketResponse, filter: string): boolean => {
    if (!filter.trim()) return true;
    
    const searchText = filter.toLowerCase();
    const logText = log.log.toLowerCase();
    const containerText = log.containerName.toLowerCase();
    const logLevelText = getLogLevel(log.log);
    
    // Check log level filter
    if (logLevel !== 'all' && logLevelText !== logLevel) {
      return false;
    }
    
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

  // Enhanced filter logs with log level and timeline support
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
    
    // Update log statistics
    setLogStats(calculateLogStats(filtered));
  }, [logs, podLogFilter, timelineFilter, logLevel, calculateLogStats]);

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

  // Clear logs function
  const clearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
    setLogStats({ total: 0, error: 0, warn: 0, info: 0, debug: 0 });
  };

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
                      Ctrl/Cmd + End: Scroll to bottom<br/>
                      Ctrl/Cmd + F: Search in terminal
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Log Level Filter */}
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
          
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
          {/* Log Statistics */}
          <div className="flex items-center space-x-1 mr-2">
            <Badge variant="outline" className="text-xs">
              {logStats.total}
            </Badge>
            {logStats.error > 0 && (
              <Badge variant="destructive" className="text-xs">
                {logStats.error}
              </Badge>
            )}
            {logStats.warn > 0 && (
              <Badge variant="secondary" className="text-xs">
                {logStats.warn}
              </Badge>
            )}
          </div>
          
          {/* Live Mode Toggle */}
          <div className="flex items-center space-x-2 mr-2">
            <Switch
              id="live-mode"
              checked={isLive}
              onCheckedChange={setIsLive}
            />
            <Label htmlFor="live-mode" className="text-xs">Live</Label>
          </div>
          
          {/* Pause/Resume Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 w-8 p-0"
          >
            {isPaused ? <PlayIcon className="h-3 w-3" /> : <PauseIcon className="h-3 w-3" />}
          </Button>
          
          {/* Clear Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
            className="h-8 w-8 p-0"
          >
            <RotateCounterClockwiseIcon className="h-3 w-3" />
          </Button>
          
          <CotainerSelector podDetailsSpec={podDetails.spec} selectedContainer={selectedContainer} setSelectedContainer={setSelectedContainer} />
          
          {/* Enhanced Download Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 w-8 p-0">
                <DownloadIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadLogs('txt')}>
                Download as TXT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadLogs('json')}>
                Download as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadLogs('csv')}>
                Download as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Log Buffer Size Control */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center space-x-2">
          <Label htmlFor="buffer-size" className="text-xs">Buffer Size:</Label>
          <Select value={logBufferSize.toString()} onValueChange={(value) => setLogBufferSize(parseInt(value))}>
            <SelectTrigger className="h-6 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1000">1K</SelectItem>
              <SelectItem value="5000">5K</SelectItem>
              <SelectItem value="10000">10K</SelectItem>
              <SelectItem value="25000">25K</SelectItem>
              <SelectItem value="50000">50K</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-timestamps"
              checked={showTimestamps}
              onCheckedChange={setShowTimestamps}
            />
            <Label htmlFor="show-timestamps">Timestamps</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
            />
            <Label htmlFor="auto-scroll">Auto-scroll</Label>
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
        showTimestamps={showTimestamps}
        autoScroll={autoScroll}
      />
    </div>
  );
};

export {
  PodLogs
};