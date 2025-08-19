import { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Terminal } from "@xterm/xterm";
import { SearchAddon } from "@xterm/addon-search";
import EnhancedTerminal from "../Terminal/EnhancedTerminal";

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
  setCurrentSession,
  clearError
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
  const wsRef = useRef<WebSocket | null>(null);


  const [isConnected, setIsConnected] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSessionsCollapsed, setIsSessionsCollapsed] = useState(false);
  
  // Error handling and backoff state
  const [retryCount, setRetryCount] = useState(0);
  const [lastErrorType, setLastErrorType] = useState<string | null>(null);
  const [isPollingDisabled, setIsPollingDisabled] = useState(false);

  // Check if error is a permission error
  const isPermissionError = (errorMessage: string): boolean => {
    if (!errorMessage) return false;
    return errorMessage.toLowerCase().includes('permission denied') || 
           errorMessage.toLowerCase().includes('insufficient permissions') ||
           errorMessage.toLowerCase().includes('forbidden') ||
           errorMessage.toLowerCase().includes('cannot create configmaps') ||
           errorMessage.toLowerCase().includes('cannot create pods') ||
           errorMessage.toLowerCase().includes('cannot get pod') ||
           errorMessage.toLowerCase().includes('cannot exec into pod');
  };

  // Check if error is a configuration error (400 errors)
  const isConfigurationError = (errorMessage: string): boolean => {
    if (!errorMessage) return false;
    return errorMessage.toLowerCase().includes('config parameter is required') ||
           errorMessage.toLowerCase().includes('config not found') ||
           errorMessage.toLowerCase().includes('failed to get kubernetes client') ||
           errorMessage.toLowerCase().includes('invalid response format');
  };

  // Check if error is a network/temporary error
  const isTemporaryError = (errorMessage: string): boolean => {
    if (!errorMessage) return false;
    return errorMessage.toLowerCase().includes('network') ||
           errorMessage.toLowerCase().includes('timeout') ||
           errorMessage.toLowerCase().includes('connection') ||
           errorMessage.toLowerCase().includes('temporary');
  };

  // Calculate exponential backoff delay
  const getBackoffDelay = (retryCount: number): number => {
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 60000; // 60 seconds
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return delay;
  };

  // Terminal initialization is now handled by SharedTerminal component

  // Load sessions on mount
  useEffect(() => {
    dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }));
  }, [dispatch, configName, clusterName, namespace]);

  // Poll for session updates with intelligent error handling and backoff
  useEffect(() => {
    let pollTimeout: NodeJS.Timeout;

    const pollSessions = async () => {
      // Don't poll if polling is disabled due to persistent errors
      if (isPollingDisabled) {
        return;
      }

      // Don't poll if there's a persistent permission or configuration error
      if (error) {
        if (isPermissionError(error) || isConfigurationError(error)) {
          console.warn('CloudShell polling stopped due to persistent error:', error);
          setIsPollingDisabled(true);
          return;
        }
      }

      try {
        await dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace })).unwrap();
        // Reset retry count on successful request
        setRetryCount(0);
        setLastErrorType(null);
        
        // Schedule next poll with normal interval
        pollTimeout = setTimeout(pollSessions, 5000);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        console.error('CloudShell polling error:', errorMessage);
        
        // Determine error type
        let errorType = 'unknown';
        if (isPermissionError(errorMessage)) {
          errorType = 'permission';
        } else if (isConfigurationError(errorMessage)) {
          errorType = 'configuration';
        } else if (isTemporaryError(errorMessage)) {
          errorType = 'temporary';
        }
        
        setLastErrorType(errorType);
        
        // Stop polling for persistent errors
        if (errorType === 'permission' || errorType === 'configuration') {
          console.warn('CloudShell polling stopped due to persistent error type:', errorType);
          setIsPollingDisabled(true);
          return;
        }
        
        // For temporary errors, implement exponential backoff
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        // Stop polling after 5 consecutive failures
        if (newRetryCount >= 5) {
          console.warn('CloudShell polling stopped after 5 consecutive failures');
          setIsPollingDisabled(true);
          setSessionMessage({ 
            type: 'error', 
            message: 'Unable to connect to CloudShell service. Please refresh the page or check your connection.' 
          });
          return;
        }
        
        // Schedule retry with exponential backoff
        const backoffDelay = getBackoffDelay(newRetryCount);
        console.log(`CloudShell polling retry ${newRetryCount} scheduled in ${backoffDelay}ms`);
        pollTimeout = setTimeout(pollSessions, backoffDelay);
      }
    };

    // Start initial poll
    pollSessions();

    return () => {
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [dispatch, configName, clusterName, namespace, retryCount, isPollingDisabled]);

  // Clear session messages after 5 seconds
  useEffect(() => {
    if (sessionMessage) {
      const timer = setTimeout(() => {
        setSessionMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [sessionMessage]);

  // Handle manual refresh - clears error state to allow polling to resume
  const handleRefresh = () => {
    // Reset polling state
    setIsPollingDisabled(false);
    setRetryCount(0);
    setLastErrorType(null);
    setSessionMessage(null);
    
    // Clear any existing error to allow polling to resume
    dispatch(clearError());
    
    // Immediately fetch sessions
    dispatch(listCloudShellSessions({ config: configName, cluster: clusterName, namespace }));
  };

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

    // Clear any previous session messages
    setSessionMessage(null);

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
            
            // Check if this is a permission error and show appropriate message
            if (isPermissionError(data.error)) {
              setSessionMessage({ 
                type: 'error', 
                message: `Permission denied: You don't have permission to connect to this cloud shell session.` 
              });
            }
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

  // Check if user can connect to a session (only ready sessions are connectable)
  const canConnectToSession = (session: CloudShellSession) => {
    return session.status === 'ready';
  };

  // Handle terminal resize
  const handleTerminalResize = () => {
    // Terminal resizing is handled by EnhancedTerminal component
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
            Interactive terminal with kubectl and helm access for cluster
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
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center gap-2"
                  title={
                    isPollingDisabled 
                      ? `Polling stopped due to ${lastErrorType || 'persistent'} errors - click to retry`
                      : error && isPermissionError(error) 
                        ? "Click to retry - polling stopped due to permission error" 
                        : "Refresh sessions"
                  }
                >
                  <RefreshCw className="h-4 w-4" />
                  {isPollingDisabled ? 'Retry' : 'Refresh'}
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
                           {canConnectToSession(session) && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => connectToShell(session)}
                               disabled={isConnected && currentSession?.id === session.id}
                               className="h-7 px-2"
                               title={
                                 isConnected && currentSession?.id === session.id 
                                   ? 'Already connected to this session' 
                                   : 'Connect to this cloud shell session'
                               }
                             >
                               {isConnected && currentSession?.id === session.id ? 'Connected' : 'Connect'}
                             </Button>
                           )}
                           {session.status === 'creating' && (
                             <Button
                               variant="outline"
                               size="sm"
                               disabled={true}
                               className="h-7 px-2"
                             >
                               Creating...
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
              className="bg-background border rounded-lg overflow-hidden transition-all duration-300 w-full"
              style={{ 
                height: isExpanded ? '600px' : '400px',
                minHeight: isExpanded ? '600px' : '400px'
              }}
            >
              <EnhancedTerminal
                xterm={xterm}
                searchAddonRef={searchAddonRef}
                onInput={handleTerminalInput}
                allowFullscreen={true}
                initialRows={isExpanded ? 35 : 25}
                initialCols={120}
                enableWebGL={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}