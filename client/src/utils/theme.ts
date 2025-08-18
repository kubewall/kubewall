type Mode = 'light' | 'dark';

export type ThemeExtras = Record<string, string>; // name -> hex color (e.g., "accent": "#FF00AA")

export type ThemeColors = {
  primary: string; // hex
  secondary: string; // hex
  background?: string; // hex (page background)
  extras?: ThemeExtras; // additional named colors
};

export type ThemePalette = {
  light: ThemeColors;
  dark: ThemeColors;
};

const STORAGE_KEY = 'kw-ui-theme-colors';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^([\da-f]{3}|[\da-f]{6})$/i.test(normalized)) return null;
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

export function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rNorm:
        h = 60 * (((gNorm - bNorm) / delta) % 6);
        break;
      case gNorm:
        h = 60 * ((bNorm - rNorm) / delta + 2);
        break;
      case bNorm:
        h = 60 * ((rNorm - gNorm) / delta + 4);
        break;
    }
  }

  h = (h + 360) % 360;
  return { h, s, l };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb);
}

export function hslString(h: number, s: number, l: number): string {
  // Tailwind expects space-delimited H S% L%
  return `${clamp(h, 0, 360).toFixed(1)} ${clamp(s * 100, 0, 100).toFixed(1)}% ${clamp(l * 100, 0, 100).toFixed(1)}%`;
}

// WCAG relative luminance and contrast helpers
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const srgb = [r, g, b].map((c) => c / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(l1: number, l2: number): number {
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

export function bestForegroundFor(hexBackground: string): '#000000' | '#FFFFFF' {
  const rgb = hexToRgb(hexBackground) ?? { r: 0, g: 0, b: 0 };
  const bgLum = relativeLuminance(rgb);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const cWhite = contrastRatio(bgLum, relativeLuminance(white));
  const cBlack = contrastRatio(bgLum, relativeLuminance(black));
  return cWhite >= cBlack ? '#FFFFFF' : '#000000';
}

function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function applyCoreVarsForMode(mode: Mode, colors: ThemeColors) {
  const primaryHsl = hexToHsl(colors.primary);
  const secondaryHsl = hexToHsl(colors.secondary);
  if (primaryHsl) setCssVar(`--kw-primary-${mode}`, hslString(primaryHsl.h, primaryHsl.s, primaryHsl.l));
  if (secondaryHsl) setCssVar(`--kw-secondary-${mode}`, hslString(secondaryHsl.h, secondaryHsl.s, secondaryHsl.l));

  const primaryFg = bestForegroundFor(colors.primary);
  const secondaryFg = bestForegroundFor(colors.secondary);
  const primaryFgHsl = hexToHsl(primaryFg);
  const secondaryFgHsl = hexToHsl(secondaryFg);
  if (primaryFgHsl) setCssVar(`--kw-primary-foreground-${mode}`, hslString(primaryFgHsl.h, primaryFgHsl.s, primaryFgHsl.l));
  if (secondaryFgHsl) setCssVar(`--kw-secondary-foreground-${mode}`, hslString(secondaryFgHsl.h, secondaryFgHsl.s, secondaryFgHsl.l));

  // background and its contrasting foreground
  if (colors.background) {
    const bgHsl = hexToHsl(colors.background);
    if (bgHsl) setCssVar(`--kw-background-${mode}`, hslString(bgHsl.h, bgHsl.s, bgHsl.l));
    const bgFg = bestForegroundFor(colors.background);
    const bgFgHsl = hexToHsl(bgFg);
    if (bgFgHsl) setCssVar(`--kw-foreground-${mode}`, hslString(bgFgHsl.h, bgFgHsl.s, bgFgHsl.l));
  }

  // extras
  const extras = colors.extras || {};
  Object.entries(extras).forEach(([name, hex]) => {
    const hsl = hexToHsl(hex);
    if (hsl) setCssVar(`--kw-${name}-${mode}`, hslString(hsl.h, hsl.s, hsl.l));
    const fgHsl = hexToHsl(bestForegroundFor(hex));
    if (fgHsl) setCssVar(`--kw-${name}-foreground-${mode}`, hslString(fgHsl.h, fgHsl.s, fgHsl.l));
  });
}

export function applyThemePalette(palette: ThemePalette): void {
  applyCoreVarsForMode('light', palette.light);
  applyCoreVarsForMode('dark', palette.dark);
}

export function saveThemePalette(palette: ThemePalette): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
}

export function loadThemePalette(): ThemePalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ThemePalette;
    return parsed;
  } catch {
    return null;
  }
}

export function ensurePaletteWithDefaults(palette?: ThemePalette | null): ThemePalette {
  // Make Facets the default theme
  const defaults: ThemePalette = {
    light: {
      primary: '#645DF6',
      secondary: '#00C2BB',
      background: '#FFFFFF',
      extras: { accent: '#645DF6' }
    },
    dark: {
      primary: '#645DF6',
      secondary: '#00C2BB',
      background: '#0d1117',
      extras: { accent: '#645DF6' }
    }
  };
  if (!palette) return defaults;
  return {
    light: {
      primary: palette.light?.primary || defaults.light.primary,
      secondary: palette.light?.secondary || defaults.light.secondary,
      background: palette.light?.background || defaults.light.background,
      extras: palette.light?.extras || undefined,
    },
    dark: {
      primary: palette.dark?.primary || defaults.dark.primary,
      secondary: palette.dark?.secondary || defaults.dark.secondary,
      background: palette.dark?.background || defaults.dark.background,
      extras: palette.dark?.extras || undefined,
    },
  };
}

export function applySavedThemePalette(): void {
  const palette = ensurePaletteWithDefaults(loadThemePalette());
  applyThemePalette(palette);
}

// Preset themes users can choose from
export const PRESET_THEMES: Record<string, ThemePalette> = {
  Dracula: ensurePaletteWithDefaults({
    light: { primary: '#BD93F9', secondary: '#50FA7B', background: '#FFFFFF', extras: { accent: '#FF79C6' } },
    dark: { primary: '#BD93F9', secondary: '#50FA7B', background: '#282A36', extras: { accent: '#FF79C6' } }
  }),
  Facets: {
    light: { primary: '#645DF6', secondary: '#00C2BB', background: '#FFFFFF', extras: { accent: '#645DF6' } },
    dark: { primary: '#645DF6', secondary: '#00C2BB', background: '#0d1117', extras: { accent: '#645DF6' } }
  },
  Nord: {
    light: { primary: '#5E81AC', secondary: '#A3BE8C', background: '#ECEFF4', extras: { accent: '#B48EAD' } },
    dark: { primary: '#81A1C1', secondary: '#A3BE8C', background: '#2E3440', extras: { accent: '#B48EAD' } }
  },
  Solarized: {
    light: { primary: '#268BD2', secondary: '#2AA198', background: '#FDF6E3', extras: { accent: '#D33682' } },
    dark: { primary: '#268BD2', secondary: '#2AA198', background: '#002B36', extras: { accent: '#D33682' } }
  }
};


