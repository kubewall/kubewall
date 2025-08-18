import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

export interface LogMessage {
  type: string;
  timestamp: string;
  message: string;
  container: string;
  level?: string;
  lineNumber: number;
  rawTimestamp?: string;
  isPrevious?: boolean;
  podInstance?: string;
}

export interface ControlMessage {
  type: string;
  action?: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface UsePodLogsWebSocketOptions {
  podName: string;
  namespace: string;
  configName: string;
  clusterName: string;
  container?: string;
  allContainers?: boolean;
  tailLines?: number;
  sinceTime?: string;
  previous?: boolean;
  allLogs?: boolean;
  onLog?: (log: LogMessage) => void;
  onControl?: (control: ControlMessage) => void;
  onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

export interface UsePodLogsWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

export const usePodLogsWebSocket = ({
  podName,
  namespace,
  configName,
  clusterName,
  container,
  allContainers = false,
  tailLines = 100,
  sinceTime,
  previous = false,
  allLogs = false,
  onLog,
  onControl,
  onConnectionChange,
  onError,
  enabled = true,
}: UsePodLogsWebSocketOptions): UsePodLogsWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectDelay = 2000;
  const isManuallyDisconnectedRef = useRef(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build WebSocket URL
  const buildWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      config: configName,
      cluster: clusterName,
    });
    
    // Add tail-lines only if not fetching all logs
    if (!allLogs) {
      params.set('tail-lines', tailLines.toString());
    } else {
      params.set('all-logs', 'true');
    }
    
    if (container) {
      params.set('container', container);
    } else if (allContainers) {
      params.set('all-containers', 'true');
    }
    
    if (sinceTime) {
      params.set('since-time', sinceTime);
    }
    
    if (previous) {
      params.set('previous', 'true');
    }
    
    return `${protocol}//${window.location.host}/api/v1/pods/${namespace}/${podName}/logs/ws?${params.toString()}`;
  }, [podName, namespace, configName, clusterName, container, allContainers, tailLines, sinceTime, previous, allLogs]);

  // Send message to WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
      }
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || isConnecting || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnecting(true);
    setError(null);
    isManuallyDisconnectedRef.current = false;
    onConnectionChange?.('connecting');

    try {
      const wsUrl = buildWebSocketUrl();
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection opened
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onConnectionChange?.('connected');
      };

      // Message received
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'log') {
            onLog?.(data as LogMessage);
          } else {
            onControl?.(data as ControlMessage);
            
            // Handle specific control messages
            if (data.type === 'error') {
              const errorMsg = data.data?.message || 'Unknown error';
              setError(errorMsg);
              onError?.(errorMsg);
              toast.error('Log Stream Error', {
                description: errorMsg,
              });
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      // Connection closed
      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onConnectionChange?.('disconnected');

        // Attempt to reconnect if not manually disconnected and within retry limits
        if (!isManuallyDisconnectedRef.current && 
            enabled && 
            reconnectAttemptsRef.current < maxReconnectAttempts) {
          
          const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          const errorMsg = 'Maximum reconnection attempts reached';
          setError(errorMsg);
          onError?.(errorMsg);
          onConnectionChange?.('error');
        }
      };

      // Connection error
      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        const errorMsg = 'WebSocket connection error';
        setError(errorMsg);
        setIsConnecting(false);
        onError?.(errorMsg);
        onConnectionChange?.('error');
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      const errorMsg = 'Failed to create WebSocket connection';
      setError(errorMsg);
      setIsConnecting(false);
      onError?.(errorMsg);
      onConnectionChange?.('error');
    }
  }, [enabled, isConnecting, buildWebSocketUrl, onLog, onControl, onConnectionChange, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    isManuallyDisconnectedRef.current = true;
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Send close message to server
        sendMessage({ type: 'close' });
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    reconnectAttemptsRef.current = 0;
    onConnectionChange?.('disconnected');
  }, [sendMessage, onConnectionChange]);

  // Reconnect (manual)
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      reconnectAttemptsRef.current = 0;
      connect();
    }, 100);
  }, [disconnect, connect]);

  // Auto-connect when enabled or dependencies change
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, podName, namespace, configName, clusterName, container, allContainers, tailLines, sinceTime, previous, allLogs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
    reconnect,
  };
};