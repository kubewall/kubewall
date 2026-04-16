import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { PodDetailsSpec, PodSocketResponse } from "@/types";
import { getColorForContainerName, getEventStreamUrl } from "@/utils";

import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import XtermTerminal from "../Xtrem";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import { fetchLogHistory } from "@/data/Workloads/Pods/fetchLogHistory";

export type SocketLogsHandle = {
  replayFiltered: (term: string) => void;
  replayAll: () => void;
  getTerminal: () => Terminal | null;
};

type SocketLogsProps = {
  pod: string;
  namespace: string;
  containerName: string;
  configName: string;
  clusterName: string;
  podDetailsSpec: PodDetailsSpec;
  updateLogs: (currentLog: PodSocketResponse) => void;
  onCountChange: (total: number, visible: number) => void;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
  socketLogsRef: MutableRefObject<SocketLogsHandle | null>;
  isDark: boolean;
  filterMode: boolean;
  filterTerm: string;
}

const RESET = '\x1b[0m';
const SEP = '  ● ';

const COLOR_TIMESTAMP_DARK = '\x1b[38;5;242m';
const COLOR_TIMESTAMP_LIGHT = '\x1b[38;5;245m';

const ALT_ROW_BG_DARK = '\x1b[48;5;234m';
const ALT_ROW_BG_LIGHT = '\x1b[48;2;245;245;250m';

function formatTimestamp(raw: string): string {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = pad(d.getUTCDate());
    const year = d.getUTCFullYear();
    const hh = pad(d.getUTCHours());
    const mm = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    const ms = pad(d.getUTCMilliseconds(), 3);
    return `${month} ${day}, ${year} ${hh}:${mm}:${ss}.${ms}`;
  } catch {
    return raw;
  }
}

function matchesTerm(log: string, term: string): boolean {
  if (!term.trim()) return true;
  try {
    const isRegex = term.startsWith('/') && term.endsWith('/') && term.length > 2;
    const pattern = isRegex ? term.slice(1, -1) : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(pattern, 'i').test(log);
  } catch {
    return log.toLowerCase().includes(term.toLowerCase());
  }
}

export function SocketLogs({
  pod, containerName, namespace, configName, clusterName,
  podDetailsSpec, searchAddonRef, socketLogsRef, updateLogs, onCountChange,
  isDark, filterMode, filterTerm,
}: SocketLogsProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const xterm = useRef<Terminal | null>(null);
  const rowIndexRef = useRef(0);
  const allLogsRef = useRef<PodSocketResponse[]>([]);
  const visibleCountRef = useRef(0);
  const filterModeRef = useRef(filterMode);
  const filterTermRef = useRef(filterTerm);
  const isDarkRef = useRef(isDark);
  const isLoadingHistoryRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const isRenderingRef = useRef(false);
  const pendingLogsRef = useRef<PodSocketResponse[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  filterModeRef.current = filterMode;
  filterTermRef.current = filterTerm;
  isDarkRef.current = isDark;

  const renderLine = (message: PodSocketResponse, rowIndex: number) => {
    if (!xterm.current) return;

    const dark = isDarkRef.current;
    const isAlt = rowIndex % 2 !== 0;
    const bg = isAlt ? (dark ? ALT_ROW_BG_DARK : ALT_ROW_BG_LIGHT) : '';
    const COLOR_TIMESTAMP = dark ? COLOR_TIMESTAMP_DARK : COLOR_TIMESTAMP_LIGHT;
    const containerColor = getColorForContainerName(message.containerName, podDetailsSpec) ?? '\x1b[37m';
    const ts = formatTimestamp(message.timestamp);

    const containerLabel = message.containerName
      ? `${containerColor}${message.containerName}${RESET}${bg} `
      : '';

    const visibleText = [
      ts, SEP,
      message.containerName ? `${message.containerName} ` : '',
      message.log,
    ].join('');

    const cols = xterm.current.cols || 220;
    const pad = bg ? ' '.repeat(Math.max(0, cols - visibleText.length)) : '';

    if (bg) {
      // For lines with background color, we need to inject background color into ANSI sequences
      let processedLog = message.log;
      // If the log contains ANSI codes, we need to inject background color after each color change
      if (message.log.includes('\x1b[')) {
        // Replace all ANSI color codes to include our background color
        processedLog = message.log
          // After any color code (like \x1b[31m), add our background
          .replace(/(\x1b\[[0-9;]*m)/g, `$1${bg}`)
          // After reset codes, re-apply background
          .replace(/(\x1b\[0m)/g, `$1${bg}`);
      } else {
        // No ANSI codes, just apply background
        processedLog = `${bg}${message.log}`;
      }
      const line = `${bg}${COLOR_TIMESTAMP}${ts}${RESET}${bg} ${containerColor}●${RESET}${bg} ${containerLabel}${processedLog}${pad}${RESET}`;
      xterm.current.writeln(line);
    } else {
      const line = `${COLOR_TIMESTAMP}${ts}${RESET} ${containerColor}●${RESET} ${containerLabel}${message.log}`;
      xterm.current.writeln(line);
    }
  };

  const replayFiltered = (term: string) => {
    if (!xterm.current) return;
    xterm.current.clear();
    rowIndexRef.current = 0;
    const matched = allLogsRef.current.filter((m) => matchesTerm(m.log, term));
    matched.forEach((m) => {
      renderLine(m, rowIndexRef.current);
      rowIndexRef.current++;
    });
    visibleCountRef.current = matched.length;
    onCountChange(allLogsRef.current.length, matched.length);
  };

  const replayAll = () => {
    if (!xterm.current) return;
    xterm.current.clear();
    rowIndexRef.current = 0;
    allLogsRef.current.forEach((m) => {
      renderLine(m, rowIndexRef.current);
      rowIndexRef.current++;
    });
    visibleCountRef.current = allLogsRef.current.length;
    onCountChange(allLogsRef.current.length, allLogsRef.current.length);
  };

  const replayWithScrollRestore = (prependedCount: number) => {
    if (!xterm.current) return;
    const term = xterm.current;
    const currentTopLine = term.buffer.active.viewportY;

    isRenderingRef.current = true;
    term.clear();
    rowIndexRef.current = 0;

    if (filterModeRef.current && filterTermRef.current.trim()) {
      const matched = allLogsRef.current.filter((m) => matchesTerm(m.log, filterTermRef.current));
      matched.forEach((m) => {
        renderLine(m, rowIndexRef.current);
        rowIndexRef.current++;
      });
      visibleCountRef.current = matched.length;
      onCountChange(allLogsRef.current.length, matched.length);
    } else {
      allLogsRef.current.forEach((m) => {
        renderLine(m, rowIndexRef.current);
        rowIndexRef.current++;
      });
      visibleCountRef.current = allLogsRef.current.length;
      onCountChange(allLogsRef.current.length, allLogsRef.current.length);
    }

    // Restore scroll position accounting for prepended lines
    requestAnimationFrame(() => {
      term.scrollToLine(currentTopLine + prependedCount);
      isRenderingRef.current = false;

      // Flush any logs that arrived during rendering
      const pending = pendingLogsRef.current.splice(0);
      pending.forEach((m) => printLogLine(m));
    });
  };

  const handleScrollToTop = useCallback(async () => {
    if (isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;
    if (allLogsRef.current.length === 0) return;
    if (allLogsRef.current.length > 45000) return; // xterm scrollback limit safety

    isLoadingHistoryRef.current = true;
    setIsLoadingHistory(true);

    try {
      const oldestLog = allLogsRef.current.find(l => l.timestamp);
      if (!oldestLog?.timestamp) return;

      const response = await fetchLogHistory(pod, {
        namespace,
        config: configName,
        cluster: clusterName,
        container: containerName || undefined,
        allContainers: !containerName,
        before: oldestLog.timestamp,
        batchSize: 500,
      });

      if (response.logs.length === 0) {
        hasMoreHistoryRef.current = false;
        return;
      }

      hasMoreHistoryRef.current = response.hasMore;

      const prependedCount = response.logs.length;
      allLogsRef.current = [...response.logs, ...allLogsRef.current];

      replayWithScrollRestore(prependedCount);
    } catch (err) {
      // Silently fail — user can retry by scrolling up again
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [pod, namespace, configName, clusterName, containerName]);

  socketLogsRef.current = { replayFiltered, replayAll, getTerminal: () => xterm.current };

  // Replay on terminal resize so alt-row padding recalculates with the new col width.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (filterModeRef.current && filterTermRef.current.trim()) {
          replayFiltered(filterTermRef.current);
        } else {
          replayAll();
        }
      });
    };
    const term = xterm.current;
    const disposable = term?.onResize(handleResize);
    return () => {
      clearTimeout(debounceTimer);
      disposable?.dispose();
    };
  }, []);

  useEffect(() => {
    if (filterModeRef.current && filterTermRef.current.trim()) {
      replayFiltered(filterTermRef.current);
    } else {
      replayAll();
    }
  }, [isDark]);

  const printLogLine = (message: PodSocketResponse) => {
    if (isRenderingRef.current) {
      pendingLogsRef.current.push(message);
      return;
    }
    allLogsRef.current.push(message);
    const total = allLogsRef.current.length;
    if (filterModeRef.current && !matchesTerm(message.log, filterTermRef.current)) {
      onCountChange(total, visibleCountRef.current);
      return;
    }
    renderLine(message, rowIndexRef.current);
    rowIndexRef.current++;
    visibleCountRef.current++;
    onCountChange(total, visibleCountRef.current);
  };

  const sendMessage = (lastMessage: PodSocketResponse) => {
    if (lastMessage.log) {
      if (!containerName || lastMessage.containerName === containerName) {
        printLogLine(lastMessage);
        updateLogs(lastMessage);
      }
    }
  };

  // Reset history state when container changes
  useEffect(() => {
    hasMoreHistoryRef.current = true;
    isLoadingHistoryRef.current = false;
  }, [containerName]);

  useEventSource({
    url: getEventStreamUrl(`pods/${pod}/logs`, {
      namespace,
      config: configName,
      cluster: clusterName,
      ...(containerName ? { container: containerName } : { 'all-containers': 'true' }),
    }),
    sendMessage,
  });

  return (
    <div ref={logContainerRef} className="m-2 flex-1 min-h-0">
      <XtermTerminal
        containerNameProp={containerName}
        xterm={xterm}
        searchAddonRef={searchAddonRef}
        updateLogs={updateLogs}
        onScrollToTop={handleScrollToTop}
        isLoadingHistory={isLoadingHistory}
      />
    </div>
  );
}
