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
  xterm: MutableRefObject<Terminal | null>
  searchAddonRef: MutableRefObject<SearchAddon | null>
};

const XtermTerminal = ({ containerNameProp, xterm, searchAddonRef, updateLogs }: XtermProp) => {
  const dispatch = useAppDispatch();
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fitAddon = useRef<FitAddon | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const { isDark } = useTheme();

  const darkTheme = {
    background: '#181818',
    foreground: '#dcdcdc',
    cursor: '#dcdcdc',
    selectionBackground: '#404040',
  };
  const lightTheme = {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#333333',
    selectionBackground: '#bbbbbb',
  };

  useEffect(() => {
    if (xterm.current) {
      xterm.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  useEffect(() => {
    const newContainer = `-------------------${containerNameProp || 'All Containers'}-------------------`;
    xterm?.current?.writeln(newContainer);
    updateLogs({log: newContainer} as PodSocketResponse);
  }, [containerNameProp]);

  const scrollToBottom = () => {
    if (xterm.current) {
      xterm.current.scrollToBottom();
    }
  };

  useEffect(() => {
    if (terminalRef.current && xterm) {
      xterm.current = new Terminal({
        cursorBlink: false,
        theme: isDark ? darkTheme : lightTheme,
        scrollback: 9999999,
        fontSize: 13
      });

      fitAddon.current = new FitAddon();
      searchAddonRef.current = new SearchAddon();
      xterm.current.loadAddon(fitAddon.current);
      xterm.current.loadAddon(searchAddonRef.current);
      xterm.current.open(terminalRef.current);

      // Defer initial fit to ensure the DOM has layout dimensions
      const safeFit = () => {
        try {
          if (fitAddon.current && xterm.current) {
            fitAddon.current.fit();
          }
        } catch (_) {
          // ignore fit errors when terminal is not yet fully rendered
        }
      };

      requestAnimationFrame(safeFit);

      // Resize the terminal on window resize
      const handleResize = () => safeFit();
      window.addEventListener('resize', handleResize);

      // Add ResizeObserver to handle container resize (for Resizable component)
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(safeFit);
      });
      
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // Store reference to the xterm container for proper cleanup
      const xtermContainer = document.querySelector('.xterm-viewport') as HTMLElement;

      const checkIfBottom = () => {
        if (xtermContainer && xtermContainer.clientHeight + xtermContainer.scrollTop < xtermContainer.scrollHeight) {
          setShowScrollDown(true);
        } else {
          setShowScrollDown(false);
        }
      };

      // Only add event listener if container exists
      if (xtermContainer) {
        xtermContainer.addEventListener('scroll', checkIfBottom);
      }
      
      return () => {
        xterm.current?.dispose();
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        // Use the stored reference for cleanup to ensure we remove from the correct element
        if (xtermContainer) {
          xtermContainer.removeEventListener('scroll', checkIfBottom);
        }
        dispatch(clearLogs());
      };
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {
        showScrollDown &&
        <Button
          variant="secondary"
          size="icon"
          className='absolute bottom-10 right-0 mt-1 mr-2 rounded z-10 border'
          onClick={scrollToBottom}
        >  <ChevronsDown className="h-4 w-4" />
        </Button>
      }

      <div ref={terminalRef} />
    </div>
  );
};

export default XtermTerminal;