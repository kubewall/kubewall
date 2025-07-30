import '@xterm/xterm/css/xterm.css';

import { MutableRefObject, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChevronsDown } from 'lucide-react';
import { FitAddon } from '@xterm/addon-fit';

import { SearchAddon } from '@xterm/addon-search';
import { Terminal } from '@xterm/xterm';
import { clearLogs } from '@/data/Workloads/Pods/PodLogsSlice';
import { getSystemTheme } from '@/utils';
import { useAppDispatch } from '@/redux/hooks';

type XtermProp = {
  xterm: MutableRefObject<Terminal | null>
  searchAddonRef: MutableRefObject<SearchAddon | null>
  onInput?: (data: string) => void;
};

const XtermTerminal = ({ xterm, searchAddonRef, onInput }: XtermProp) => {
  const dispatch = useAppDispatch();
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const fitAddon = useRef<FitAddon | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const lastScrollCheck = useRef<number>(0);

  const scrollToBottom = () => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      xtermContainer.scrollTop = xtermContainer.scrollHeight;
    }
  };

  const checkScrollPosition = () => {
    const now = Date.now();
    // Debounce scroll checks to avoid excessive calls
    if (now - lastScrollCheck.current < 50) return;
    lastScrollCheck.current = now;
    
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      const { scrollTop, scrollHeight, clientHeight } = xtermContainer;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShowScrollDown(!atBottom);
    }
  };

  const darkTheme = {
    background: '#181818',        // Dark gray background
    foreground: '#dcdcdc',        // Light gray text
    cursor: '#dcdcdc',            // Light gray cursor
    selectionBackground: '#404040', // Darker gray for text selection
  };
  const lightTheme = {
    background: '#ffffff',        // White background for light theme
    foreground: '#333333',        // Dark text for readability
    cursor: '#333333',            // Dark cursor
    selectionBackground: '#bbbbbb', // Light gray for text selection
  };

  useEffect(() => {
    if (terminalRef.current && xterm) {
      xterm.current = new Terminal({
        cursorBlink: false,
        theme: getSystemTheme() === 'light' ? lightTheme : darkTheme,
        scrollback: 10000, // Keep reasonable scrollback to prevent memory issues
        fontSize: 13,
        // Enable proper terminal behavior
        allowTransparency: true,
        // Enable terminal control sequences
        convertEol: true,
        // Enable proper handling of control sequences
        windowsMode: true,
        // Performance optimizations
        fastScrollModifier: 'alt',
        fastScrollSensitivity: 1,
        // Disable some features for better performance
        macOptionIsMeta: false,
        macOptionClickForcesSelection: false,
        // Optimize for log viewing
        scrollSensitivity: 1,
        // Prevent buffer overflow
        cols: 120,
        rows: 30,
        // Disable cursor for better performance
        cursorStyle: 'block',
      });

      fitAddon.current = new FitAddon();
      searchAddonRef.current = new SearchAddon();
      xterm.current.loadAddon(fitAddon.current);
      xterm.current.loadAddon(searchAddonRef.current);
      xterm.current.open(terminalRef.current);

      // Add input handler for exec functionality
      if (onInput) {
        xterm.current.onData((data) => {
          onInput(data);
        });
      }

      // Fit the terminal to the container
      fitAddon.current.fit();

      // Resize the terminal on window resize
      const handleResize = () => fitAddon.current?.fit();
      window.addEventListener('resize', handleResize);
      
      // Add scroll listener
      const xtermContainer = document.querySelector('.xterm-viewport');
      if (xtermContainer) {
        xtermContainer.addEventListener('scroll', checkScrollPosition);
        // Initial check
        checkScrollPosition();
      }

      return () => {
        xterm.current?.dispose();
        window.removeEventListener('resize', handleResize);
        const xtermContainer = document.querySelector('.xterm-viewport');
        if (xtermContainer) {
          xtermContainer.removeEventListener('scroll', checkScrollPosition);
        }
        dispatch(clearLogs());
      };
    }
  }, []);

  return (
    <div className="w-full h-full relative">
      {showScrollDown && (
        <Button
          variant="default"
          size="icon"
          className="absolute bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg border-2 border-primary/20 hover:border-primary/40 transition-all duration-200"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <ChevronsDown className="h-5 w-5" />
        </Button>
      )}

      <div ref={terminalRef} />
    </div>
  );
};

export default XtermTerminal;