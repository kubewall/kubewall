import '@xterm/xterm/css/xterm.css';

import { MutableRefObject, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChevronsDown } from 'lucide-react';
import { FitAddon } from '@xterm/addon-fit';
import { PodSocketResponse } from '@/types';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal } from '@xterm/xterm';
import { clearLogs } from '@/data/Workloads/Pods/PodLogsSlice';
import { getSystemTheme } from '@/utils';
import { useAppDispatch } from '@/redux/hooks';

type XtermProp = {
  containerNameProp: string;
  updateLogs: (currentLog: PodSocketResponse) => void;
  xterm: MutableRefObject<Terminal | null>
  searchAddonRef: MutableRefObject<SearchAddon | null>
};

const XtermTerminal = ({ containerNameProp, xterm, searchAddonRef,updateLogs }: XtermProp) => {
  const dispatch = useAppDispatch();
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const fitAddon = useRef<FitAddon | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  useEffect(() => {
    const newContainer = `-------------------${containerNameProp || 'All Containers'}-------------------`;
    xterm?.current?.writeln(newContainer);
    updateLogs({log: newContainer} as PodSocketResponse);
  },[containerNameProp]);
  const scrollToBottom = () => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      xtermContainer.scrollTop = xtermContainer.scrollHeight;
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
        scrollback: 9999999
      });

      fitAddon.current = new FitAddon();
      searchAddonRef.current = new SearchAddon();
      xterm.current.loadAddon(fitAddon.current);
      xterm.current.loadAddon(searchAddonRef.current);
      xterm.current.open(terminalRef.current);

      // Fit the terminal to the container
      fitAddon.current.fit();

      // Resize the terminal on window resize
      const handleResize = () => fitAddon.current?.fit();
      window.addEventListener('resize', handleResize);
      const xtermContainer = document.querySelector('.xterm-viewport');

      const checkIfBottom = () => {
        const xtermContainer = document.querySelector('.xterm-viewport');
        if(xtermContainer && xtermContainer?.clientHeight + xtermContainer?.scrollTop < xtermContainer.scrollHeight) {
          setShowScrollDown(true);
        } else {
          setShowScrollDown(false);
        }
      };
      xtermContainer?.addEventListener('scroll', checkIfBottom);
      return () => {
        xterm.current?.dispose();
        window.removeEventListener('resize', handleResize);
        xtermContainer?.removeEventListener('scroll', checkIfBottom);

        dispatch(clearLogs());
      };
    }
  }, []);

  return (
    <div className="w-full h-full">
      {
        showScrollDown &&
        <Button
          variant="default"
          size="icon"
          className='absolute bottom-7 right-0 mt-1 mr-9 rounded z-10 border'
          onClick={scrollToBottom}
        >  <ChevronsDown className="h-4 w-4" />
        </Button>
      }

      <div ref={terminalRef} />
    </div>
  );
};

export default XtermTerminal;