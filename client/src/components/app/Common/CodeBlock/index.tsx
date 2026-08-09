import { memo, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { colorizeLines } from './colorizer';
import { useTheme } from "@/components/app/ThemeProvider";

type CodeBlockProps = {
  value: string;
  /** ConfigMap/Secret key - used to guess the language from its extension. */
  fileName?: string;
  className?: string;
};

const CodeBlock = memo(function ({ value, fileName, className }: CodeBlockProps) {
  const { monacoTheme } = useTheme();
  const [colorized, setColorized] = useState<string[] | null>(null);

  // A single trailing newline is a file convention, not a real last line.
  const lines = useMemo(() => value.replace(/\n$/, '').split('\n'), [value]);

  useEffect(() => {
    let mounted = true;
    // Re-runs on theme changes too: monaco's `.mtkN` classes are reused across
    // themes with different colours behind them, so the markup has to be
    // regenerated rather than just restyled.
    colorizeLines(lines.join('\n'), monacoTheme, fileName)
      .then((result) => mounted && setColorized(result))
      // Colourising is cosmetic - if monaco fails to load the plain text stays.
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [lines, fileName, monacoTheme]);

  // Guards the render while a newly changed value is still being colourised,
  // so line numbers can never drift from the content beside them.
  const colorizedLines = colorized?.length === lines.length ? colorized : null;
  const showLineNumbers = lines.length > 1;
  // Keep the gutter wide enough for the largest line number, padding included.
  const gutterWidth = `calc(${String(lines.length).length}ch + 1.25rem)`;
  const contentClassName = cn("whitespace-pre-wrap break-all pr-2.5", !showLineNumbers && "pl-2.5");

  return (
    <div
      className={cn(
        "inline-block min-w-0 max-w-full rounded-md bg-secondary py-0.5 font-mono text-[13px] text-secondary-foreground",
        className
      )}
    >
      {
        lines.map((line, index) => (
          <div key={index} className="flex flex-row leading-5 min-h-[1.25rem]">
            {
              showLineNumbers &&
              <span
                className="shrink-0 select-none px-2.5 text-right tabular-nums text-muted-foreground"
                style={{ width: gutterWidth }}
              >
                {index + 1}
              </span>
            }
            {
              colorizedLines
                // monaco escapes the source text, so its markup is safe to inject.
                ? <span className={contentClassName} dangerouslySetInnerHTML={{ __html: colorizedLines[index] }} />
                : <span className={contentClassName}>{line}</span>
            }
          </div>
        ))
      }
    </div>
  );
});

export {
  CodeBlock
};
