import { MutableRefObject, useRef, useEffect, useCallback } from "react";
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
  filteredLogs: PodSocketResponse[];
  showTimestamps?: boolean;
  autoScroll?: boolean;
}

export function SocketLogs({ pod, containerName, namespace, configName, clusterName, podDetailsSpec, searchAddonRef, updateLogs, filteredLogs, showTimestamps = true, autoScroll = true }: SocketLogsProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lineCount = useRef<number>(1);
  const xterm = useRef<Terminal | null>(null);
  const navigate = useNavigate();
  const isUserScrolledUp = useRef<boolean>(false);
  const previousLogsLength = useRef<number>(0);
  const renderTimeout = useRef<NodeJS.Timeout | null>(null);
  const isRendering = useRef<boolean>(false);
  const lastScrollCheck = useRef<number>(0);
  const lastRenderedLength = useRef<number>(0);
  const scrollPosition = useRef<{ scrollTop: number; scrollHeight: number }>({ scrollTop: 0, scrollHeight: 0 });
  
  const printLogLine = useCallback((message: PodSocketResponse) => {
    if (xterm.current) {
      try {
        const containerColor = getColorForContainerName(message.containerName, podDetailsSpec);
        const resetCode = '\x1b[0m'; // Reset formatting
        const smallerText = '\x1b[2m'; // ANSI escape code for dim (which may simulate a smaller font)
        const resetSmallText = '\x1b[22m'; // Reset for dim text
        const lineNumberColor = '\u001b[34m';
        
        // Build the log line based on settings
        let logLine = `${lineNumberColor}${lineCount.current}:|${resetCode}`;
        
        if (showTimestamps && message.timestamp) {
          logLine += `${resetSmallText}${smallerText} ${message.timestamp}${resetSmallText} `;
        }
        
        logLine += `${containerColor}${message.containerName}${resetCode} ${message.log}`;
        
        // Print the message
        xterm.current.writeln(logLine);
        lineCount.current++;
      } catch (error) {
        console.warn('Error printing log line:', error);
      }
    }
  }, [podDetailsSpec, showTimestamps]);

  const sendMessage = useCallback((message: any) => {
    // Handle batch messages from enhanced backend
    if (message.type === 'batch' && Array.isArray(message.logs)) {
      message.logs.forEach((log: PodSocketResponse) => {
        if (log.log && (!containerName || log.containerName === containerName)) {
          updateLogs(log);
        }
      });
    } else if (message.type === 'connection') {
      // Handle connection message
      console.log('Connected to pod logs stream:', message.message);
    } else if (message.log) {
      // Handle single log message (backward compatibility)
      if (!containerName || message.containerName === containerName) {
        updateLogs(message);
      }
    }
  }, [containerName, updateLogs]);

  // Save current scroll position
  const saveScrollPosition = useCallback(() => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      scrollPosition.current = {
        scrollTop: xtermContainer.scrollTop,
        scrollHeight: xtermContainer.scrollHeight
      };
    }
  }, []);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer && scrollPosition.current.scrollHeight > 0) {
      // Calculate the relative position
      const relativePosition = scrollPosition.current.scrollTop / scrollPosition.current.scrollHeight;
      const newScrollTop = relativePosition * xtermContainer.scrollHeight;
      xtermContainer.scrollTop = newScrollTop;
    }
  }, []);

  // Check if user is scrolled to bottom with debouncing
  const checkScrollPosition = useCallback(() => {
    const now = Date.now();
    // Debounce scroll checks to avoid excessive calls
    if (now - lastScrollCheck.current < 50) return;
    lastScrollCheck.current = now;
    
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      const { scrollTop, scrollHeight, clientHeight } = xtermContainer;
      // Consider "at bottom" if within 10 pixels of the bottom
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      isUserScrolledUp.current = !atBottom;
      
      // Save scroll position for restoration
      if (!atBottom) {
        saveScrollPosition();
      }
    }
  }, [saveScrollPosition]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      xtermContainer.scrollTop = xtermContainer.scrollHeight;
      isUserScrolledUp.current = false;
    }
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ctrl+End or Cmd+End to scroll to bottom
    if ((event.ctrlKey || event.metaKey) && event.key === 'End') {
      event.preventDefault();
      scrollToBottom();
    }
  }, [scrollToBottom]);

  // Append new logs without clearing the terminal
  const appendNewLogs = useCallback((newLogs: PodSocketResponse[]) => {
    if (!xterm.current || newLogs.length === 0) return;
    
    try {
      // Save scroll position before adding new logs
      if (isUserScrolledUp.current) {
        saveScrollPosition();
      }
      
      // Append only new logs
      newLogs.forEach(log => {
        if (log.log) {
          printLogLine(log);
        }
      });
      
      // Restore scroll position if user was scrolled up
      if (isUserScrolledUp.current) {
        setTimeout(() => {
          restoreScrollPosition();
        }, 10);
      } else if (autoScroll) {
        // Auto-scroll to bottom if user was at bottom and auto-scroll is enabled
        setTimeout(() => {
          scrollToBottom();
        }, 10);
      }
    } catch (error) {
      console.error('Error appending logs:', error);
    }
  }, [printLogLine, saveScrollPosition, restoreScrollPosition, scrollToBottom]);

  // Optimized log rendering with intelligent updates
  const renderLogs = useCallback(() => {
    if (isRendering.current || !xterm.current) return;
    
    isRendering.current = true;
    
    // Clear existing timeout
    if (renderTimeout.current) {
      clearTimeout(renderTimeout.current);
    }
    
    renderTimeout.current = setTimeout(() => {
      try {
        if (xterm.current) {
          const isNewLogs = filteredLogs.length > previousLogsLength.current;
          const isFilterChange = filteredLogs.length !== lastRenderedLength.current;
          
          if (isFilterChange) {
            // Filter changed - clear and re-render everything
            xterm.current.clear();
            lineCount.current = 1;
            lastRenderedLength.current = 0;
            
            // Display all filtered logs
            const chunkSize = 100;
            let currentIndex = 0;
            
            const renderChunk = () => {
              const endIndex = Math.min(currentIndex + chunkSize, filteredLogs.length);
              
              for (let i = currentIndex; i < endIndex; i++) {
                const log = filteredLogs[i];
                if (log.log) {
                  printLogLine(log);
                }
              }
              
              currentIndex = endIndex;
              
              if (currentIndex < filteredLogs.length) {
                requestAnimationFrame(renderChunk);
              } else {
                // Always scroll to bottom for filter changes if auto-scroll is enabled
                if (autoScroll) {
                  setTimeout(() => {
                    scrollToBottom();
                  }, 10);
                }
                
                lastRenderedLength.current = filteredLogs.length;
                previousLogsLength.current = filteredLogs.length;
                isRendering.current = false;
              }
            };
            
            requestAnimationFrame(renderChunk);
          } else if (isNewLogs) {
            // New logs arrived - append only the new ones
            const newLogs = filteredLogs.slice(lastRenderedLength.current);
            appendNewLogs(newLogs);
            lastRenderedLength.current = filteredLogs.length;
            previousLogsLength.current = filteredLogs.length;
            isRendering.current = false;
          } else {
            isRendering.current = false;
          }
        }
      } catch (error) {
        console.error('Error rendering logs:', error);
        isRendering.current = false;
      }
    }, 50);
  }, [filteredLogs, printLogLine, scrollToBottom, appendNewLogs, autoScroll]);

  // Display filtered logs in terminal
  useEffect(() => {
    renderLogs();
  }, [renderLogs]);

  // Add scroll listener to track user scroll position
  useEffect(() => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      xtermContainer.addEventListener('scroll', checkScrollPosition);
      return () => {
        xtermContainer.removeEventListener('scroll', checkScrollPosition);
      };
    }
  }, [checkScrollPosition]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTimeout.current) {
        clearTimeout(renderTimeout.current);
      }
    };
  }, []);

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
        xterm={xterm}
        searchAddonRef={searchAddonRef}
      />
    </div>
  );
}