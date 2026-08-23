import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type TruncatedTextProps = {
  value: string;
  className?: string;
};

// Renders text that may overflow with `...` and attaches a Tooltip carrying
// the full value ONLY when it's actually clipped — a tooltip that just
// repeats fully-visible text is noise.
export function TruncatedText({ value, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    // The clip point moves with column/card width, not just the text.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, value]);

  const text = <span ref={ref} className={className}>{value}</span>;

  if (!isTruncated) {
    return text;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{text}</TooltipTrigger>
        <TooltipContent className="max-w-sm break-all">{value}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
