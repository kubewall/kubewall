import { useLayoutEffect, useRef, useState } from "react";

// Column widths are static now, so the only thing that can make a cell's
// text overflow is the value itself - re-checking on value change (rather
// than e.g. a ResizeObserver) is enough to stay correct as data streams in.
export function useIsTruncated<T extends HTMLElement>(value: unknown) {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    setIsTruncated(!!el && el.scrollWidth > el.clientWidth);
  }, [value]);

  return [ref, isTruncated] as const;
}
