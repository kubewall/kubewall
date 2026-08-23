import { AnsiSpan, parseAnsi, splitSpans } from './ansi';
import { LogQuery, findMatchRanges } from './logFilter';
import { memo, useMemo } from 'react';

import { LogEntry } from './useLogStore';
import { TimestampMode, formatRelative, formatTimestamp, tsColumnCh } from './viewOptions';
import { cn } from '@/lib/utils';

const spanStyle = (s: AnsiSpan): React.CSSProperties | undefined => {
  if (!s.fg && !s.bg && !s.bold && !s.dim && !s.italic && !s.underline && !s.strike) return undefined;
  return {
    color: s.fg,
    backgroundColor: s.bg,
    fontWeight: s.bold ? 600 : undefined,
    opacity: s.dim ? 0.65 : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: s.underline ? 'underline' : s.strike ? 'line-through' : undefined,
  };
};

// One layout for both modes. The timestamp and container are fixed-width
// inline-block columns in wrapped *and* unwrapped mode, so toggling wrap only
// changes how the message flows - never where the columns sit.
const LINE_NO_COL =
  'shrink-0 whitespace-nowrap break-keep select-none pr-2 text-left text-[11px] tabular-nums text-muted-foreground/50';
const TS_COL =
  'kw-log-ts shrink-0 pl-2 whitespace-nowrap break-keep select-none tabular-nums text-muted-foreground/70';
// Narrow column so the dot never eats into the (truncating) name column.
const DOT_COL =
  'kw-log-ctr shrink-0 w-[calc(2ch+0.5rem)] pl-2 whitespace-nowrap break-keep select-none';
const CONTAINER_COL =
  'kw-log-ctr shrink-0 whitespace-nowrap break-keep truncate';

const LEVEL_ACCENT: Record<string, string> = {
  error: 'border-l-red-500',
  warn: 'border-l-amber-500',
  info: 'border-l-sky-500/60',
  debug: 'border-l-violet-400/50',
  trace: 'border-l-muted',
  other: 'border-l-transparent',
};

type RowProps = {
  entry: LogEntry;
  alt: boolean;
  wrap: boolean;
  isDark: boolean;
  query: LogQuery;
  containerColor: string;
  /** Width of the container column in ch, sized to the pod's longest name. */
  containerColCh: number;
  /** Width of the line-number gutter in ch, sized to the widest number. */
  lineNoColCh: number;
  tsMode: TimestampMode;
  tsFontClass: string;
  leadingClass: string;
  /** Bumped on a timer so relative ages re-render; 0 when not in relative mode. */
  nowTick: number;
};

export const LogRow = memo(({
  entry, alt, wrap, isDark, query, containerColor, containerColCh, lineNoColCh,
  tsMode, tsFontClass, leadingClass, nowTick,
}: RowProps) => {
  const pieces = useMemo(() => {
    const spans = parseAnsi(entry.raw, isDark);
    const ranges = query.isEmpty ? [] : findMatchRanges(query, entry.plain);
    return splitSpans(spans, ranges);
  }, [entry.raw, entry.plain, isDark, query]);

  const content = pieces.map((p, i) =>
    p.hl ? (
      <mark key={i} className="kw-log-hl" style={spanStyle(p.span)}>{p.text}</mark>
    ) : (
      <span key={i} style={spanStyle(p.span)}>{p.text}</span>
    )
  );

  const accent = LEVEL_ACCENT[entry.level] ?? LEVEL_ACCENT.other;

  return (
    <div
      className={cn(
        'kw-log-row flex border-l-2 px-1.5 py-px',
        leadingClass,
        accent,
        wrap ? 'w-full' : 'w-max min-w-full'
      )}
      data-alt={alt ? '1' : undefined}
    >
      <span className={LINE_NO_COL} style={{ width: `calc(${lineNoColCh}ch + 0.5rem)` }}>
        {entry.lineNo}
      </span>
      {tsMode !== 'off' && (() => {
        const width = { width: `calc(${tsColumnCh(tsMode)}ch + 0.5rem)` };
        if (tsMode === 'relative') {
          return (
            <span
              className={cn(TS_COL, tsFontClass)}
              style={width}
              title={formatTimestamp(entry.timestamp, 'utc').full}
            >
              {formatRelative(entry.timestamp, nowTick)}
            </span>
          );
        }
        const { short, full } = formatTimestamp(entry.timestamp, tsMode);
        return (
          <span className={cn(TS_COL, tsFontClass)} style={width} title={full}>{short}</span>
        );
      })()}
      <span className={DOT_COL} aria-hidden="true">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full align-middle"
          style={{ backgroundColor: containerColor }}
        />
      </span>
      <span
        className={CONTAINER_COL}
        style={{ color: containerColor, width: `${containerColCh}ch` }}
        title={entry.containerName}
      >
        {entry.containerName}
      </span>
      <span
        className={
          wrap ? 'flex-1 min-w-0 pl-2 whitespace-pre-wrap break-words' : 'shrink-0 pl-2 whitespace-pre'
        }
      >
        {content}
      </span>
    </div>
  );
});
LogRow.displayName = 'LogRow';
