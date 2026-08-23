import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { LogQuery } from './logFilter';
import { LogRow } from './LogRow';
import { ChevronsDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LogStore } from './useLogStore';
import { HistoryLimit } from './useLogStream';
import { PodDetailsSpec } from '@/types';
import { cn } from '@/lib/utils';
import { FONT_METRICS, FontSizeOption, TimestampMode, rowPitch } from './viewOptions';
import { getCssColorForContainerName } from '@/utils/Workloads/PodUtils';
import { useVirtualizer } from '@tanstack/react-virtual';

const BOTTOM_THRESHOLD = 24;
const TOP_TRIGGER = 12;
const NEAR_TOP = 240;
const TOP_DEBOUNCE = 250;

// `view` holds entry indices in ascending order, so the rows sitting below a given
// entry index are exactly its leading run.
function viewRowsBelow(view: number[], entryIndex: number): number {
  let lo = 0;
  let hi = view.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (view[mid] < entryIndex) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type LogTableProps = {
  store: LogStore;
  query: LogQuery;
  podDetailsSpec: PodDetailsSpec;
  wrap: boolean;
  isDark: boolean;
  tsMode: TimestampMode;
  fontSize: FontSizeOption;
  isLoadingHistory: boolean;
  hasMore: boolean;
  historyLimit: HistoryLimit;
  loadOlder: () => Promise<number>;
};

export function LogTable({
  store, query, podDetailsSpec, wrap, isDark, tsMode, fontSize, isLoadingHistory, hasMore, historyLimit, loadOlder,
}: LogTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const [nearTop, setNearTop] = useState(false);
  // How many lines have streamed in since the user scrolled away from the tail.
  // Counted from line numbers rather than buffer length so trimming can't skew it.
  const [newSinceLeaving, setNewSinceLeaving] = useState(0);
  const tailBaselineRef = useRef<number | null>(null);
  // Unwrapped rows are width:max-content, so a short row paints its background
  // only as far as its own text while long rows push the scroll area wider -
  // leaving the alternating stripes cut off once you scroll right. Stretch every
  // row to the widest one so the stripes span the whole scrollable width.
  const [rowMinWidth, setRowMinWidth] = useState(0);
  // Relative ages have to age on screen, so re-render the visible rows on a timer.
  const [nowTick, setNowTick] = useState(0);
  const loadingOlderRef = useRef(false);
  const topTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenPrependRef = useRef(0);
  const { entriesRef, viewRef, followRef, prependRef, version, maxLineNo } = store;

  // Row height follows the chosen font size, so it can't be a constant.
  const rowHeight = rowPitch(fontSize);
  const font = FONT_METRICS[fontSize];

  const view = viewRef.current;
  const entries = entriesRef.current;

  // Anything that changes a row's rendered height is part of its identity. The
  // virtualizer caches measured heights per item key, so folding these in makes
  // the cache miss and every row re-measure on mount. Clearing the cache alone
  // is not enough: re-measurement is driven by ResizeObserver, which never fires
  // for rows whose height happens to be unchanged (e.g. toggling UTC -> Local).
  const layoutKey = `${wrap ? 'w' : 'n'}${fontSize}${tsMode}`;

  useEffect(() => {
    setRowMinWidth(0);
  }, [wrap, query, fontSize, tsMode]);

  useEffect(() => {
    if (tsMode !== 'relative') {
      setNowTick(0);
      return;
    }
    setNowTick(Date.now());
    const timer = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [tsMode]);

  const virtualizer = useVirtualizer({
    count: view.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 40,
    getItemKey: (index) => `${layoutKey}:${entries[view[index]]?.seq ?? index}`,
  });

  const items = virtualizer.getVirtualItems();

  // Row heights measured in wrapped mode are meaningless once wrapping is off
  // (and vice versa). Without clearing them the virtualizer keeps spacing rows
  // by their stale heights, leaving big gaps between them.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [wrap, fontSize, tsMode, virtualizer]);

  // How far the existing content just moved down, given how many *entries* were
  // prepended. A filter can hide most of those, and measurements are indexed by
  // view row, so the entry count has to be converted first - otherwise the
  // correction is taken from a row thousands of pixels away. Measured where
  // possible so wrapped rows are handled too.
  const shiftFor = useCallback((prependedEntries: number) => {
    const rows = viewRowsBelow(viewRef.current, prependedEntries);
    if (rows === 0) return 0;
    const measured = virtualizer.measurementsCache?.[rows];
    return measured ? measured.start : rows * rowHeight;
  }, [virtualizer, rowHeight, viewRef]);

  // Runs after the DOM has the new rows but before paint, so the correction is
  // applied in the same frame. A requestAnimationFrame here would race React's
  // commit and intermittently do nothing.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { token, count } = prependRef.current;
    if (token !== seenPrependRef.current) {
      seenPrependRef.current = token;
      if (count > 0) {
        el.scrollTop += shiftFor(count);
        return;
      }
    }
    if (followRef.current) el.scrollTop = el.scrollHeight;
  }, [version, wrap, followRef, prependRef, shiftFor]);

  useLayoutEffect(() => {
    if (wrap) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth > rowMinWidth + 1) setRowMinWidth(el.scrollWidth);
  }, [version, wrap, rowMinWidth, view.length]);

  const pullOlder = useCallback(async () => {
    if (loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      await loadOlder();
    } finally {
      loadingOlderRef.current = false;
    }
  }, [loadOlder]);

  // Coalesce the burst of scroll events a single wheel gesture produces at the
  // top edge; without this each one starts another history request.
  const queueOlder = useCallback(() => {
    if (topTimerRef.current || loadingOlderRef.current) return;
    topTimerRef.current = setTimeout(() => {
      topTimerRef.current = null;
      void pullOlder();
    }, TOP_DEBOUNCE);
  }, [pullOlder]);

  useEffect(() => () => {
    if (topTimerRef.current) clearTimeout(topTimerRef.current);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    followRef.current = atBottom;
    if (atBottom) {
      tailBaselineRef.current = null;
      setNewSinceLeaving(0);
    } else if (tailBaselineRef.current === null) {
      tailBaselineRef.current = maxLineNo;
    }
    setShowJump(!atBottom);
    setNearTop(el.scrollTop < NEAR_TOP);
    if (el.scrollTop < TOP_TRIGGER) queueOlder();
  }, [followRef, queueOlder, maxLineNo]);

  // With only a screenful of lines there is nothing to scroll, so the
  // scroll-to-top trigger can never fire. Pull older logs until the view is
  // actually scrollable or the pod has no more history.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || entries.length === 0) return;
    const scrollable = el.scrollHeight > el.clientHeight + BOTTOM_THRESHOLD;
    // onScroll can never fire without a scrollbar, so drive nearTop from here.
    setNearTop(scrollable ? el.scrollTop < NEAR_TOP : true);
    if (scrollable || !hasMore) return;
    // An empty view is the filter hiding what we have, not a shortage of history.
    // Pulling more could never make it scrollable, so this would walk the entire
    // backlog HISTORY_BATCH lines at a time. "Load older logs" stays available -
    // nearTop is true here, so the banner is showing.
    if (view.length === 0) return;
    queueOlder();
  }, [version, hasMore, entries.length, view.length, queueOlder]);

  useEffect(() => {
    if (followRef.current || tailBaselineRef.current === null) return;
    setNewSinceLeaving(Math.max(0, maxLineNo - tailBaselineRef.current));
  }, [version, maxLineNo, followRef]);

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    followRef.current = true;
    tailBaselineRef.current = null;
    setNewSinceLeaving(0);
    setShowJump(false);
    el.scrollTop = el.scrollHeight;
  };

  // Sized to the longest container name this pod actually has, so a short name
  // like "coredns" doesn't leave a wide gap while multi-container pods stay
  // aligned. Same value in both wrap modes, so toggling never shifts columns.
  const containerColCh = useMemo(() => {
    const all = [...(podDetailsSpec?.containers ?? []), ...(podDetailsSpec?.initContainers ?? [])];
    const longest = all.reduce((max, c) => Math.max(max, (c?.name ?? '').length), 0);
    return Math.min(Math.max(longest, 4) + 2, 24);
  }, [podDetailsSpec]);

  // Floor of 3 keeps the gutter from reflowing every time the count crosses a
  // power of ten early on.
  const lineNoColCh = Math.max(store.lineNoChars, 3);

  const containerColors = useMemo(() => {
    const map = new Map<string, string>();
    const all = [...(podDetailsSpec?.containers ?? []), ...(podDetailsSpec?.initContainers ?? [])];
    all.forEach(({ name }) => map.set(name, getCssColorForContainerName(name, podDetailsSpec)));
    return map;
  }, [podDetailsSpec]);

  const showTopBanner = isLoadingHistory || (nearTop && entries.length > 0);

  return (
    <div className="relative flex-1 min-h-0">
      {showTopBanner && (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
          {isLoadingHistory ? (
            <span className="flex items-center rounded border bg-background/95 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm">
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              Loading older logs…
            </span>
          ) : hasMore ? (
            <Button
              variant="outline"
              className={cn(
                'h-6 rounded px-2 text-[11px] shadow-sm bg-background/95',
                historyLimit === 'error' && 'text-red-500'
              )}
              onClick={pullOlder}
            >
              {historyLimit === 'error' ? "Couldn't load older logs — retry" : 'Load older logs'}
            </Button>
          ) : (
            <span className="rounded border bg-background/95 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm">
              {historyLimit === 'buffer'
                ? 'Buffer full — showing the most recent lines'
                : 'Beginning of available logs'}
            </span>
          )}
        </div>
      )}

      {showJump && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={jumpToBottom}
              aria-label={newSinceLeaving > 0 ? `${newSinceLeaving} new lines, jump to latest` : 'Jump to latest'}
              className={cn(
                // Deliberately not the Button component: its outline variant sets
                // hover:text-accent-foreground, which turned the label unreadable
                // against this inverted background on hover.
                'absolute bottom-3 right-4 z-10 flex h-7 items-center gap-1 rounded-full',
                'bg-foreground text-background shadow-md transition-colors',
                'hover:bg-foreground/85 hover:text-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                newSinceLeaving > 0 ? 'pl-2.5 pr-2' : 'px-2'
              )}
            >
              {newSinceLeaving > 0 && (
                <span className="text-[11px] font-medium leading-none tabular-nums">
                  +{newSinceLeaving.toLocaleString()}
                </span>
              )}
              <ChevronsDown className="h-3.5 w-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {newSinceLeaving > 0
              ? `${newSinceLeaving.toLocaleString()} new ${newSinceLeaving === 1 ? 'line' : 'lines'} — jump to latest`
              : 'Jump to latest'}
          </TooltipContent>
        </Tooltip>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          'kw-logs-scroll h-full w-full font-mono',
          font.containerClass,
          wrap ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'
        )}
      >
        {view.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {entries.length === 0 ? 'Waiting for logs…' : 'No lines match the current filter'}
          </div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {items.map((item) => {
              const entry = entries[view[item.index]];
              if (!entry) return null;
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={wrap ? virtualizer.measureElement : undefined}
                  className="absolute left-0 top-0"
                  style={{
                    transform: `translateY(${item.start}px)`,
                    ...(wrap
                      ? { width: '100%' }
                      : { minWidth: rowMinWidth ? `${rowMinWidth}px` : '100%' }),
                  }}
                >
                  <LogRow
                    entry={entry}
                    alt={item.index % 2 === 1}
                    wrap={wrap}
                    isDark={isDark}
                    query={query}
                    containerColor={containerColors.get(entry.containerName) ?? '#a8a29e'}
                    containerColCh={containerColCh}
                    lineNoColCh={lineNoColCh}
                    tsMode={tsMode}
                    tsFontClass={font.tsFontClass}
                    leadingClass={font.leadingClass}
                    nowTick={nowTick}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
