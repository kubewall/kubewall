import { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Terminal } from "@xterm/xterm";
import { SearchAddon } from "@xterm/addon-search";
import { FitAddon } from "@xterm/addon-fit";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PermissionErrorBanner } from "@/components/app/Common/PermissionErrorBanner";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Loader2, 
  Terminal as TerminalIcon, 
  Trash2, 
  Play, 
  Square, 
  RefreshCw, 
  Maximize2, 
  Minimize2,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import { AppDispatch, RootState } from "@/redux/store";
import { 
  createCloudShell, 
  deleteCloudShell, 
  listCloudShellSessions,
  setCurrentSession
} from "@/data/CloudShell/CloudShellSlice";
import { CloudShellSession } from "@/types/cloudshell";

type CloudShellProps = {
  configName: string;
  clusterName: string;
  namespace?: string;
};

export function CloudShell({ configName, clusterName, namespace = "default" }: CloudShellProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { sessions, currentSession, loading, error, sessionLimit, currentSessionCount } = useSelector((state: RootState) => state.cloudShell);
  
  const xterm = useRef<Terminal | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSessionsCollapsed, setIsSessionsCollapsed] = useState(false);

  // Check if error is a permission error
  const isPermissionError = (errorMessage: string): boolean => {
    if (!errorMessage) return false;
    return errorMessage.toLowerCase().includes('permission denied') || 
           errorMessage.toLowerCase().includes('insufficient permissions') ||
           errorMessage.toLowerCase().includes('forbidden') ||
           errorMessage.toLowerCase().includes('cannot create configmaps') ||
           errorMessage.toLowerCase().includes('cannot create pods');
  };

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    xterm.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      cols: 120,
      rows: 30,
      allowTransparency: true,
      cursorStyle: 'block',
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 1,
      scrollback: 1000,
      tabStopWidth: 8,
      windowsMode: true,
      macOptionIsMeta: false,
      macOptionClickForcesSelection: false,
      rightClickSelectsWord: false,
      convertEol: true,
      scrollSensitivity: 1,
      disableStdin: false,
      screenReaderMode: false,
      smoothScrollDuration: 0,
    });

    // Add addons
    searchAddonRef.current = new SearchAddon();
    fitAddonRef.current = new FitAddon();
    
    xterm.current.loadAddon(searchAddonRef.current);
    xterm.current.loadAddon(fitAddonRef.current);
    
    // Try to load optional addons
    try {
      const { WebLinksAddon } = require("@xterm/addon-web-links");
      xterm.current.loadAddon(new WebLinksAddon());
    } catch (e) {
      // WebLinks not available, continue without it
    }
    
    try {
      const { WebglAddon } = require("@xterm/addon-webgl");
      xterm.current.loadAddon(new WebglAddon());
    } catch (e) {
      // WebGL not supported, continue without it
    }

    // Open terminal
    xterm.current.open(terminalRef.current);
    fitAddonRef.current.fit();

    // Initialize terminal properly - disable local echo to prevent cursor jumping
    xterm.current.write('\x1b[?25h'); // Show cursor
    xterm.current.write('\x1b[?12l'); // Disable local echo
    xterm.current.write('\x1b[?2004h'); // Enable bracketed paste mode

    // Handle terminal input
    xterm.current.onData(handleTerminalInput);





    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (xterm.current) {
        // Reset terminal modes before disposing
        xterm.current.write('\x1b[?25l'); // Hide cursor
        xterm.current.write('\x1b[?12h'); // Re-enable local echo
        xterm.current.write('\x1b[?2004l'); // Disable bracketed paste mode
        xterm.current.dispose();
      }
    };
  }, []);

  // Load sessions on mount
  useEffect(() => {
    dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }));
  }, [dispatch, configName, clusterName, namespace]);

  // Poll for session updates every 5 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }));
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [dispatch, configName, clusterName, namespace]);

  // Clear session messages after 5 seconds
  useEffect(() => {
    if (sessionMessage) {
      const timer = setTimeout(() => {
        setSessionMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [sessionMessage]);

  // Handle terminal input
  const handleTerminalInput = (data: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // Send input to WebSocket - don't render locally, let server handle echo
    const message = JSON.stringify({
      input: data
    });
    
    try {
      wsRef.current.send(message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      setIsConnected(false);
      wsRef.current = null;
    }
  };

  // Create new cloud shell
  const handleCreateShell = async () => {
    try {
      setCreatingSession(true);
      setSessionMessage(null);
      
      // Create shell directly without RBAC setup
      const result = await dispatch(createCloudShell({ 
        config: configName, 
        cluster: clusterName, 
        namespace 
      })).unwrap();
      
      // Immediately refresh sessions to show the new session
      dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }));
      
      setSessionMessage({ type: 'success', message: 'Cloud shell session created successfully!' });
      
      // Connect to the shell if it's ready
      if (result.session.status === 'ready') {
        connectToShell(result.session);
      } else {
        setSessionMessage({ type: 'success', message: 'Session created! Waiting for it to be ready...' });
        // If not ready, start polling for status updates
        const statusCheckInterval = setInterval(async () => {
          try {
            const sessionsResult = await dispatch(listCloudShellSessions({ 
              config: configName, 
              cluster: clusterName, 
              namespace 
            })).unwrap();
            
            const updatedSession = sessionsResult.sessions.find(s => s.id === result.session.id);
            if (updatedSession && updatedSession.status === 'ready') {
              clearInterval(statusCheckInterval);
              setSessionMessage({ type: 'success', message: 'Session is ready! Connecting...' });
              connectToShell(updatedSession);
            }
          } catch (error) {
            console.error('Failed to check session status:', error);
          }
        }, 2000);

        // Clear interval after 2 minutes to avoid infinite polling
        setTimeout(() => {
          clearInterval(statusCheckInterval);
          setSessionMessage({ type: 'error', message: 'Session creation timed out. Please try again.' });
        }, 120000);
      }
    } catch (error) {
      console.error('Failed to create cloud shell:', error);
      // Extract the error message properly
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSessionMessage({ type: 'error', message: errorMessage });
    } finally {
      setCreatingSession(false);
    }
  };

  // Connect to existing shell
  const connectToShell = (session: CloudShellSession) => {
    if (!session || session.status !== 'ready') {
      console.error('Session not ready:', session);
      setSessionMessage({ type: 'error', message: 'Session is not ready yet. Please wait a moment and try again.' });
      return;
    }

    // Disconnect any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }

    // Create WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/cloudshell/ws?pod=${session.podName}&namespace=${session.namespace}&config=${configName}&cluster=${clusterName}`;
    
    const websocket = new WebSocket(wsUrl);
    wsRef.current = websocket;
    
    websocket.onopen = () => {
      setIsConnected(true);
      dispatch(setCurrentSession(session));
      setSessionMessage({ type: 'success', message: 'Connected to cloud shell successfully!' });
      if (xterm.current) {
        xterm.current.writeln(`\r\n\x1b[32mConnected to cloud shell in cluster: ${clusterName}\x1b[0m`);
        xterm.current.writeln(`\x1b[36mAvailable commands: kubectl, helm\x1b[0m`);
        xterm.current.writeln(`\x1b[37mType 'exit' to disconnect\x1b[0m\r\n`);
      }
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (xterm.current) {
          if (data.type === 'stdout') {
            // Write data without interfering with cursor position
            xterm.current.write(data.data);
          } else if (data.type === 'stderr') {
            // Write stderr with red color
            xterm.current.write(`\x1b[31m${data.data}\x1b[0m`);
          } else if (data.error) {
            // Write error messages
            xterm.current.writeln(`\r\n\x1b[31mError: ${data.error}\x1b[0m`);
          }
        }
      } catch (error) {
        // If not JSON, treat as raw output
        if (xterm.current) {
          xterm.current.write(event.data);
        }
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      wsRef.current = null;
      setSessionMessage({ type: 'error', message: 'Failed to connect to cloud shell. Please try again.' });
      if (xterm.current) {
        xterm.current.writeln(`\r\n\x1b[31mWebSocket error occurred\x1b[0m`);
      }
    };

    websocket.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      dispatch(setCurrentSession(null));
      setSessionMessage({ type: 'error', message: 'Disconnected from cloud shell' });
      if (xterm.current) {
        xterm.current.writeln(`\r\n\x1b[31mDisconnected from cloud shell\x1b[0m`);
      }
    };
  };

  // Delete shell session
  const handleDeleteShell = async (session: CloudShellSession) => {
    try {
      await dispatch(deleteCloudShell({ 
        name: session.id, 
        config: configName, 
        cluster: clusterName, 
        namespace 
      })).unwrap();
      
      // Refresh sessions list after deletion
      dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }));
    } catch (error) {
      console.error('Failed to delete cloud shell:', error);
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Ready</Badge>;
      case 'creating':
        return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white">Creating</Badge>;
      case 'terminating':
        return <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white">Terminating</Badge>;
      case 'terminated':
        return <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white">Terminated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Handle terminal resize
  const handleTerminalResize = () => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  };

  // Toggle terminal expansion
  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
    // Resize terminal after state change
    setTimeout(handleTerminalResize, 100);
  };

  return (
    <div className="cloud-shell space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TerminalIcon className="h-5 w-5" />
            Cloud Shell
          </CardTitle>
          <CardDescription>
            Interactive terminal with kubectl and helm access for cluster: {clusterName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && isPermissionError(error) && (
            <div className="mb-4">
              <PermissionErrorBanner
                error={{
                  type: 'permission_error',
                  message: error,
                  code: 403,
                  resource: 'cloudshell',
                  verb: 'create'
                }}
                className="mb-4"
              />
            </div>
          )}

          {sessionMessage && !isPermissionError(sessionMessage.message) && (
            <div className="mb-4">
              <Alert variant={sessionMessage.type === 'error' ? 'destructive' : 'default'} className="mb-4">
                <AlertDescription>{sessionMessage.message}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Session Management */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Sessions ({currentSessionCount}/{sessionLimit})</h3>
                {currentSessionCount >= sessionLimit && (
                  <Badge variant="destructive" className="text-xs">
                    Limit Reached
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSessionsCollapsed(!isSessionsCollapsed)}
                  className="h-6 w-6 p-0"
                >
                  {isSessionsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }))}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button 
                  onClick={handleCreateShell} 
                  disabled={loading || creatingSession || currentSessionCount >= sessionLimit || (error ? isPermissionError(error) : false)}
                  className="flex items-center gap-2"
                  title={
                    currentSessionCount >= sessionLimit 
                      ? `Maximum ${sessionLimit} sessions reached` 
                      : (error && isPermissionError(error)) 
                        ? "Insufficient permissions to create cloud shell" 
                        : undefined
                  }
                >
                  {loading || creatingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {creatingSession ? 'Creating...' : 'New Shell'}
                </Button>
              </div>
            </div>

            {!isSessionsCollapsed && (
              <>
                {currentSessionCount >= sessionLimit && (
                  <Alert className="mb-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                      Maximum number of active sessions ({sessionLimit}) reached. Please terminate an existing session before creating a new one.
                    </AlertDescription>
                  </Alert>
                )}
                {sessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active sessions</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-2 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate text-foreground">{session.podName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          {getStatusBadge(session.status)}
                        </div>
                                                 <div className="flex items-center gap-1 ml-2">
                           {(session.status === 'ready' || session.status === 'creating') && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => connectToShell(session)}
                               disabled={isConnected && currentSession?.id === session.id || session.status === 'creating'}
                               className="h-7 px-2"
                             >
                               {isConnected && currentSession?.id === session.id ? 'Connected' : 
                                session.status === 'creating' ? 'Creating...' : 'Connect'}
                             </Button>
                           )}
                                                     <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 disabled={loading}
                                 className="h-7 w-7 p-0"
                               >
                                 <Trash2 className="h-3 w-3" />
                               </Button>
                             </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Session</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the session "{session.podName}"? 
                                  This action cannot be undone and will terminate the cloud shell.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                                               <AlertDialogCancel>
                                 Cancel
                               </AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteShell(session)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Terminal */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-900 p-2 flex items-center justify-between">
              <span className="text-white text-sm">
                {isConnected ? 'Connected' : 'Disconnected'} - {clusterName}
              </span>
              <div className="flex items-center gap-2">
                {isConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (wsRef.current) {
                        wsRef.current.close();
                      }
                    }}
                    className="h-7 px-2"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleExpansion}
                  className="h-7 px-2"
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div 
              ref={terminalRef} 
              className="bg-black transition-all duration-300"
              style={{ 
                height: isExpanded ? '600px' : '400px',
                minHeight: isExpanded ? '600px' : '400px'
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 