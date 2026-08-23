import './index.css';

import { Cross2Icon, DownloadIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { LOG_LEVELS, LogLevel, parseQuery } from './logFilter';
import { SlidersHorizontal, Trash2, WrapText } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { CotainerSelector } from './ContainerSelector';
import { Input } from '@/components/ui/input';
import { FontSizeOption, TimestampMode } from './viewOptions';
import { LogTable } from './LogTable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RootState } from '@/redux/store';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/redux/hooks';
import { useLogStore } from './useLogStore';
import { useLogStream } from './useLogStream';
import { useTheme } from '@/components/app/ThemeProvider';

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  error: 'text-red-500',
  warn: 'text-amber-500',
  info: 'text-sky-500',
  debug: 'text-violet-400',
  trace: 'text-muted-foreground',
  other: 'text-muted-foreground',
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: 'Error', warn: 'Warn', info: 'Info', debug: 'Debug', trace: 'Trace', other: 'Other',
};

const Hint = ({ label, children, className }: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom" className={className}>{label}</TooltipContent>
  </Tooltip>
);

const FILTER_HELP = [
  'Show only lines that match everything you type.',
  '',
  'error timeout      both words must appear',
  '"exact phrase"     match the phrase as written',
  '-healthz           hide lines containing this',
  '/GET|POST/         regular expression',
  '',
  'Press / to jump here, Esc to clear.',
].join('\n');

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
};

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex overflow-hidden rounded border">
        {options.map((option, i) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'flex-1 px-2 py-1 text-[11px] transition-colors',
              i > 0 && 'border-l',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  const [rawQuery, setRawQuery] = useState('');
  const [levels, setLevels] = useState<Set<LogLevel> | null>(null);
  const [wrap, setWrap] = useState(true);
  const [tsMode, setTsMode] = useState<TimestampMode>('utc');
  const [fontSize, setFontSize] = useState<FontSizeOption>('default');
  // Empty set means every container.
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const { isDark } = useTheme();

  const store = useLogStore();
  const { isLoadingHistory, hasMore, historyLimit, loadOlder } = useLogStream({
    pod: name, namespace, configName, clusterName, store,
  });

  const deferredQuery = useDeferredValue(rawQuery);
  const query = useMemo(() => parseQuery(deferredQuery), [deferredQuery]);

  const containerFilter = useMemo(
    () => (selectedContainers.size ? selectedContainers : null),
    [selectedContainers]
  );

  const { setFilter } = store;
  useEffect(() => {
    setFilter(query, levels, containerFilter);
  }, [query, levels, containerFilter, setFilter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleLevel = (level: LogLevel) => {
    setLevels((current) => {
      const next = new Set(current ?? LOG_LEVELS);
      if (current === null) {
        next.clear();
        next.add(level);
      } else if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      if (next.size === 0 || next.size === LOG_LEVELS.length) return null;
      return next;
    });
  };

  const download = () => {
    const filtered = !query.isEmpty || levels !== null || containerFilter !== null;
    const blob = new Blob([store.getText(filtered)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podDetails?.metadata?.name ?? name}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isFiltered = !query.isEmpty || levels !== null || containerFilter !== null;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col h-full border rounded-lg overflow-hidden" tabIndex={-1}>
      <div className="flex items-center h-10 border-b bg-muted/50 shrink-0">
        <div className="flex items-center flex-1 min-w-0 h-full border-r">
          <Hint label={FILTER_HELP} className="max-w-none whitespace-pre font-mono text-[11px] leading-relaxed">
            <span className="ml-3 flex shrink-0 cursor-help items-center text-muted-foreground">
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            </span>
          </Hint>
          <Input
            ref={searchInputRef}
            placeholder='Filter logs — match all words · "phrase" · -exclude · /regex/'
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setRawQuery(''); }}
            spellCheck={false}
            className={cn(
              'h-full flex-1 rounded-none border-0 text-xs font-mono shadow-none focus-visible:ring-0 bg-transparent px-2',
              query.invalid && 'text-red-500'
            )}
          />
          {rawQuery && (
            <Hint label="Clear filter (Escape)"><button
              type="button"
              className="h-full px-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setRawQuery('')}
              aria-label="Clear filter"
            >
              <Cross2Icon className="h-3.5 w-3.5" />
            </button></Hint>
          )}
        </div>

        <div className="flex items-center h-full shrink-0">
          {LOG_LEVELS.map((level) => {
            const count = store.levelCounts[level];
            // A level with nothing in the buffer is noise - unless it is one of
            // the levels being filtered on, where hiding its chip takes away the
            // only way to undo the filter and leaves "No lines match the current
            // filter" with nothing on screen to explain it.
            if (!count && !levels?.has(level)) return null;
            const active = levels === null || levels.has(level);
            return (
              <Hint
                key={level}
                label={`${count.toLocaleString()} ${LEVEL_LABEL[level].toLowerCase()} ${count === 1 ? 'line' : 'lines'} — click to ${active && levels !== null ? 'hide' : 'show only'} this level`}
              >
                <button
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className={cn(
                    'h-full px-2 flex items-center gap-1 text-[11px] border-l transition-colors hover:bg-accent',
                    active ? LEVEL_STYLE[level] : 'text-muted-foreground/40'
                  )}
                >
                  <span>{LEVEL_LABEL[level]}</span>
                  <span className="tabular-nums opacity-70">{count.toLocaleString()}</span>
                </button>
              </Hint>
            );
          })}

          <Hint
            label={
              isFiltered && store.visible !== store.total
                ? `${store.visible.toLocaleString()} of ${store.total.toLocaleString()} buffered lines match the current filter`
                : `${store.total.toLocaleString()} lines in the buffer`
            }
          >
            <span className="px-3 text-xs text-muted-foreground tabular-nums border-l whitespace-nowrap cursor-default">
              {isFiltered && store.visible !== store.total
                ? <>{store.visible.toLocaleString()} <span className="opacity-50">/ {store.total.toLocaleString()}</span></>
                : store.total.toLocaleString()}
              {' lines'}
            </span>
          </Hint>

          <CotainerSelector
            podDetailsSpec={podDetails.spec}
            selectedContainers={selectedContainers}
            setSelectedContainers={setSelectedContainers}
          />

          <Hint label={wrap ? 'Wrapping long lines — click for single line' : 'Wrap long lines'}>
            <button
              type="button"
              className={cn(
                'h-full px-2.5 flex items-center transition-colors border-l',
                wrap ? 'text-primary bg-primary/10 hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              onClick={() => setWrap((w) => !w)}
            >
              <WrapText className="h-3.5 w-3.5" />
            </button>
          </Hint>

          <Popover>
            <Hint label="View options — timestamp and font size">
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-full px-2.5 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
            </Hint>
            <PopoverContent align="end" className="w-[220px] space-y-3 p-3">
              <Segmented
                label="Timestamp"
                value={tsMode}
                onChange={setTsMode}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'utc', label: 'UTC' },
                  { value: 'local', label: 'Local' },
                  { value: 'relative', label: 'Ago' },
                ]}
              />
              <Segmented
                label="Font size"
                value={fontSize}
                onChange={setFontSize}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'default', label: 'Default' },
                  { value: 'large', label: 'Large' },
                ]}
              />
            </PopoverContent>
          </Popover>

          <Hint label="Clear the log buffer">
            <button
              type="button"
              className="h-full px-2.5 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l"
              onClick={store.clear}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Hint>

          <Hint label={isFiltered ? 'Download the filtered lines exactly as sent by the cluster' : 'Download the raw lines exactly as sent by the cluster'}>
            <button
              type="button"
              className="h-full px-3 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l"
              onClick={download}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
            </button>
          </Hint>
        </div>
      </div>

      <LogTable
        store={store}
        query={query}
        podDetailsSpec={podDetails.spec}
        wrap={wrap}
        isDark={isDark}
        tsMode={tsMode}
        fontSize={fontSize}
        isLoadingHistory={isLoadingHistory}
        hasMore={hasMore}
        historyLimit={historyLimit}
        loadOlder={loadOlder}
      />
    </div>
    </TooltipProvider>
  );
};

export { PodLogs };
