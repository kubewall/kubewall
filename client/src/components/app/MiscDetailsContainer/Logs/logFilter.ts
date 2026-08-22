export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'other';

export const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace', 'other'];

const LEVEL_RE = /\b(fatal|panic|critical|error|erro|err|warning|warn|wrn|notice|info|inf|debug|dbg|trace|trc)\b/i;

const LEVEL_OF: Record<string, LogLevel> = {
  fatal: 'error', panic: 'error', critical: 'error', error: 'error', erro: 'error', err: 'error',
  warning: 'warn', warn: 'warn', wrn: 'warn',
  notice: 'info', info: 'info', inf: 'info',
  debug: 'debug', dbg: 'debug',
  trace: 'trace', trc: 'trace',
};

// Only the head of a line is scanned: level tokens live in the prefix, and this
// runs once per ingested line.
export function detectLevel(plain: string): LogLevel {
  const m = LEVEL_RE.exec(plain.length > 200 ? plain.slice(0, 200) : plain);
  return m ? LEVEL_OF[m[1].toLowerCase()] ?? 'other' : 'other';
}

export type LogQuery = {
  raw: string;
  isEmpty: boolean;
  invalid: boolean;
  includes: string[];
  excludes: string[];
  regexes: RegExp[];
  negRegexes: RegExp[];
  hlRegexes: RegExp[];
};

export const EMPTY_QUERY: LogQuery = {
  raw: '', isEmpty: true, invalid: false,
  includes: [], excludes: [], regexes: [], negRegexes: [], hlRegexes: [],
};

function tokenize(raw: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) quote = null;
      else buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ' ' || ch === '\t') {
      if (buf) { out.push(buf); buf = ''; }
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

function asRegex(body: string): RegExp | null {
  const last = body.lastIndexOf('/');
  const source = body.slice(1, last);
  const flags = body.slice(last + 1);
  try {
    return new RegExp(source, flags.includes('i') ? flags : flags + 'i');
  } catch {
    return null;
  }
}

const isRegexToken = (t: string) => t.length > 2 && t.startsWith('/') && t.lastIndexOf('/') > 0;

export function parseQuery(raw: string): LogQuery {
  const trimmed = raw.trim();
  if (!trimmed) return EMPTY_QUERY;

  const q: LogQuery = {
    raw, isEmpty: false, invalid: false,
    includes: [], excludes: [], regexes: [], negRegexes: [], hlRegexes: [],
  };

  for (const token of tokenize(trimmed)) {
    const negated = token.startsWith('-') && token.length > 1;
    const body = negated ? token.slice(1) : token;
    if (!body) continue;

    if (isRegexToken(body)) {
      const re = asRegex(body);
      if (!re) { q.invalid = true; continue; }
      if (negated) q.negRegexes.push(re);
      else {
        q.regexes.push(re);
        q.hlRegexes.push(new RegExp(re.source, re.flags + 'g'));
      }
      continue;
    }

    if (negated) q.excludes.push(body.toLowerCase());
    else q.includes.push(body.toLowerCase());
  }

  q.isEmpty = !q.includes.length && !q.excludes.length && !q.regexes.length && !q.negRegexes.length;
  return q;
}

export function matchesQuery(q: LogQuery, lower: string, plain: string): boolean {
  for (let i = 0; i < q.includes.length; i++) {
    if (lower.indexOf(q.includes[i]) === -1) return false;
  }
  for (let i = 0; i < q.excludes.length; i++) {
    if (lower.indexOf(q.excludes[i]) !== -1) return false;
  }
  for (let i = 0; i < q.regexes.length; i++) {
    if (!q.regexes[i].test(plain)) return false;
  }
  for (let i = 0; i < q.negRegexes.length; i++) {
    if (q.negRegexes[i].test(plain)) return false;
  }
  return true;
}

export type Range = [number, number];

// Only ever called for rows currently on screen.
export function findMatchRanges(q: LogQuery, plain: string): Range[] {
  if (q.isEmpty) return [];
  const ranges: Range[] = [];
  const lower = plain.toLowerCase();

  for (const needle of q.includes) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;
      ranges.push([at, at + needle.length]);
      from = at + needle.length;
    }
  }

  for (const re of q.hlRegexes) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      ranges.push([m.index, m.index + m[0].length]);
    }
  }

  if (ranges.length < 2) return ranges;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    if (ranges[i][0] <= prev[1]) prev[1] = Math.max(prev[1], ranges[i][1]);
    else merged.push(ranges[i]);
  }
  return merged;
}
