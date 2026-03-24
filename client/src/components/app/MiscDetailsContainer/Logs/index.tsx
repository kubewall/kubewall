import './index.css';

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
  matchBackground: '#b45309',
  matchBorder: '#d97706',
  matchOverviewRuler: '#d97706',
  activeMatchBackground: '#0369a1',
  activeMatchBorder: '#0ea5e9',
  activeMatchColorOverviewRuler: '#0ea5e9',
};

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [logCounts, setLogCounts] = useState({ total: 0, visible: 0 });
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [logs, setLogs] = useState<PodSocketResponse[]>([]);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const socketLogsRef = useRef<SocketLogsHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const logsPanelRef = useRef<HTMLDivElement>(null);
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !filterMode) {
      e.shiftKey ? runSearch(searchTerm, 'prev') : runSearch(searchTerm, 'next');
    }
    if (e.key === 'Escape') {
      setSearchTerm('');
      prevSearchTermRef.current = '';
      searchAddonRef.current?.clearDecorations();
      if (filterMode) socketLogsRef.current?.replayAll();
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    prevSearchTermRef.current = '';
    searchAddonRef.current?.clearDecorations();
    if (filterMode) socketLogsRef.current?.replayAll();
  };

  const handleFilterToggle = () => {
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
    logs.forEach((log) => {
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
    setLogs((prev) => [...prev, currentLog]);
  };

  const handleCountChange = (total: number, visible: number) => {
    setLogCounts({ total, visible });
  };

  return (
    <div ref={logsPanelRef} className="logs flex-col md:flex border rounded-lg" tabIndex={-1}>
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
