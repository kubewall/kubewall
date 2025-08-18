import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { SearchAddon } from '@xterm/addon-search';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { PodSocketResponse } from '@/types';
import { getColorForContainerName } from '@/utils/Workloads/PodUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  MagnifyingGlassIcon as SearchIcon, 
  DownloadIcon, 
  PlayIcon, 
  PauseIcon, 
  RotateCounterClockwiseIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@radix-ui/react-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdvancedLogViewerProps {
  logs: PodSocketResponse[];
  podDetailsSpec: any;
  onClear?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isPaused?: boolean;
  showTimestamps?: boolean;
  autoScroll?: boolean;
}

export const AdvancedLogViewer: React.FC<AdvancedLogViewerProps> = ({
  logs,
  podDetailsSpec,
  onClear,
  onPause,
  onResume,
  isPaused = false,
  showTimestamps = true,
  autoScroll = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const searchAddon = useRef<SearchAddon | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ index: number; line: number }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [logStats, setLogStats] = useState({
    total: 0,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0
  });

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    terminal.current = new Terminal({
      fontSize: 12,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      rows: 30,
      cols: 120,
    });

    // Add addons
    searchAddon.current = new SearchAddon();
    fitAddon.current = new FitAddon();
    
    terminal.current.loadAddon(searchAddon.current);
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(new WebLinksAddon());

    // Open terminal
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, []);

  // Calculate log statistics
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

  // Get log level
  const getLogLevel = (logLine: string): string => {
    const lowerLog = logLine.toLowerCase();
    if (lowerLog.includes('error') || lowerLog.includes('fatal') || lowerLog.includes('panic')) return 'error';
    if (lowerLog.includes('warn')) return 'warn';
    if (lowerLog.includes('debug')) return 'debug';
    if (lowerLog.includes('info')) return 'info';
    return 'info';
  };

  // Update log statistics when logs change
  useEffect(() => {
    setLogStats(calculateLogStats(logs));
  }, [logs, calculateLogStats]);

  // Render logs to terminal
  const renderLogs = useCallback(() => {
    if (!terminal.current) return;

    terminal.current.clear();
    let lineNumber = 1;

    logs.forEach((log) => {
      if (log.log) {
        const containerColor = getColorForContainerName(log.containerName, podDetailsSpec);
        const resetCode = '\x1b[0m';
        const lineNumberColor = '\u001b[34m';
        
        let logLine = `${lineNumberColor}${lineNumber.toString().padStart(4, '0')}:${resetCode} `;
        
        if (showTimestamps && log.timestamp) {
          logLine += `\x1b[2m${log.timestamp}\x1b[22m `;
        }
        
        logLine += `${containerColor}${log.containerName}${resetCode} ${log.log}`;
        
        terminal.current!.writeln(logLine);
        lineNumber++;
      }
    });

    // Auto-scroll to bottom if enabled
    if (autoScroll) {
      terminal.current.scrollToBottom();
    }
  }, [logs, podDetailsSpec, showTimestamps, autoScroll]);

  // Render logs when they change
  useEffect(() => {
    renderLogs();
  }, [renderLogs]);

  // Search functionality
  const performSearch = useCallback(() => {
    if (!searchAddon.current || !searchTerm.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    // Find all matches
    const results: { index: number; line: number }[] = [];
    let matchIndex = 0;
    
    logs.forEach((log, logIndex) => {
      if (log.log && log.log.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push({ index: logIndex, line: matchIndex + 1 });
        matchIndex++;
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);

    // Highlight first match
    if (results.length > 0) {
      searchAddon.current.findNext(searchTerm);
    }
  }, [searchTerm, logs]);

  // Search when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [performSearch]);

  // Navigate search results
  const navigateSearch = useCallback((direction: 'next' | 'prev') => {
    if (!searchAddon.current || searchResults.length === 0) return;

    if (direction === 'next') {
      setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
      searchAddon.current.findNext(searchTerm);
    } else {
      setCurrentSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      searchAddon.current.findPrevious(searchTerm);
    }
  }, [searchAddon, searchResults, searchTerm]);

  // Download logs
  const downloadLogs = useCallback((format: 'txt' | 'json' | 'csv' = 'txt') => {
    const a = document.createElement('a');
    let content = '';
    const filename = `pod-logs.${format}`;
    
    if (format === 'json') {
      content = JSON.stringify(logs, null, 2);
    } else if (format === 'csv') {
      content = 'Line,Timestamp,Container,Level,Message\n';
      logs.forEach((log, index) => {
        if (log.log) {
          const level = getLogLevel(log.log);
          const cleanLog = log.log.replace(/"/g, '""');
          content += `${index + 1},"${log.timestamp || ''}","${log.containerName || ''}","${level}","${cleanLog}"\n`;
        }
      });
    } else {
      logs.forEach((log, index) => {
        if (log.log) {
          content += `${(index + 1).toString().padStart(4, '0')}: ${log.containerName}: ${log.log}\n`;
        }
      });
    }
    
    a.href = `data:text/${format === 'json' ? 'json' : 'plain'};charset=utf-8,${encodeURIComponent(content)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="flex items-center space-x-1">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-48 text-sm"
            />
            {searchResults.length > 0 && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateSearch('prev')}
                  className="h-6 w-6 p-0"
                >
                  <ChevronUpIcon className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentSearchIndex + 1}/{searchResults.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateSearch('next')}
                  className="h-6 w-6 p-0"
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Log Statistics */}
          <div className="flex items-center space-x-1 ml-4">
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
        </div>

        <div className="flex items-center space-x-2">
          {/* Control buttons */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isPaused ? onResume : onPause}
                  className="h-8 w-8 p-0"
                >
                  {isPaused ? <PlayIcon className="h-3 w-3" /> : <PauseIcon className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isPaused ? 'Resume logs' : 'Pause logs'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClear}
                  className="h-8 w-8 p-0"
                >
                  <RotateCounterClockwiseIcon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Clear logs
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadLogs('txt')}
                  className="h-8 w-8 p-0"
                >
                  <DownloadIcon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Download logs
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Terminal */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-2"
        style={{ height: 'calc(100vh - 200px)' }}
      />
    </div>
  );
}; 