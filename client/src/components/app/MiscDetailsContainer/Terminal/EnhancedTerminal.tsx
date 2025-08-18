import '@xterm/xterm/css/xterm.css';

import { MutableRefObject, useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronsDown, 
  Maximize2, 
  Minimize2, 
  Settings, 
  Copy,
  Search,
  X
} from 'lucide-react';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { getSystemTheme } from '@/utils';
import { useTheme } from '../../ThemeProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type EnhancedTerminalProps = {
  xterm: MutableRefObject<Terminal | null>;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
  onInput?: (data: string) => void;
  allowFullscreen?: boolean;
  initialRows?: number;
  initialCols?: number;
  enableWebGL?: boolean;
  className?: string;
};

const EnhancedTerminal = ({ 
  xterm, 
  searchAddonRef, 
  onInput,
  allowFullscreen = true,
  initialRows = 30,
  initialCols = 120,
  enableWebGL = true,
  className = ''
}: EnhancedTerminalProps) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const webglAddon = useRef<WebglAddon | null>(null);
  const webLinksAddon = useRef<WebLinksAddon | null>(null);
  
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(13);
  const [isWebGLEnabled, setIsWebGLEnabled] = useState(enableWebGL);
  const [currentTheme, setCurrentTheme] = useState(() => {
    const theme = getSystemTheme();
    return theme === 'vs-dark' ? 'dark' : 'light';
  });
  
  const lastScrollCheck = useRef<number>(0);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { theme } = useTheme();

  // Enhanced themes with better contrast and readability
  const darkTheme = {
    background: '#0d1117',        // GitHub dark background
    foreground: '#e6edf3',        // GitHub dark foreground
    cursor: '#645DF6',            // Facets primary
    cursorAccent: '#0d1117',      // Dark cursor accent
    selectionBackground: '#264f78', // VS Code selection blue
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#e6edf3',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc'
  };

  const lightTheme = {
    background: '#ffffff',        // Pure white background
    foreground: '#1f2328',        // GitHub light foreground
    cursor: '#645DF6',            // Facets primary
    cursorAccent: '#ffffff',      // White cursor accent
    selectionBackground: '#0969da', // GitHub blue selection
    black: '#1f2328',
    red: '#d1242f',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#656d76',
    brightRed: '#a40e26',
    brightGreen: '#0d5016',
    brightYellow: '#633c01',
    brightBlue: '#0550ae',
    brightMagenta: '#6639ba',
    brightCyan: '#1b7c83',
    brightWhite: '#1f2328'
  };

  const scrollToBottom = useCallback(() => {
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      xtermContainer.scrollTop = xtermContainer.scrollHeight;
    }
  }, []);

  const checkScrollPosition = useCallback(() => {
    const now = Date.now();
    // Debounce scroll checks to avoid excessive calls
    if (now - lastScrollCheck.current < 100) return;
    lastScrollCheck.current = now;
    
    const xtermContainer = document.querySelector('.xterm-viewport');
    if (xtermContainer) {
      const { scrollTop, scrollHeight, clientHeight } = xtermContainer;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShowScrollDown(!atBottom);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!allowFullscreen) return;
    
    setIsFullscreen(prev => {
      const newFullscreen = !prev;
      
      // Use requestAnimationFrame to ensure DOM updates before resize
      requestAnimationFrame(() => {
        setTimeout(() => {
          fitAddon.current?.fit();
        }, 100);
      });
      
      return newFullscreen;
    });
  }, [allowFullscreen]);

  const handleSearch = useCallback((term: string, forward: boolean = true) => {
    if (searchAddonRef.current && term) {
      if (forward) {
        searchAddonRef.current.findNext(term, { caseSensitive: false });
      } else {
        searchAddonRef.current.findPrevious(term, { caseSensitive: false });
      }
    }
  }, [searchAddonRef]);

  const copySelection = useCallback(() => {
    if (xterm.current) {
      const selection = xterm.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
  }, [xterm]);

  const changeFontSize = useCallback((newSize: number) => {
    if (xterm.current && newSize >= 8 && newSize <= 24) {
      setFontSize(newSize);
      xterm.current.options.fontSize = newSize;
      // Debounced resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        fitAddon.current?.fit();
      }, 150);
    }
  }, [xterm]);

  const toggleWebGL = useCallback(() => {
    if (!xterm.current) return;
    
    const newWebGLState = !isWebGLEnabled;
    setIsWebGLEnabled(newWebGLState);
    
    if (newWebGLState && !webglAddon.current) {
      // Enable WebGL
      try {
        webglAddon.current = new WebglAddon();
        xterm.current.loadAddon(webglAddon.current);
        
        // Handle WebGL context loss
        webglAddon.current.onContextLoss(() => {
          console.warn('WebGL context lost, falling back to canvas renderer');
          webglAddon.current?.dispose();
          webglAddon.current = null;
          setIsWebGLEnabled(false);
        });
      } catch (error) {
        console.warn('Failed to enable WebGL renderer:', error);
        setIsWebGLEnabled(false);
      }
    } else if (!newWebGLState && webglAddon.current) {
      // Disable WebGL
      webglAddon.current.dispose();
      webglAddon.current = null;
    }
  }, [isWebGLEnabled, xterm]);

  // Listen for theme changes and update terminal theme
  useEffect(() => {
    const updateTheme = () => {
      const systemTheme = getSystemTheme();
      const newTheme = systemTheme === 'vs-dark' ? 'dark' : 'light';
      setCurrentTheme(newTheme);
      
      // Update terminal theme if terminal is initialized
      if (xterm.current) {
        xterm.current.options.theme = newTheme === 'light' ? lightTheme : darkTheme;
      }
    };

    // Update theme immediately
    updateTheme();

    // Listen for storage changes (theme changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kw-ui-theme') {
        updateTheme();
      }
    };

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      if (theme === 'system') {
        updateTheme();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [theme, xterm, lightTheme, darkTheme]);

  useEffect(() => {
    if (terminalRef.current && xterm) {
      // Enhanced terminal configuration for better performance
      xterm.current = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        theme: currentTheme === 'light' ? lightTheme : darkTheme,
        scrollback: 50000, // Increased scrollback for better history
        fontSize: fontSize,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 0,
        
        // Performance optimizations
        allowTransparency: false, // Better performance
        convertEol: true,
        windowsMode: false,
        
        // Scroll optimizations
        fastScrollModifier: 'alt',
        fastScrollSensitivity: 5,
        scrollSensitivity: 3,
        
        // Better terminal behavior
        macOptionIsMeta: true,
        macOptionClickForcesSelection: false,
        rightClickSelectsWord: true,
        
        // Initial dimensions
        cols: initialCols,
        rows: initialRows,
        
        // Enhanced rendering
        smoothScrollDuration: 0, // Disable smooth scrolling for better performance
        disableStdin: false,
        
        // Better Unicode support
        allowProposedApi: true,
      });

      // Load addons
      fitAddon.current = new FitAddon();
      searchAddonRef.current = new SearchAddon();
      webLinksAddon.current = new WebLinksAddon();
      
      xterm.current.loadAddon(fitAddon.current);
      xterm.current.loadAddon(searchAddonRef.current);
      xterm.current.loadAddon(webLinksAddon.current);
      
      // Load WebGL addon if enabled
      if (enableWebGL) {
        try {
          webglAddon.current = new WebglAddon();
          xterm.current.loadAddon(webglAddon.current);
          
          // Handle WebGL context loss
          webglAddon.current.onContextLoss(() => {
            console.warn('WebGL context lost, falling back to canvas renderer');
            webglAddon.current?.dispose();
            webglAddon.current = null;
            setIsWebGLEnabled(false);
          });
        } catch (error) {
          console.warn('Failed to enable WebGL renderer, using fallback:', error);
          setIsWebGLEnabled(false);
        }
      }

      xterm.current.open(terminalRef.current);

      // Add input handler
      if (onInput) {
        xterm.current.onData((data) => {
          onInput(data);
        });
      }

      // Fit the terminal to the container
      fitAddon.current.fit();

      // Enhanced resize handling with debouncing
      const handleResize = () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
          fitAddon.current?.fit();
        }, 150);
      };
      
      window.addEventListener('resize', handleResize);
      
      // ResizeObserver for container changes
      let resizeObserver: ResizeObserver | null = null;
      if (terminalRef.current) {
        resizeObserver = new ResizeObserver(() => {
          handleResize();
        });
        resizeObserver.observe(terminalRef.current);
      }
      
      // Add scroll listener with better performance
      const xtermContainer = document.querySelector('.xterm-viewport');
      if (xtermContainer) {
        xtermContainer.addEventListener('scroll', checkScrollPosition, { passive: true });
        checkScrollPosition();
      }

      // Keyboard shortcuts
      xterm.current.attachCustomKeyEventHandler((event) => {
        // Ctrl+Shift+F for search
        if (event.ctrlKey && event.shiftKey && event.key === 'F') {
          setShowSearch(true);
          return false;
        }
        // Ctrl+Shift+C for copy
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
          copySelection();
          return false;
        }
        // F11 for fullscreen
        if (event.key === 'F11' && allowFullscreen) {
          event.preventDefault();
          toggleFullscreen();
          return false;
        }
        return true;
      });

      return () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        xterm.current?.dispose();
        window.removeEventListener('resize', handleResize);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        const xtermContainer = document.querySelector('.xterm-viewport');
        if (xtermContainer) {
          xtermContainer.removeEventListener('scroll', checkScrollPosition);
        }
      };
    }
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const terminalContainerClass = `
    ${isFullscreen 
      ? 'fixed inset-0 z-50 bg-background' 
      : 'w-full h-full relative'
    } ${className}
  `.trim();

  return (
    <div className={terminalContainerClass}>
      {/* Terminal Controls */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {isWebGLEnabled ? 'WebGL' : 'Canvas'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {fontSize}px
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Search Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-7 w-7 p-0"
            title="Search (Ctrl+Shift+F)"
          >
            <Search className="h-4 w-4" />
          </Button>
          
          {/* Copy Selection */}
          <Button
            variant="ghost"
            size="sm"
            onClick={copySelection}
            className="h-7 w-7 p-0"
            title="Copy Selection (Ctrl+Shift+C)"
          >
            <Copy className="h-4 w-4" />
          </Button>
          
          {/* Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Terminal Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => changeFontSize(fontSize - 1)}>
                Decrease Font Size
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeFontSize(fontSize + 1)}>
                Increase Font Size
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleWebGL}>
                {isWebGLEnabled ? 'Disable' : 'Enable'} WebGL
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Fullscreen Toggle */}
          {allowFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-7 w-7 p-0"
              title="Toggle Fullscreen (F11)"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          
          {/* Close Fullscreen */}
          {isFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(false)}
              className="h-7 w-7 p-0"
              title="Exit Fullscreen (Escape)"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          <Input
            placeholder="Search terminal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchTerm, !e.shiftKey);
              } else if (e.key === 'Escape') {
                setShowSearch(false);
                setSearchTerm('');
              }
            }}
            className="flex-1 h-7"
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSearch(searchTerm, false)}
            className="h-7 px-2"
            title="Previous (Shift+Enter)"
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSearch(searchTerm, true)}
            className="h-7 px-2"
            title="Next (Enter)"
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowSearch(false);
              setSearchTerm('');
            }}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Terminal Container */}
      <div className="flex-1 relative" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '100%' }}>
        {/* Scroll to Bottom Button */}
        {showScrollDown && (
          <Button
            variant="default"
            size="icon"
            className="absolute bottom-4 right-4 z-10 h-10 w-10 rounded-full shadow-lg border-2 border-primary/20 hover:border-primary/40 transition-all duration-200"
            onClick={scrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronsDown className="h-5 w-5" />
          </Button>
        )}
        
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default EnhancedTerminal;