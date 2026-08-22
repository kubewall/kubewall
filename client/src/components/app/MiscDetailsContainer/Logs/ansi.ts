import Anser from 'anser';

import { Range } from './logFilter';

export type AnsiSpan = {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

/* eslint-disable no-control-regex */
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const ESC = '\x1b';
/* eslint-enable no-control-regex */

export const hasAnsi = (input: string) => input.indexOf(ESC) !== -1;

export function stripAnsi(input: string): string {
  return hasAnsi(input) ? input.replace(ANSI_RE, '') : input;
}

// Same 16 colours the xterm logs view used, so output is visually unchanged.
const DARK_16 = [
  '#1e1e1e', '#f44747', '#4ec9b0', '#dcdcaa', '#569cd6', '#c586c0', '#4fc1ff', '#d4d4d4',
  '#555555', '#f44747', '#4ec9b0', '#dcdcaa', '#9cdcfe', '#c586c0', '#4fc1ff', '#ffffff',
];
const LIGHT_16 = [
  '#000000', '#cd3131', '#107c10', '#795e26', '#0451a5', '#af00db', '#0070c1', '#3b3b3b',
  '#767676', '#cd3131', '#107c10', '#795e26', '#0451a5', '#af00db', '#0070c1', '#1e1e1e',
];

const CLASS_TO_INDEX: Record<string, number> = {
  'ansi-black': 0, 'ansi-red': 1, 'ansi-green': 2, 'ansi-yellow': 3,
  'ansi-blue': 4, 'ansi-magenta': 5, 'ansi-cyan': 6, 'ansi-white': 7,
  'ansi-bright-black': 8, 'ansi-bright-red': 9, 'ansi-bright-green': 10,
  'ansi-bright-yellow': 11, 'ansi-bright-blue': 12, 'ansi-bright-magenta': 13,
  'ansi-bright-cyan': 14, 'ansi-bright-white': 15,
};

const CUBE = [0, 95, 135, 175, 215, 255];

function palette256(n: number, dark: boolean): string {
  if (n < 16) return (dark ? DARK_16 : LIGHT_16)[n];
  if (n < 232) {
    const i = n - 16;
    return `rgb(${CUBE[Math.floor(i / 36) % 6]},${CUBE[Math.floor(i / 6) % 6]},${CUBE[i % 6]})`;
  }
  const v = 8 + (n - 232) * 10;
  return `rgb(${v},${v},${v})`;
}

function resolveColor(cls: string | null, truecolor: string | null, dark: boolean): string | undefined {
  if (!cls) return undefined;
  if (cls === 'ansi-truecolor') {
    // Only trustworthy when this span actually declared a truecolor: anser
    // keeps the previous value in fg_truecolor/bg_truecolor otherwise.
    return truecolor ? `rgb(${truecolor})` : undefined;
  }
  if (cls.startsWith('ansi-palette-')) {
    const n = Number(cls.slice(13));
    return Number.isFinite(n) ? palette256(n, dark) : undefined;
  }
  const idx = CLASS_TO_INDEX[cls];
  return idx === undefined ? undefined : (dark ? DARK_16 : LIGHT_16)[idx];
}

// anser emits isInverted at runtime but omits it from its published types.
type AnserChunk = ReturnType<typeof Anser.ansiToJson>[number] & { isInverted?: boolean };

const MAX_CACHE = 20000;
// Two generations instead of one: when the young map fills it becomes the old
// map rather than being dropped, so a working set larger than MAX_CACHE still
// gets hits instead of thrashing.
let young = new Map<string, AnsiSpan[]>();
let old = new Map<string, AnsiSpan[]>();
let cacheDark: boolean | null = null;

export function clearAnsiCache() {
  young = new Map();
  old = new Map();
  cacheDark = null;
}

export function parseAnsi(raw: string, dark: boolean): AnsiSpan[] {
  if (cacheDark !== dark) {
    young = new Map();
    old = new Map();
    cacheDark = dark;
  }
  const hit = young.get(raw) ?? old.get(raw);
  if (hit) {
    if (!young.has(raw)) young.set(raw, hit);
    return hit;
  }

  let spans: AnsiSpan[];
  if (!hasAnsi(raw)) {
    spans = [{ text: raw }];
  } else {
    spans = (Anser.ansiToJson(raw, { use_classes: true, remove_empty: true }) as AnserChunk[]).map((chunk) => {
      const d = chunk.decorations || [];
      let fg = resolveColor(chunk.fg, chunk.fg_truecolor, dark);
      let bg = resolveColor(chunk.bg, chunk.bg_truecolor, dark);
      if (chunk.isInverted) {
        const swap = fg;
        fg = bg ?? (dark ? DARK_16[0] : LIGHT_16[0]);
        bg = swap ?? (dark ? DARK_16[15] : LIGHT_16[15]);
      }
      return {
        text: chunk.content,
        fg,
        bg,
        bold: d.includes('bold') || undefined,
        dim: d.includes('dim') || undefined,
        italic: d.includes('italic') || undefined,
        underline: d.includes('underline') || undefined,
        strike: d.includes('strikethrough') || undefined,
      };
    });
  }

  if (young.size >= MAX_CACHE) {
    old = young;
    young = new Map();
  }
  young.set(raw, spans);
  return spans;
}

export type Piece = { text: string; span: AnsiSpan; hl: boolean };

export function splitSpans(spans: AnsiSpan[], ranges: Range[]): Piece[] {
  if (!ranges.length) return spans.map((span) => ({ text: span.text, span, hl: false }));

  const pieces: Piece[] = [];
  let offset = 0;
  let ri = 0;

  for (const span of spans) {
    const len = span.text.length;
    let start = 0;
    while (start < len) {
      const abs = offset + start;
      while (ri < ranges.length && ranges[ri][1] <= abs) ri++;
      const r = ranges[ri];
      if (!r || r[0] >= offset + len) {
        pieces.push({ text: span.text.slice(start), span, hl: false });
        break;
      }
      if (r[0] > abs) {
        const cut = r[0] - offset;
        pieces.push({ text: span.text.slice(start, cut), span, hl: false });
        start = cut;
        continue;
      }
      const end = Math.min(r[1] - offset, len);
      pieces.push({ text: span.text.slice(start, end), span, hl: true });
      start = end;
    }
    offset += len;
  }
  return pieces;
}
