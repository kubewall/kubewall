import '@xterm/xterm/css/xterm.css';

import { MutableRefObject, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChevronsDown } from 'lucide-react';
import { FitAddon } from '@xterm/addon-fit';
import { PodSocketResponse } from '@/types';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal } from '@xterm/xterm';
import { clearLogs } from '@/data/Workloads/Pods/PodLogsSlice';
import { useAppDispatch } from '@/redux/hooks';
import { useTheme } from '@/components/app/ThemeProvider';

type XtermProp = {
  containerNameProp: string;
  updateLogs: (currentLog: PodSocketResponse) => void;
  xterm: MutableRefObject<Terminal | null>;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
  onReady?: () => void;
};

const DARK_THEME = {
  background: '#0f0f0f',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#0f0f0f',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black: '#1e1e1e',
  brightBlack: '#555555',
  red: '#f44747',
  brightRed: '#f44747',
  green: '#4ec9b0',
  brightGreen: '#4ec9b0',
  yellow: '#dcdcaa',
  brightYellow: '#dcdcaa',
  blue: '#569cd6',
  brightBlue: '#9cdcfe',
  magenta: '#c586c0',
  brightMagenta: '#c586c0',
  cyan: '#4fc1ff',
  brightCyan: '#4fc1ff',
  white: '#d4d4d4',
  brightWhite: '#ffffff',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1e1e1e',
  cursor: '#1e1e1e',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  selectionForeground: '#000000',
  black: '#000000',
  brightBlack: '#767676',
  red: '#cd3131',
  brightRed: '#cd3131',
  green: '#107c10',
  brightGreen: '#107c10',
  yellow: '#795e26',
  brightYellow: '#795e26',
  blue: '#0451a5',
  brightBlue: '#0451a5',
  magenta: '#af00db',
  brightMagenta: '#af00db',
  cyan: '#0070c1',
  brightCyan: '#0070c1',
  white: '#3b3b3b',
  brightWhite: '#1e1e1e',
};

const XtermTerminal = ({ containerNameProp, xterm, searchAddonRef, updateLogs, onReady }: XtermProp) => {
  const dispatch = useAppDispatch();
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    if (xterm.current) {
      xterm.current.options.theme = isDark ? DARK_THEME : LIGHT_THEME;
    }
  }, [isDark]);

  useEffect(() => {
    const label = containerNameProp || 'All Containers';
    xterm?.current?.writeln(`\x1b[38;5;240m── ${label} ──\x1b[0m`);
    updateLogs({ log: label } as PodSocketResponse);
  }, [containerNameProp]);

  const scrollToBottom = () => xterm.current?.scrollToBottom();

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      cursorStyle: 'bar',
      theme: isDark ? DARK_THEME : LIGHT_THEME,
      scrollback: 50000,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      lineHeight: 1.5,
      letterSpacing: 0,
      allowTransparency: true,
      allowProposedApi: true,
      convertEol: true,
      disableStdin: true,
      rightClickSelectsWord: true,
    });

    const fit = new FitAddon();
    const search = new SearchAddon({ highlightLimit: 50000 });

    term.loadAddon(fit);
    term.loadAddon(search);
    term.open(terminalRef.current);

    xterm.current = term;
    fitAddon.current = fit;
    searchAddonRef.current = search;

    onReady?.();

    const safeFit = () => {
      try { fit.fit(); } catch (_) {}
    };

    requestAnimationFrame(safeFit);

    const handleResize = () => safeFit();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(safeFit));
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const viewport = terminalRef.current.querySelector('.xterm-viewport') as HTMLElement | null;
    const checkScroll = () => {
      if (viewport && viewport.clientHeight + viewport.scrollTop < viewport.scrollHeight - 4) {
        setShowScrollDown(true);
      } else {
        setShowScrollDown(false);
      }
    };
    viewport?.addEventListener('scroll', checkScroll, { passive: true });

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      viewport?.removeEventListener('scroll', checkScroll);
      dispatch(clearLogs());
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {showScrollDown && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-10 right-3 z-10 rounded border shadow-sm opacity-90 hover:opacity-100 bg-foreground text-background hover:bg-foreground/90"
          onClick={scrollToBottom}
        >
          <ChevronsDown className="h-4 w-4" />
        </Button>
      )}
      <div ref={terminalRef} className="h-full" />
    </div>
  );
};

export default XtermTerminal;
