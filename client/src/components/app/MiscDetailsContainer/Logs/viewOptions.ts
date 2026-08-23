export type TimestampMode = 'off' | 'utc' | 'local' | 'relative';
export type FontSizeOption = 'small' | 'default' | 'large';

type FontMetrics = {
  /** font-size + line-height for the scroll container (rows inherit it) */
  containerClass: string;
  tsFontClass: string;
  leadingClass: string;
  lineHeight: number;
};

// Class strings are written out in full so Tailwind's scanner picks them up.
export const FONT_METRICS: Record<FontSizeOption, FontMetrics> = {
  small: {
    containerClass: 'text-[11px] leading-[18px]',
    tsFontClass: 'text-[10px]',
    leadingClass: 'leading-[18px]',
    lineHeight: 18,
  },
  default: {
    containerClass: 'text-[12px] leading-[20px]',
    tsFontClass: 'text-[11px]',
    leadingClass: 'leading-[20px]',
    lineHeight: 20,
  },
  large: {
    containerClass: 'text-[14px] leading-[22px]',
    tsFontClass: 'text-[13px]',
    leadingClass: 'leading-[22px]',
    lineHeight: 22,
  },
};

/** py-px on the row: 1px top + 1px bottom. */
const ROW_PADDING_Y = 2;

/** Full vertical slot a single-line row occupies. */
export const rowPitch = (font: FontSizeOption) =>
  FONT_METRICS[font].lineHeight + ROW_PADDING_Y;

/** Backend sends "2026-08-22 12:29:09.995Z"; normalise the space for Date. */
const parseTs = (raw: string) => new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));

/** Character width of the timestamp column for each mode. */
export const tsColumnCh = (mode: TimestampMode) =>
  mode === 'relative' ? 10 : 21;

export function formatRelative(raw: string, nowMs: number): string {
  if (!raw) return '';
  const t = parseTs(raw).getTime();
  if (Number.isNaN(t)) return raw;
  const secs = Math.max(0, Math.round((nowMs - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number, len = 2) => String(n).padStart(len, '0');

const MAX_TS_CACHE = 20000;
let tsCache = new Map<string, { short: string; full: string }>();

export function formatTimestamp(raw: string, mode: 'utc' | 'local'): { short: string; full: string } {
  if (!raw) return { short: '', full: '' };
  const key = `${mode}|${raw}`;
  const hit = tsCache.get(key);
  if (hit) return hit;

  const d = parseTs(raw);
  let out: { short: string; full: string };
  if (Number.isNaN(d.getTime())) {
    out = { short: raw, full: raw };
  } else {
    const utc = mode === 'utc';
    const month = MONTHS[utc ? d.getUTCMonth() : d.getMonth()];
    const day = pad(utc ? d.getUTCDate() : d.getDate());
    const year = utc ? d.getUTCFullYear() : d.getFullYear();
    const time =
      `${pad(utc ? d.getUTCHours() : d.getHours())}:` +
      `${pad(utc ? d.getUTCMinutes() : d.getMinutes())}:` +
      `${pad(utc ? d.getUTCSeconds() : d.getSeconds())}.` +
      `${pad(utc ? d.getUTCMilliseconds() : d.getMilliseconds(), 3)}`;
    const zone = utc ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone;
    out = { short: `${month} ${day} ${time}`, full: `${month} ${day}, ${year} ${time} ${zone}` };
  }

  if (tsCache.size >= MAX_TS_CACHE) tsCache = new Map();
  tsCache.set(key, out);
  return out;
}
