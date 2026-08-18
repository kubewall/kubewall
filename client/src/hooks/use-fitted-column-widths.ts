import { AccessorFn, Column } from '@tanstack/react-table';
import { useMemo } from 'react';

// Sizes a column to its longest value across the *entire* list rather than letting
// it truncate at a static width. It has to be the whole list, not just the rows the
// virtualizer currently has mounted, otherwise the width would shift every time a
// longer value scrolled into view.
//
// Measuring in the DOM would cost a layout pass per row (seconds of jank on a
// 10k-pod list), so widths come from a canvas 2d context instead: no layout, no
// reflow, and each distinct string is measured only once thanks to the cache in
// createMeasurer. Live tables re-run this on every SSE update, and those updates
// overwhelmingly carry values we've already measured, so the steady-state cost is
// one Map lookup per row - fast enough to stay in a single frame even for very
// large lists.

// Name and Namespace are identifiers: truncated, they stop being the one thing they
// exist to convey ("nginx-deployment-7d9..." tells you nothing about which pod).
// Both also render through the same cell shape, so they share the padding below.
const FITTED_COLUMN_IDS = ['Name', 'Namespace'];

// The class the cell's text renders with, and so the font these widths are measured
// in (see NameCell / DefaultCell).
const CELL_TEXT_CLASS = 'text-sm';

// Clears the widest sortable header these columns can have: th `px-2` (16) + button
// `px-1` (8) + `gap-2` before the caret (8) + the caret itself (16) leave ~102px for
// a text-xs title, and "Namespace" needs ~60px of that.
const MIN_FITTED_COLUMN_WIDTH = 150;
// A name can legally be 253 characters; past this it would push every other column
// off-screen, so it stays truncated (with its tooltip) instead.
const MAX_FITTED_COLUMN_WIDTH = 720;
// td `p-2` (8 + 8) + the cell's own `px-3` (12 + 12), plus a subpixel guard.
const CELL_HORIZONTAL_SPACE = 40 + 2;
// Values churn as resources come and go, so each measurer's cache is bounded. It's
// kept in two generations rather than cleared outright: clearing would re-measure
// the whole list on the very next update whenever the live set of values sits near
// the limit, turning a sub-millisecond pass into a few hundred milliseconds. Handing
// the full generation off to `previous` keeps those widths readable for one more
// cycle, so a stable set of values never pays to be measured twice.
const WIDTH_CACHE_LIMIT = 50000;

type Measurer = (value: string) => number;

function createMeasurer(className: string): Measurer | null {
  const context = document.createElement('canvas').getContext('2d');
  // No canvas (jsdom, exotic browsers) - callers fall back to the static width.
  if (!context) return null;

  // Read the font off a throwaway element carrying the same class the cell renders
  // with, so measurements track the theme instead of a hardcoded stack.
  const probe = document.createElement('span');
  probe.className = className;
  probe.style.cssText = 'position:fixed;visibility:hidden';
  document.body.appendChild(probe);
  const { fontStyle, fontWeight, fontSize, fontFamily } = getComputedStyle(probe);
  probe.remove();
  context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;

  let cache = new Map<string, number>();
  let previousCache = new Map<string, number>();

  return (value: string) => {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;

    const width = previousCache.get(value) ?? context.measureText(value).width;
    if (cache.size >= WIDTH_CACHE_LIMIT) {
      previousCache = cache;
      cache = new Map();
    }
    cache.set(value, width);
    return width;
  };
}

const measurers = new Map<string, Measurer | null>();

function getMeasurer(className: string) {
  let measurer = measurers.get(className);
  if (measurer === undefined) {
    measurer = createMeasurer(className);
    measurers.set(className, measurer);
  }
  return measurer;
}

/**
 * Widths (in px) keyed by column id, for the columns that fit their content. A
 * column is left out when there is nothing to measure - it isn't one of the fitted
 * columns, or every value is empty (the loading skeleton, say) - in which case the
 * caller keeps the column's static width.
 */
export function useFittedColumnWidths<TData>(
  data: TData[],
  columns: Column<TData, unknown>[]
): Record<string, number> {
  return useMemo(() => {
    const fittedWidths: Record<string, number> = {};

    const measure = getMeasurer(CELL_TEXT_CLASS);
    if (!measure) return fittedWidths;

    const fittedColumns: { id: string; accessorFn: AccessorFn<TData, unknown> }[] = [];
    for (const column of columns) {
      if (column.accessorFn && FITTED_COLUMN_IDS.includes(column.id)) {
        fittedColumns.push({ id: column.id, accessorFn: column.accessorFn });
      }
    }
    if (fittedColumns.length === 0) return fittedWidths;

    // One pass over the rows for all of them, since reaching the row is the part
    // that scales with list size.
    const widest = new Array<number>(fittedColumns.length).fill(0);
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      for (let i = 0; i < fittedColumns.length; i++) {
        const value = fittedColumns[i].accessorFn(row, rowIndex);
        if (value === undefined || value === null || value === '') continue;
        const width = measure(typeof value === 'string' ? value : String(value));
        if (width > widest[i]) widest[i] = width;
      }
    }

    for (let i = 0; i < fittedColumns.length; i++) {
      if (widest[i] === 0) continue;
      fittedWidths[fittedColumns[i].id] = Math.min(
        Math.max(Math.ceil(widest[i]) + CELL_HORIZONTAL_SPACE, MIN_FITTED_COLUMN_WIDTH),
        MAX_FITTED_COLUMN_WIDTH
      );
    }
    return fittedWidths;
  }, [data, columns]);
}
