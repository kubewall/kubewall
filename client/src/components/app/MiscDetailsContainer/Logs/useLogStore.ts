import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

import { LogLevel, LogQuery, EMPTY_QUERY, detectLevel, matchesQuery } from './logFilter';
import { PodSocketResponse } from '@/types';
import { stripAnsi } from './ansi';

export type LogEntry = {
  seq: number;
  /** 0 is the first line received on connect; live lines count up, history down. */
  lineNo: number;
  containerName: string;
  timestamp: string;
  raw: string;
  plain: string;
  lower: string;
  level: LogLevel;
};

const MAX_BUFFER = 50000;
const TRIM_TO = 45000;
const HARD_MAX_BUFFER = MAX_BUFFER * 2;

export type LogStore = {
  entriesRef: MutableRefObject<LogEntry[]>;
  viewRef: MutableRefObject<number[]>;
  followRef: MutableRefObject<boolean>;
  prependRef: MutableRefObject<{ token: number; count: number }>;
  version: number;
  total: number;
  visible: number;
  levelCounts: Record<LogLevel, number>;
  /** Widest line number currently in the buffer, in characters. */
  lineNoChars: number;
  /** Highest line number handed out so far; grows monotonically per connection. */
  maxLineNo: number;
  append: (msg: PodSocketResponse) => void;
  prependBatch: (msgs: PodSocketResponse[]) => number;
  clear: () => void;
  setFilter: (query: LogQuery, levels: Set<LogLevel> | null, containers: Set<string> | null) => void;
  getText: (onlyVisible: boolean) => string;
};

const emptyCounts = (): Record<LogLevel, number> =>
  ({ error: 0, warn: 0, info: 0, debug: 0, trace: 0, other: 0 });

export function useLogStore(): LogStore {
  const entriesRef = useRef<LogEntry[]>([]);
  const viewRef = useRef<number[]>([]);
  const followRef = useRef(true);
  const seqRef = useRef(0);
  const queryRef = useRef<LogQuery>(EMPTY_QUERY);
  const levelsRef = useRef<Set<LogLevel> | null>(null);
  const containersRef = useRef<Set<string> | null>(null);
  const countsRef = useRef<Record<LogLevel, number>>(emptyCounts());
  const prependRef = useRef({ token: 0, count: 0 });
  // Next number to hand a newly streamed line, and the lowest number handed out
  // so far. Numbers live on the entry, so trimming and filtering never renumber.
  const nextUpRef = useRef(0);
  const minLineRef = useRef(0);

  const [version, setVersion] = useState(0);
  const rafRef = useRef<number | null>(null);

  const bump = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setVersion((v) => v + 1);
    });
  }, []);

  const bumpNow = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const passes = (e: LogEntry) => {
    const containers = containersRef.current;
    if (containers && !containers.has(e.containerName)) return false;
    const levels = levelsRef.current;
    if (levels && !levels.has(e.level)) return false;
    const q = queryRef.current;
    return q.isEmpty ? true : matchesQuery(q, e.lower, e.plain);
  };

  const rebuild = useCallback(() => {
    const entries = entriesRef.current;
    const next: number[] = [];
    const counts = emptyCounts();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      counts[e.level]++;
      if (passes(e)) next.push(i);
    }
    viewRef.current = next;
    countsRef.current = counts;
  }, []);

  const toEntry = (msg: PodSocketResponse, lineNo: number): LogEntry => {
    const raw = msg.log ?? '';
    const plain = stripAnsi(raw);
    return {
      seq: seqRef.current++,
      lineNo,
      containerName: msg.containerName ?? '',
      timestamp: msg.timestamp ?? '',
      raw,
      plain,
      lower: plain.toLowerCase(),
      level: detectLevel(plain),
    };
  };

  const append = useCallback((msg: PodSocketResponse) => {
    const entry = toEntry(msg, nextUpRef.current++);
    const entries = entriesRef.current;
    entries.push(entry);
    countsRef.current[entry.level]++;

    const over = entries.length > MAX_BUFFER;
    if ((followRef.current && over) || entries.length > HARD_MAX_BUFFER) {
      entriesRef.current = entries.slice(-TRIM_TO);
      rebuild();
      bump();
      return;
    }

    if (passes(entry)) viewRef.current.push(entries.length - 1);
    bump();
  }, [bump, rebuild]);

  const prependBatch = useCallback((msgs: PodSocketResponse[]) => {
    if (!msgs.length) return 0;
    // msgs run oldest -> newest, so the newest sits just below the current
    // minimum: [min - n, ... , min - 1].
    const base = minLineRef.current - msgs.length;
    const older = msgs.map((m, i) => toEntry(m, base + i));
    minLineRef.current = base;
    entriesRef.current = [...older, ...entriesRef.current];
    prependRef.current = { token: prependRef.current.token + 1, count: older.length };
    rebuild();
    bumpNow();
    return older.length;
  }, [bumpNow, rebuild]);

  const clear = useCallback(() => {
    entriesRef.current = [];
    viewRef.current = [];
    // Emptying the buffer - switching pod, or the trash button - means there is
    // nothing left to hold the view in place, so go back to tracking the tail.
    followRef.current = true;
    countsRef.current = emptyCounts();
    seqRef.current = 0;
    nextUpRef.current = 0;
    minLineRef.current = 0;
    prependRef.current = { token: prependRef.current.token + 1, count: 0 };
    bumpNow();
  }, [bumpNow]);

  const setFilter = useCallback((query: LogQuery, levels: Set<LogLevel> | null, containers: Set<string> | null) => {
    queryRef.current = query;
    levelsRef.current = levels;
    containersRef.current = containers;
    rebuild();
    bumpNow();
  }, [bumpNow, rebuild]);

  const getText = useCallback((onlyVisible: boolean) => {
    const entries = entriesRef.current;
    const idx = onlyVisible ? viewRef.current : null;
    const n = idx ? idx.length : entries.length;
    const out: string[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const e = entries[idx ? idx[i] : i];
      // Exactly what the backend sent, with no timestamp or container prefix.
      out[i] = e.raw;
    }
    return out.join('\n');
  }, []);

  return {
    entriesRef,
    viewRef,
    followRef,
    prependRef,
    version,
    total: entriesRef.current.length,
    visible: viewRef.current.length,
    levelCounts: countsRef.current,
    maxLineNo: nextUpRef.current - 1,
    lineNoChars: Math.max(
      String(Math.max(nextUpRef.current - 1, 0)).length,
      String(minLineRef.current).length
    ),
    append,
    prependBatch,
    clear,
    setFilter,
    getText,
  };
}
