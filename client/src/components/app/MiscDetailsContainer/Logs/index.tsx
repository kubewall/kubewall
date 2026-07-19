import { ChevronDownIcon, ChevronUpIcon, Cross2Icon, DownloadIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from "react";

import { CotainerSelector } from "./ContainerSelector";
import { Filter } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { PodSocketResponse } from '@/types';
import { RootState } from "@/redux/store";
import { SearchAddon } from '@xterm/addon-search';
import { SocketLogs } from "./SocketLogs";
import type { SocketLogsHandle } from "./SocketLogs";
import { cn } from '@/lib/utils';
import { useAppSelector } from "@/redux/hooks";
import { useTheme } from "@/components/app/ThemeProvider";

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
}

const SEARCH_DECORATIONS = {
  matchBackground: '#FFFF00',
  matchBorder: '#FFFF00',
  matchOverviewRuler: '#FFFF00',
  activeMatchBackground: '#FF9632',
  activeMatchBorder: '#FF9632',
  activeMatchColorOverviewRuler: '#FF9632',
};

// Same cap as SocketLogs' own internal buffer - this one exists only to
// back the download button, so it doesn't need SocketLogs' scroll-position-
// aware trimming; it can just trim unconditionally.
const MAX_BUFFER = 50000;
const TRIM_TO = 45000;

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [logCounts, setLogCounts] = useState({ total: 0, visible: 0 });
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const [selectedContainer, setSelectedContainer] = useState('');
  // A ref, not state: this is written on every incoming log line (once per
  // SSE message) and only ever read on click (download), so it must not
  // trigger a re-render or copy the array on each message.
  const logsRef = useRef<PodSocketResponse[]>([]);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const socketLogsRef = useRef<SocketLogsHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const logsPanelRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runSearch = (term: string, direction: 'next' | 'prev' = 'next') => {
    const addon = searchAddonRef.current;
    if (!addon) return;
    if (!term.trim()) {
      addon.clearDecorations();
      return;
    }
    const isRegex = term.startsWith('/') && term.endsWith('/') && term.length > 2;
    const query = isRegex ? term.slice(1, -1) : term;
    const opts = { regex: isRegex, caseSensitive: false, wholeWord: false, incremental: false, decorations: SEARCH_DECORATIONS };
    if (direction === 'next') addon.findNext(query, opts);
    else addon.findPrevious(query, opts);
  };

  const prevSearchTermRef = useRef('');

  // The buffer-wide work below (replaying up to 50k lines, or an xterm
  // addon scan with highlightLimit: 50000) is too expensive to run on every
  // keystroke. Only the input value itself updates synchronously; the
  // search/replay work is debounced.
  const applySearch = (val: string) => {
    const addon = searchAddonRef.current;

    if (!val.trim()) {
      prevSearchTermRef.current = '';
      addon?.clearDecorations();
      if (filterMode) socketLogsRef.current?.replayAll();
      return;
    }

    if (filterMode) {
      socketLogsRef.current?.replayFiltered(val);
      prevSearchTermRef.current = val;
      return;
    }

    const isRegex = val.startsWith('/') && val.endsWith('/') && val.length > 2;
    const query = isRegex ? val.slice(1, -1) : val;
    const baseOpts = { regex: isRegex, caseSensitive: false, wholeWord: false, decorations: SEARCH_DECORATIONS };

    const wasEmpty = !prevSearchTermRef.current.trim();
    prevSearchTermRef.current = val;

    if (wasEmpty) {
      const term = socketLogsRef.current?.getTerminal();
      if (term) {
        const viewportY = term.buffer.active.viewportY;
        term.selectLines(viewportY, viewportY);
      }
      addon?.findNext(query, { ...baseOpts, incremental: true });
    } else {
      addon?.findNext(query, { ...baseOpts, incremental: true });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => applySearch(val), 200);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !filterMode) {
      e.shiftKey ? runSearch(searchTerm, 'prev') : runSearch(searchTerm, 'next');
    }
    if (e.key === 'Escape') {
      // Cancel any pending debounced search so a stale keystroke from before
      // Escape can't re-apply itself 200ms after this immediate clear.
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      setSearchTerm('');
      prevSearchTermRef.current = '';
      searchAddonRef.current?.clearDecorations();
      if (filterMode) socketLogsRef.current?.replayAll();
    }
  };

  const handleClear = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchTerm('');
    prevSearchTermRef.current = '';
    searchAddonRef.current?.clearDecorations();
    if (filterMode) socketLogsRef.current?.replayAll();
  };

  const handleFilterToggle = () => {
    // Avoid a redundant replay if a debounced search from a just-typed
    // keystroke is still pending — this immediate replay already covers it.
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const next = !filterMode;
    setFilterMode(next);
    if (next && searchTerm.trim()) {
      socketLogsRef.current?.replayFiltered(searchTerm);
    } else {
      socketLogsRef.current?.replayAll();
    }
  };

  const downloadLogs = () => {
    const a = document.createElement('a');
    let logString = '';
    logsRef.current.forEach((log) => {
      if (log.containerChange) {
        logString += `── ${log.containerName || 'All Containers'} ──\n`;
      } else {
        // eslint-disable-next-line no-control-regex
        logString += `${log.containerName ? `${log.containerName}: ` : ''}${log.log.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')}\n`;
      }
    });
    a.href = `data:text/plain,${encodeURIComponent(logString)}`;
    a.download = `${podDetails.metadata.name}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const updateLogs = (currentLog: PodSocketResponse) => {
    logsRef.current.push(currentLog);
    if (logsRef.current.length > MAX_BUFFER) {
      logsRef.current = logsRef.current.slice(-TRIM_TO);
    }
  };

  // Called once per incoming SSE log line. Coalesce into at most one state
  // update (and one PodLogs re-render) per animation frame, instead of one
  // per line - a bursty pod can otherwise emit far faster than 60/sec.
  const pendingCountsRef = useRef<{ total: number; visible: number } | null>(null);
  const countsRafRef = useRef<number | null>(null);

  const handleCountChange = (total: number, visible: number) => {
    pendingCountsRef.current = { total, visible };
    if (countsRafRef.current === null) {
      countsRafRef.current = requestAnimationFrame(() => {
        countsRafRef.current = null;
        if (pendingCountsRef.current) {
          setLogCounts(pendingCountsRef.current);
        }
      });
    }
  };

  useEffect(() => {
    return () => {
      if (countsRafRef.current !== null) cancelAnimationFrame(countsRafRef.current);
    };
  }, []);

  return (
    <div ref={logsPanelRef} className="flex flex-col h-full border rounded-lg overflow-hidden" tabIndex={-1}>
      <div className="flex items-center h-10 border-b bg-muted/50">
        <div className="flex items-center flex-1 min-w-0 h-full border-r">
          <MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 ml-3 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Find logs... (/)"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className="h-full flex-1 rounded-none border-0 text-xs font-mono shadow-none focus-visible:ring-0 bg-transparent px-2"
          />
          {searchTerm && (
            <button
              type="button"
              className="h-full px-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              title="Clear search (Escape)"
              onClick={handleClear}
            >
              <Cross2Icon className="h-3.5 w-3.5" />
            </button>
          )}
          {!filterMode && (
            <>
              <button
                type="button"
                className="h-full px-2 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l"
                title="Previous match (Shift+Enter)"
                onClick={() => runSearch(searchTerm, 'prev')}
              >
                <ChevronUpIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-full px-2 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Next match (Enter)"
                onClick={() => runSearch(searchTerm, 'next')}
              >
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            className={cn(
              "h-full px-2.5 flex items-center gap-1.5 text-xs transition-colors border-l",
              filterMode
                ? "text-primary bg-primary/10 hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title={filterMode ? "Showing matched lines only — click to show all" : "Filter to matched lines only"}
            onClick={handleFilterToggle}
          >
            <Filter className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center h-full shrink-0">
          {logCounts.total > 0 && (
            <span className="px-3 text-xs text-muted-foreground tabular-nums border-r whitespace-nowrap">
              {filterMode && logCounts.visible !== logCounts.total
                ? <>{logCounts.visible.toLocaleString()} <span className="opacity-50">/ {logCounts.total.toLocaleString()}</span></>
                : logCounts.total.toLocaleString()
              }
              {' lines'}
            </span>
          )}
          <CotainerSelector
            podDetailsSpec={podDetails.spec}
            selectedContainer={selectedContainer}
            setSelectedContainer={setSelectedContainer}
          />
          <button
            type="button"
            className="h-full px-3 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l"
            title="Download logs"
            onClick={downloadLogs}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
          </button>
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
        onCountChange={handleCountChange}
        searchAddonRef={searchAddonRef}
        socketLogsRef={socketLogsRef}
        isDark={isDark}
        filterMode={filterMode}
        filterTerm={searchTerm}
      />
    </div>
  );
};

export { PodLogs };
