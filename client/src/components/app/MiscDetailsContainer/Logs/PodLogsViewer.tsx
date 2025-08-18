import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { toast } from 'sonner';

import {
  Download,
  Search,
  Copy,
  ChevronUp,
  ChevronDown,
  Trash2,
  Terminal,
  Clock,
  AlertCircle,
  Info,
  XCircle,
  Filter,
  Regex,
  History,
  Hash,
} from 'lucide-react';
import { usePodLogsWebSocket, LogMessage } from '@/hooks/usePodLogsWebSocket';
import { cn } from '@/lib/utils';

interface PodLogsViewerProps {
  podName: string;
  namespace: string;
  configName: string;
  clusterName: string;
  container?: string;
  allContainers?: boolean;
  className?: string;
}

interface LogEntry extends LogMessage {
  id: string;
  searchMatch?: boolean;
  isPrevious?: boolean;
  podInstance?: string;
}

const LOG_LEVEL_COLORS = {
  error: 'text-red-500',
  warn: 'text-yellow-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
  debug: 'text-gray-500',
  trace: 'text-gray-400',
} as const;

const LOG_LEVEL_ICONS = {
  error: XCircle,
  warn: AlertCircle,
  warning: AlertCircle,
  info: Info,
  debug: Terminal,
  trace: Terminal,
} as const;

const LogRetrievalControls: React.FC<{
  includePrevious: boolean;
  onIncludePreviousChange: (value: boolean) => void;
  logMode: 'all' | 'tail';
  onLogModeChange: (mode: 'all' | 'tail') => void;
  maxLines: number;
  onMaxLinesChange: (lines: number) => void;
}> = ({ 
  includePrevious, 
  onIncludePreviousChange, 
  logMode, 
  onLogModeChange, 
  maxLines, 
  onMaxLinesChange
}) => {
  
  return (
    <div className="flex items-center gap-4 p-3 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-muted-foreground" />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Label 
                  htmlFor="previous-logs" 
                  className="text-sm font-medium"
                >
                  Show Previous Logs
                </Label>
                <Switch
                  id="previous-logs"
                  checked={includePrevious}
                  onCheckedChange={onIncludePreviousChange}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle between current and previous pod logs</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Log Retrieval:</Label>
        <Select value={logMode} onValueChange={onLogModeChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Logs</SelectItem>
            <SelectItem value="tail">Recent Lines</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {logMode === 'tail' && (
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-muted-foreground" />
          <Input
            type="number"
            min={1}
            max={10000}
            value={maxLines}
            onChange={(e) => onMaxLinesChange(parseInt(e.target.value) || 100)}
            className="w-20"
            placeholder="100"
          />
          <Label className="text-sm text-muted-foreground">lines</Label>
        </div>
      )}
    </div>
  );
};

const LogLine: React.FC<{
  log: LogEntry;
  showTimestamps: boolean;
  searchTerm: string;
  onCopyLine: (log: LogEntry) => void;
}> = ({ log, showTimestamps, searchTerm, onCopyLine }) => {
  const levelColor = log.level ? LOG_LEVEL_COLORS[log.level as keyof typeof LOG_LEVEL_COLORS] : '';
  const LevelIcon = log.level ? LOG_LEVEL_ICONS[log.level as keyof typeof LOG_LEVEL_ICONS] : null;
  
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-1 text-sm font-mono hover:bg-muted/50 group border-b border-border/20',
        log.searchMatch && 'bg-yellow-50 dark:bg-yellow-900/20',
        log.isPrevious && 'bg-blue-50 dark:bg-blue-900/10 border-l-2 border-l-blue-500'
      )}
    >
      
      {/* Previous log indicator */}
      {log.isPrevious && (
        <Badge variant="outline" className="text-xs h-5 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          Previous
        </Badge>
      )}
      
      {/* Timestamp */}
      {showTimestamps && (
        <span className="text-muted-foreground text-xs w-20 flex-shrink-0 pt-0.5">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
      )}
      
      {/* Container name (if multiple containers) */}
      {log.container && (
        <Badge variant="outline" className="text-xs h-5 px-1.5">
          {log.container}
        </Badge>
      )}
      
      {/* Log level icon */}
      {LevelIcon && (
        <LevelIcon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', levelColor)} />
      )}
      
      {/* Log message */}
      <span className={cn('flex-1 break-all', levelColor)}>
        {highlightText(log.message, searchTerm)}
      </span>
      
      
      {/* Copy button */}
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
        onClick={() => onCopyLine(log)}
        title="Copy line"
      >
        <Copy className="w-3 h-3" />
      </Button>
    </div>
  );
};

export const PodLogsViewer: React.FC<PodLogsViewerProps> = ({
  podName,
  namespace,
  configName,
  clusterName,
  container,
  allContainers = false,
  className,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [logLevel] = useState<string>('all');
  const [selectedContainer, setSelectedContainer] = useState<string>('all');
  const [searchMode, setSearchMode] = useState<'simple' | 'regex' | 'grep'>('simple');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  
  // New state variables for enhanced functionality
  const [includePrevious, setIncludePrevious] = useState(false);
  const [logMode, setLogMode] = useState<'all' | 'tail'>('tail');
  const [maxLines, setMaxLines] = useState(100);
  const [hasReceivedLogs, setHasReceivedLogs] = useState(false);
  const [noPreviousLogsDetected, setNoPreviousLogsDetected] = useState(false);
  
  // Handler for includePrevious toggle that clears logs and restarts connection
  const handleIncludePreviousChange = useCallback((value: boolean) => {
    // Clear existing logs when toggling
    setLogs([]);
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setAvailableContainers([]);
    setHasReceivedLogs(false);
    setNoPreviousLogsDetected(false);
    
    // Clear any existing timeout
    if (noPreviousLogsTimeoutRef.current) {
      clearTimeout(noPreviousLogsTimeoutRef.current);
      noPreviousLogsTimeoutRef.current = null;
    }
    
    // If switching to previous logs, set a timeout to detect if no logs are received
    if (value) {
      noPreviousLogsTimeoutRef.current = setTimeout(() => {
        if (!hasReceivedLogs && includePrevious) {
          setNoPreviousLogsDetected(true);
          setIncludePrevious(false);
          toast.info('No previous logs available for this pod. Switching to current logs.');
        }
      }, 3000); // Wait 3 seconds for logs
    }
    
    // Update the state which will trigger WebSocket reconnection
    setIncludePrevious(value);
    
  }, [hasReceivedLogs, includePrevious]);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);
  const userScrolledRef = useRef(false);
  const lastScrollTop = useRef(0);
  const noPreviousLogsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      setAutoScroll(true);
      userScrolledRef.current = false;
    }
  }, []);
  

  
  // WebSocket connection
  const {
    isConnected,
    isConnecting,
    error: wsError,
  } = usePodLogsWebSocket({
    podName,
    namespace,
    configName,
    clusterName,
    container,
    allContainers,
    tailLines: logMode === 'tail' ? maxLines : undefined,
    previous: includePrevious,
    allLogs: logMode === 'all',
    enabled: !isPaused,
    onLog: useCallback((logMessage: LogMessage) => {
      const logEntry: LogEntry = {
        ...logMessage,
        id: `log-${logIdCounter.current++}`,
      };
      
      setHasReceivedLogs(true);
      
      // Clear the no previous logs timeout since we received logs
      if (noPreviousLogsTimeoutRef.current) {
        clearTimeout(noPreviousLogsTimeoutRef.current);
        noPreviousLogsTimeoutRef.current = null;
      }
      
      // Update available containers
      if (logEntry.container) {
        setAvailableContainers(prev => {
          if (!prev.includes(logEntry.container!)) {
            return [...prev, logEntry.container!].sort();
          }
          return prev;
        });
      }
      
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, logEntry];
        // Keep only last 10000 logs to prevent memory issues
        return newLogs.length > 10000 ? newLogs.slice(-10000) : newLogs;
      });
    }, []),
    onError: useCallback((error: string) => {
      // Check if this is a "no previous logs" scenario
      if (includePrevious && (error.includes('no previous') || error.includes('not found') || error.includes('no logs'))) {
        setNoPreviousLogsDetected(true);
        // Auto-switch back to current logs
        setTimeout(() => {
          setIncludePrevious(false);
          toast.info('No previous logs available for this pod. Switching to current logs.');
        }, 1000);
      } else {
        toast.error('Log Stream Error', {
          description: error,
        });
      }
    }, [includePrevious]),
  });

  // Filter logs based on level, container, and search (for grep mode)
  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    // First filter by toggle state - this is the most important filter
    if (includePrevious) {
      // When toggle is ON, show only previous logs
      filtered = filtered.filter(log => log.isPrevious === true);
    } else {
      // When toggle is OFF, show only current logs (not previous)
      filtered = filtered.filter(log => log.isPrevious !== true);
    }
    
    // Filter by log level
    if (logLevel !== 'all') {
      filtered = filtered.filter(log => log.level === logLevel);
    }
    
    // Filter by container
    if (selectedContainer !== 'all') {
      filtered = filtered.filter(log => log.container === selectedContainer);
    }
    
    // Filter by search term (only for grep mode)
    if (searchTerm && searchMode === 'grep') {
      try {
        const grepPattern = searchTerm
          .replace(/\*/g, '.*')  // * becomes .*
          .replace(/\?/g, '.')   // ? becomes .
          .replace(/\[([^\]]*)\]/g, '[$1]'); // character classes
        const searchRegex = new RegExp(grepPattern, caseSensitive ? 'g' : 'gi');
        filtered = filtered.filter(log => searchRegex.test(log.message));
      } catch (error) {
        // Invalid regex, fall back to simple search
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedTerm, caseSensitive ? 'g' : 'gi');
        filtered = filtered.filter(log => searchRegex.test(log.message));
      }
    }
    
    return filtered;
   }, [logs, logLevel, selectedContainer, searchTerm, searchMode, caseSensitive, includePrevious]);

  // Enhanced search functionality with regex and simple search support (grep filtering is handled in filteredLogs)
  const performSearch = useCallback((logs: LogEntry[], term: string) => {
    if (!term || searchMode === 'grep') {
      // For grep mode, filtering is done in filteredLogs, so just return logs as-is
      return { results: [], updatedLogs: logs.map(log => ({ ...log, searchMatch: false })) };
    }

    const results: number[] = [];
    let searchRegex: RegExp;

    try {
      switch (searchMode) {
        case 'regex':
          searchRegex = new RegExp(term, caseSensitive ? 'g' : 'gi');
          break;
        default: // simple
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escapedTerm, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      // Invalid regex, fall back to simple search
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escapedTerm, caseSensitive ? 'g' : 'gi');
    }

    const updatedLogs = logs.map((log, index) => {
      const matches = searchRegex.test(log.message);
      if (matches) {
        results.push(index);
      }
      return { ...log, searchMatch: matches };
    });

    return { results, updatedLogs };
   }, [searchMode, caseSensitive]);

  // Search functionality
  useEffect(() => {
    const { results, updatedLogs } = performSearch(filteredLogs, searchTerm);
    
    setLogs(prevLogs => {
       // Update search matches for all logs
       return prevLogs.map(log => {
         const matchingLog = updatedLogs.find(ul => ul.id === log.id);
         return matchingLog ? { ...log, searchMatch: matchingLog.searchMatch } : { ...log, searchMatch: false };
       });
     });
     
     setSearchResults(results);
      setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    }, [searchTerm, filteredLogs, performSearch]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !userScrolledRef.current && filteredLogs.length > 0 && scrollAreaRef.current) {
      scrollToBottom();
    }
  }, [filteredLogs, autoScroll, scrollToBottom]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (noPreviousLogsTimeoutRef.current) {
        clearTimeout(noPreviousLogsTimeoutRef.current);
      }
    };
  }, []);

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
    const isScrollingUp = scrollTop < lastScrollTop.current;
    
    if (isScrollingUp && scrollTop > 0) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    } else if (isAtBottom && userScrolledRef.current) {
      userScrolledRef.current = false;
      setAutoScroll(true);
    }
    
    lastScrollTop.current = scrollTop;
  }, []);

  // Copy log line
  const handleCopyLine = useCallback((log: LogEntry) => {
    const text = showTimestamps 
      ? `${log.timestamp} ${log.container ? `[${log.container}] ` : ''}${log.message}`
      : `${log.container ? `[${log.container}] ` : ''}${log.message}`;
    
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  }, [showTimestamps]);

  // Download logs
  const handleDownloadLogs = useCallback(() => {
    const content = filteredLogs.map(log => {
      const timestamp = showTimestamps ? `${log.timestamp} ` : '';
      const containerName = log.container ? `[${log.container}] ` : '';
      return `${timestamp}${containerName}${log.message}`;
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podName}-${container || 'all'}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Logs downloaded successfully');
  }, [filteredLogs, showTimestamps, podName, container]);

  // Clear logs
  const handleClearLogs = useCallback(() => {
    setLogs([]);
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    toast.success('Logs cleared');
  }, []);

  // Navigate search results
  const navigateSearch = useCallback((direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    } else {
      newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    }
    
    setCurrentSearchIndex(newIndex);
    // Scroll to the search result (approximate)
    if (scrollAreaRef.current) {
      const lineHeight = 24;
      scrollAreaRef.current.scrollTop = searchResults[newIndex] * lineHeight;
    }
  }, [searchResults, currentSearchIndex]);



  const connectionStatus = isConnecting ? 'connecting' : isConnected ? 'connected' : 'disconnected';
  const statusColor = {
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
    disconnected: 'text-red-500',
  }[connectionStatus];

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Pod Logs
            <Badge variant="outline" className={statusColor}>
              {connectionStatus}
            </Badge>
          </CardTitle>
          

        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* Container Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <Select value={selectedContainer} onValueChange={setSelectedContainer}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="All containers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All containers</SelectItem>
                {availableContainers.map((container) => (
                  <SelectItem key={container} value={container}>
                    {container}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Search */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 h-8"
            />
            
            {/* Search Mode Selector */}
            <Select value={searchMode} onValueChange={(value: 'simple' | 'regex' | 'grep') => setSearchMode(value)}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="regex">
                  <div className="flex items-center">
                    <Regex className="h-4 w-4 mr-2" />
                    Regex
                  </div>
                </SelectItem>
                <SelectItem value="grep">Grep</SelectItem>
              </SelectContent>
            </Select>

            {/* Case Sensitive Toggle */}
            <Button
              variant={caseSensitive ? "default" : "outline"}
              size="sm"
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Case sensitive search"
              className="h-8 px-2"
            >
              Aa
            </Button>

            {searchResults.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateSearch('prev')}
                  className="h-6 w-6 p-0"
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateSearch('next')}
                  className="h-6 w-6 p-0"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Toggles */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <Label htmlFor="timestamps" className="text-xs">Timestamps</Label>
            <Switch
              id="timestamps"
              checked={showTimestamps}
              onCheckedChange={setShowTimestamps}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="autoscroll" className="text-xs">Auto-scroll</Label>
            <Switch
              id="autoscroll"
              checked={autoScroll}
              onCheckedChange={(checked) => {
                setAutoScroll(checked);
                if (checked) {
                  scrollToBottom();
                }
              }}
            />
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToBottom}
            className="h-8 px-2"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadLogs}
            className="h-8 px-2"
            disabled={filteredLogs.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearLogs}
            className="h-8 px-2"
            disabled={filteredLogs.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {searchResults.length > 0 && `${searchResults.length} matches`}
          </span>
          
          {wsError && (
            <span className="text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {wsError}
            </span>
          )}
        </div>
      </CardHeader>
      
      {/* Log Retrieval Controls */}
      <LogRetrievalControls
          includePrevious={includePrevious}
          onIncludePreviousChange={handleIncludePreviousChange}
          logMode={logMode}
          onLogModeChange={setLogMode}
          maxLines={maxLines}
          onMaxLinesChange={setMaxLines}
        />
      
      <CardContent className="flex-1 p-0 min-h-0">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {includePrevious ? (
                <>
                  <p>Loading previous logs...</p>
                  <p className="text-xs mt-1">
                    {noPreviousLogsDetected 
                      ? 'No previous logs found. Switching to current logs...' 
                      : 'Searching for logs from previous pod instances...'}
                  </p>
                </>
              ) : (
                <>
                  <p>No logs available</p>
                  <p className="text-xs mt-1">
                    {isPaused ? 'Streaming is paused' : 'Waiting for logs...'}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div 
            ref={scrollAreaRef}
            className="h-full overflow-auto scrollbar-active max-h-[calc(100vh-20rem)]"
            onScroll={handleScroll}
          >
            <div className="space-y-0">
              {filteredLogs.map((log) => (
                <LogLine
                  key={log.id}
                  log={log}
                  showTimestamps={showTimestamps}
                  searchTerm={searchTerm}
                  onCopyLine={handleCopyLine}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};