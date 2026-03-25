import { MutableRefObject, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { useWebSocket } from '@/components/app/Common/Hooks/useWebSocket';
import { useTheme } from '@/components/app/ThemeProvider';
import '@xterm/xterm/css/xterm.css';

type ExecTerminalProps = {
  namespace: string;
  pod: string;
  container: string;
  configName: string;
  clusterName: string;
  command?: string[];
  xtermRef: MutableRefObject<Terminal | null>;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
};

const ExecTerminal = ({
  namespace,
  pod,
  container,
  configName,
  clusterName,
  command = ['/bin/bash'],
  xtermRef,
  searchAddonRef,
}: ExecTerminalProps) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { isDark } = useTheme();
  const isConnectedRef = useRef(false);
  const dataBufferRef = useRef<Uint8Array[]>([]);
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Build WebSocket URL
  const wsUrl = `/api/v1/pods/${pod}/exec?namespace=${namespace}&container=${container}&config=${configName}&cluster=${clusterName}${command.map((c) => `&command=${encodeURIComponent(c)}`).join('')}`;

  // Send terminal resize to backend
  const sendResize = (cols: number, rows: number) => {
    if (xtermRef.current) {
      const resizeMsg = JSON.stringify({ cols, rows });
      try {
        // Use xterm's handler to get the WebSocket connection
        const ws = (xtermRef.current as any)._input?.handler?._webSocketHandler?._socket;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(resizeMsg);
        }
      } catch (e) {
        console.log('Sending resize:', cols, rows);
      }
    }
  };

  // Handle WebSocket messages
  const handleMessage = (data: string | ArrayBuffer) => {
    if (!xtermRef.current) return;

    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      if (bytes.length > 0) {
        // First byte is stream type: 0 = stdin, 1 = stdout, 2 = stderr
        const streamType = bytes[0];
        const content = bytes.slice(1);

        if (streamType === 1 || streamType === 2) {
          // stdout or stderr
          try {
            xtermRef.current.write(content);
          } catch (e) {
            // Terminal might be disposed, ignore
          }
        }
      }
    } else if (typeof data === 'string') {
      // Handle JSON error messages
      try {
        const msg = JSON.parse(data);
        if (msg.error) {
          xtermRef.current.writeln(`\r\n\x1b[31mError: ${msg.error}\x1b[0m\r\n`);
        }
      } catch {
        // Not JSON, write as text
        try {
          xtermRef.current.write(data);
        } catch (e) {
          // Terminal might be disposed, ignore
        }
      }
    }
  };

  const handleError = () => {
    if (xtermRef.current) {
      xtermRef.current.writeln('\r\n\x1b[31mConnection error\x1b[0m\r\n');
    }
    isConnectedRef.current = false;
  };

  const handleClose = () => {
    isConnectedRef.current = false;
  };

  const handleOpen = () => {
    isConnectedRef.current = true;
    // Flush any buffered data
    if (xtermRef.current && dataBufferRef.current.length > 0) {
      dataBufferRef.current.forEach((data) => {
        sendRef.current(data);
      });
      dataBufferRef.current = [];
    }
  };

  const { send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onError: handleError,
    onClose: handleClose,
    onOpen: handleOpen,
  });

  const sendRef = useRef(send);

  // Keep send ref updated
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      theme: isDark ? darkTheme : lightTheme,
      scrollback: 1000,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true,
    });

    xtermRef.current = terminal;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddonRef.current);

    terminal.open(terminalRef.current);

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
      // Send initial terminal size
      const { cols, rows } = terminal;
      if (cols && rows) {
        sendResize(cols, rows);
      }
    });

    // Handle Tab key for shell completion - must use onKey to intercept before xterm
    terminal.onKey((e: { key: string; domEvent: KeyboardEvent }) => {
      // Handle Tab key for shell completion
      if (e.domEvent.key === 'Tab') {
        e.domEvent.preventDefault();
        e.domEvent.stopPropagation();
        // Send Tab character (ASCII 9) directly to the shell
        if (isConnectedRef.current) {
          const tabData = new Uint8Array([9]);
          sendRef.current(tabData.buffer);
        }
        return false;
      }
    });

    // Handle terminal input
    terminal.onData((data) => {
      if (isConnectedRef.current) {
        // Send keystrokes to the server
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        sendRef.current(bytes.buffer);
      }
    });

    // Handle terminal resize - send size to backend for PTY
    terminal.onResize(({ cols, rows }) => {
      // Debounce resize events
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        sendResize(cols, rows);
      }, 100);
    });

    // Handle window resize
    const handleResize = () => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          // Resize event will be triggered by fitAddon, which will send the resize
        } catch (e) {
          // Ignore fit errors during resize
        }
      });
    };

    window.addEventListener('resize', handleResize);

    // Also trigger resize when dialog becomes visible
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore fit errors
        }
      });
    });

    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }

    // Cleanup
    return () => {
      terminal.dispose();
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      isConnectedRef.current = false;
    };
  }, []);

  // Update theme when it changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  return <div ref={terminalRef} className="w-full h-full" />;
};

export default ExecTerminal;
