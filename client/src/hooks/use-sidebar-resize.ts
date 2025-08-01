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
  const lastLoggedWidth = React.useRef(0);
  const autoCollapseThreshold = React.useRef(toPx(minResizeWidth) * 0.55); // 55% of min width

  const persistWidth = React.useCallback((width: string) => {
    document.cookie = `${SIDEBAR_WIDTH_COOKIE_NAME}=${width}; path=/; max-age=${SIDEBAR_WIDTH_COOKIE_MAX_AGE}`;
  }, []);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      isInteractingWithRail.current = true;

      if (!enableDrag || isCollapsed) {
        // // console.log("[Rail] Click only mode - collapsed or drag disabled");
        return;
      }

      startWidth.current = toPx(currentWidth);
      startX.current = e.clientX;
      lastWidth.current = startWidth.current;
      lastLoggedWidth.current = startWidth.current;

      // // console.log(`[Rail] Started at ${currentWidth}`);
      e.preventDefault();
    },
    [enableDrag, isCollapsed, currentWidth]
  );

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isInteractingWithRail.current || isCollapsed) return;

      const deltaX = Math.abs(e.clientX - startX.current);
      if (!isDragging.current && deltaX > 5) {
        isDragging.current = true;
        // // console.log("[Rail] Started dragging");
        setIsDraggingRail(true);
      }

      if (isDragging.current) {
        const { unit } = parseWidth(currentWidth);
        const minWidthPx = toPx(minResizeWidth);
        const maxWidthPx = toPx(maxResizeWidth);

        // Calculate new width in pixels
        const deltaWidth = e.clientX - startX.current;
        const newWidthPx = startWidth.current + deltaWidth;

        // Auto-collapse if dragged below threshold
        if (newWidthPx < autoCollapseThreshold.current && !isCollapsed) {
          onToggle();
          isDragging.current = false;
          isInteractingWithRail.current = false;
          setIsDraggingRail(false);
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
          const formattedWidth = formatWidth(newWidth, unit);
          onResize(formattedWidth);
          persistWidth(formattedWidth); // Store width in cookie when it changes
          lastWidth.current = clampedWidthPx; // Store in px for consistent comparisons

          // Log on larger changes
          const logThreshold = unit === "rem" ? 1 : 16;
          if (
            Math.abs(
              newWidth - lastLoggedWidth.current / (unit === "rem" ? 16 : 1)
            ) >= logThreshold
          ) {
            // // console.log(`[Rail] Width: ${formattedWidth}`);
            lastLoggedWidth.current = clampedWidthPx;
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (!isInteractingWithRail.current) return;

      if (!isDragging.current) {
        onToggle();
      }

      isDragging.current = false;
      isInteractingWithRail.current = false;
      lastWidth.current = 0;
      lastLoggedWidth.current = 0;
      setIsDraggingRail(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    onResize,
    onToggle,
    isCollapsed,
    currentWidth,
    minResizeWidth,
    maxResizeWidth,
    persistWidth,
    setIsDraggingRail,
  ]);

  return {
    dragRef,
    isDragging,
    handleMouseDown,
  };
}
