import React from "react";

interface UseSidebarResizeProps {
  enableDrag?: boolean;
  onResize: (width: string) => void;
  onToggle: () => void;
  currentWidth: string;
  isCollapsed: boolean;
  minResizeWidth?: string;
  maxResizeWidth?: string;
  setIsDraggingRail: (isDraggingRail: boolean) => void;
}

function parseWidth(width: string): { value: number; unit: "rem" | "px" } {
  const unit = width.endsWith("rem") ? "rem" : "px";
  const value = Number.parseFloat(width);
  return { value, unit };
}

// Convert any width to pixels for calculations
function toPx(width: string): number {
  const { value, unit } = parseWidth(width);
  return unit === "rem" ? value * 16 : value;
}

function formatWidth(value: number, unit: "rem" | "px"): string {
  return `${unit === "rem" ? value.toFixed(1) : Math.round(value)}${unit}`;
}

const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar:width";
const SIDEBAR_WIDTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function useSidebarResize({
  enableDrag = true,
  onResize,
  onToggle,
  currentWidth,
  isCollapsed,
  minResizeWidth = "14rem",
  maxResizeWidth = "20rem",
  setIsDraggingRail,
}: UseSidebarResizeProps) {
  const dragRef = React.useRef<HTMLButtonElement>(null);
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const startWidth = React.useRef(0);
  const isInteractingWithRail = React.useRef(false);
  const lastWidth = React.useRef(0);
  const unitRef = React.useRef<"rem" | "px">("rem");
  const pendingWidthRef = React.useRef<string | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const autoCollapseThreshold = React.useRef(toPx(minResizeWidth) * 0.55); // 55% of min width

  // The drag-session listeners below are attached once (in handleMouseDown)
  // and read the latest props/callbacks through this ref, instead of being
  // torn down and re-attached to `document` on every width/prop change -
  // which previously happened on nearly every mousemove during a drag.
  const latest = React.useRef({ onResize, onToggle, isCollapsed, minResizeWidth, maxResizeWidth, setIsDraggingRail });
  React.useEffect(() => {
    latest.current = { onResize, onToggle, isCollapsed, minResizeWidth, maxResizeWidth, setIsDraggingRail };
  });

  const persistWidth = React.useCallback((width: string) => {
    document.cookie = `${SIDEBAR_WIDTH_COOKIE_NAME}=${width}; path=/; max-age=${SIDEBAR_WIDTH_COOKIE_MAX_AGE}`;
  }, []);

  const flushPendingWidth = React.useCallback(() => {
    rafRef.current = null;
    if (pendingWidthRef.current !== null) {
      latest.current.onResize(pendingWidthRef.current);
      pendingWidthRef.current = null;
    }
  }, []);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isInteractingWithRail.current || latest.current.isCollapsed) return;

    const deltaX = Math.abs(e.clientX - startX.current);
    if (!isDragging.current && deltaX > 5) {
      isDragging.current = true;
      latest.current.setIsDraggingRail(true);
    }

    if (!isDragging.current) return;

    const unit = unitRef.current;
    const minWidthPx = toPx(latest.current.minResizeWidth);
    const maxWidthPx = toPx(latest.current.maxResizeWidth);

    // Calculate new width in pixels
    const deltaWidth = e.clientX - startX.current;
    const newWidthPx = startWidth.current + deltaWidth;

    // Auto-collapse if dragged below threshold
    if (newWidthPx < autoCollapseThreshold.current && !latest.current.isCollapsed) {
      latest.current.onToggle();
      isDragging.current = false;
      isInteractingWithRail.current = false;
      latest.current.setIsDraggingRail(false);
      return;
    }

    // Rest of the existing width calculation logic
    const clampedWidthPx = Math.max(
      minWidthPx,
      Math.min(maxWidthPx, newWidthPx)
    );

    // Convert to the target unit if needed
    const newWidth = unit === "rem" ? clampedWidthPx / 16 : clampedWidthPx;

    // Use appropriate threshold based on unit
    const threshold = unit === "rem" ? 0.1 : 1;
    if (
      Math.abs(newWidth - lastWidth.current / (unit === "rem" ? 16 : 1)) >=
      threshold
    ) {
      lastWidth.current = clampedWidthPx; // Store in px for consistent comparisons
      pendingWidthRef.current = formatWidth(newWidth, unit);
      // Coalesce rapid mousemove events into at most one state update (and
      // one SidebarContext/consumer re-render) per animation frame, instead
      // of one per pixel moved.
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPendingWidth);
      }
    }
  }, [flushPendingWidth]);

  const handleMouseUp = React.useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    if (!isInteractingWithRail.current) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (isDragging.current) {
      // Persist once, at the end of the drag, instead of on every mousemove.
      const finalWidth = pendingWidthRef.current
        ?? formatWidth(lastWidth.current / (unitRef.current === "rem" ? 16 : 1), unitRef.current);
      if (pendingWidthRef.current !== null) {
        latest.current.onResize(pendingWidthRef.current);
        pendingWidthRef.current = null;
      }
      persistWidth(finalWidth);
    } else {
      latest.current.onToggle();
    }

    isDragging.current = false;
    isInteractingWithRail.current = false;
    lastWidth.current = 0;
    latest.current.setIsDraggingRail(false);
  }, [handleMouseMove, persistWidth]);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      isInteractingWithRail.current = true;
      // Attached only for the duration of this click/drag (removed in
      // handleMouseUp) instead of for the component's entire lifetime.
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      if (!enableDrag || isCollapsed) {
        return;
      }

      startWidth.current = toPx(currentWidth);
      startX.current = e.clientX;
      lastWidth.current = startWidth.current;
      unitRef.current = parseWidth(currentWidth).unit;

      e.preventDefault();
    },
    [enableDrag, isCollapsed, currentWidth, handleMouseMove, handleMouseUp]
  );

  // Safety net: don't leak document listeners or a pending rAF if the
  // component unmounts mid-drag.
  React.useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    dragRef,
    isDragging,
    handleMouseDown,
  };
}
