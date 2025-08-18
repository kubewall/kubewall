import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { setHelmReleasesLoading } from '@/data/Helm/HelmReleasesSlice';
import { setHelmReleaseDetailsLoading } from '@/data/Helm/HelmReleaseDetailsSlice';

type KwEventSourceWithStatus<T = any> = {
  url: string;
  sendMessage: (message: T) => void;
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'reconnecting' | 'error') => void;
  onConfigError?: () => void;
  onPermissionError?: (error: any) => void;
  setLoading?: (loading: boolean) => void;
};

const useEventSource = <T = any>({url, sendMessage, onConnectionStatusChange, onConfigError, onPermissionError, setLoading}: KwEventSourceWithStatus<T>) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3; // Reduced from 5 to 3 for better UX
  const baseReconnectDelay = 2000; // Increased from 1000 to 2000ms
  const LARGE_EVENT_THRESHOLD = 256 * 1024; // ~256KB
  const workerRef = useRef<Worker | null>(null);
  const pendingParsesRef = useRef(new Map<number, (result: { ok: boolean; data?: any; error?: unknown }) => void>());
  const nextParseIdRef = useRef(1);
  
  // Determine if this is a Helm releases endpoint or configuration resource
  const isHelmReleases = url.includes('helmreleases');
  const isHelmReleaseDetails = url.includes('helmreleases') && !url.includes('history');
  const isConfigResource = url.includes('secrets') || url.includes('configmaps') || url.includes('hpa') || 
                           url.includes('limitranges') || url.includes('resourcequotas') || url.includes('priorityclasses') ||
                           url.includes('runtimeclasses') || url.includes('poddisruptionbudgets');
  
  // Optimized timeouts based on Phase 2 server improvements
  const connectionTimeout = isHelmReleases ? 90000 : (isConfigResource ? 60000 : 15000); // 90s for Helm, 60s for config resources, 15s for others
  const hasConfigErrorRef = useRef(false);
  const hasPermissionErrorRef = useRef(false); // New ref to track permission errors specifically
  const dispatch = useAppDispatch();

  let updatedUrl: string;
  if (url.startsWith('/')) {
    updatedUrl = `${window.location.origin}${url}`;
  } else {
    updatedUrl = url;
  }

  const connect = () => {
    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Don't reconnect if we've already detected a config error or permission error
    if (hasConfigErrorRef.current || hasPermissionErrorRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // Set loading to true when connection starts
    if (setLoading) {
      setLoading(true);
    } else if (isHelmReleases && !isHelmReleaseDetails) {
      dispatch(setHelmReleasesLoading(true));
    } else if (isHelmReleaseDetails) {
      dispatch(setHelmReleaseDetailsLoading(true));
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any existing timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    // Notify connection status
    if (onConnectionStatusChange) {
      onConnectionStatusChange('connecting');
    }

    // console.log(`Connecting to EventSource: ${updatedUrl}`);
    const eventSource = new EventSource(updatedUrl);
    eventSourceRef.current = eventSource;

    // Set up connection timeout with improved handling
    connectionTimeoutRef.current = setTimeout(() => {
      console.warn('EventSource connection timeout, closing and reconnecting...', 'timeout', connectionTimeout);
      eventSource.close();
      isConnectingRef.current = false;
      if (reconnectAttemptsRef.current < maxReconnectAttempts && !hasConfigErrorRef.current && !hasPermissionErrorRef.current) {
        reconnectAttemptsRef.current++;
        connect();
      } else {
        // Max attempts reached, show error
        if (onConnectionStatusChange) {
          onConnectionStatusChange('error');
        }
        sendMessage([] as T);
      }
    }, connectionTimeout);

    // Handle successful connection
    eventSource.onopen = () => {
      // console.log('EventSource connected successfully');
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      isConnectingRef.current = false;
      
      // Clear connection timeout since we're now connected
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      if (onConnectionStatusChange) {
        onConnectionStatusChange('connected');
      }
    };

    // Create or reuse a JSON parser worker
    const ensureWorker = () => {
      if (workerRef.current) return workerRef.current;
      const worker = new Worker(new URL('./jsonParser.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent) => {
        const { id, ok, data, error } = e.data || {};
        const resolver = pendingParsesRef.current.get(id);
        if (resolver) {
          pendingParsesRef.current.delete(id);
          resolver({ ok, data, error });
        }
      };
      worker.onerror = () => {
        // On worker error, clear all pending promises
        pendingParsesRef.current.forEach((resolve) => resolve({ ok: false, error: 'worker_error' }));
        pendingParsesRef.current.clear();
      };
      workerRef.current = worker;
      return worker;
    };

    const parseJSON = async (text: string): Promise<any> => {
      if (!text) return undefined;
      if (text.length < LARGE_EVENT_THRESHOLD) {
        return JSON.parse(text);
      }
      try {
        const worker = ensureWorker();
        const id = nextParseIdRef.current++;
        const result = await new Promise<{ ok: boolean; data?: any; error?: unknown }>((resolve) => {
          pendingParsesRef.current.set(id, resolve);
          worker.postMessage({ id, text });
        });
        if (result.ok) return result.data;
        // Fallback to main-thread parse if worker failed
        return JSON.parse(text);
      } catch {
        return JSON.parse(text);
      }
    };

    // Handle incoming messages with improved error handling and off-main-thread JSON parsing for large payloads
    eventSource.onmessage = (event) => {
      try {
        // Skip empty messages (keep-alive comments)
        if (!event.data || event.data.trim() === '') {
          // console.log('Received keep-alive message');
          return;
        }
        (async () => {
          // console.log('Received SSE message:', event.data.substring(0, 100) + '...');
          const eventData = await parseJSON(event.data);

        // Handle null or undefined data properly
          if (eventData === null || eventData === undefined) {
            // Send empty array for null/undefined data
            sendMessage([] as T);
            return;
          }

        // Check if this is a config error message
          if (eventData.error && typeof eventData.error === 'string' && eventData.error.includes('config not found')) {
            console.error('Config not found error received:', eventData.error);
            console.log('Calling onConfigError callback...');

            // Mark that we've detected a config error to prevent reconnection
            hasConfigErrorRef.current = true;

            // Close the connection immediately
            eventSource.close();

            // Call the config error callback if provided
            if (onConfigError) {
              onConfigError();
            } else {
              console.warn('onConfigError callback not provided');
            }
            // Don't send the error message to the normal sendMessage handler
            return;
          }

        // Check if this is a permission error message
          if (eventData.error && eventData.error.type === 'permission_error') {
            console.error('Permission error received:', eventData.error);

            // Mark that we've detected a permission error to prevent reconnection
            hasPermissionErrorRef.current = true;

            // Close the connection immediately
            eventSource.close();

            // Call the permission error callback if provided
            if (onPermissionError) {
              onPermissionError(eventData.error);
            } else {
              console.warn('onPermissionError callback not provided');
            }
            // Don't send the error message to the normal sendMessage handler
            return;
          }

        // Check for permission errors in regular error messages (fallback)
          if (eventData.error && typeof eventData.error === 'string') {
            const errorMessage = eventData.error.toLowerCase();
            if (errorMessage.includes('forbidden') || errorMessage.includes('unauthorized') || errorMessage.includes('permission denied')) {
              console.error('Permission error detected in error message:', eventData.error);

              // Mark that we've detected a permission error to prevent reconnection
              hasPermissionErrorRef.current = true;

              // Close the connection immediately
              eventSource.close();

              // Create a permission error object
              const permissionError = {
                type: 'permission_error',
                message: eventData.error,
                code: 403,
                resource: 'unknown',
                verb: 'access'
              };

              // Call the permission error callback if provided
              if (onPermissionError) {
                onPermissionError(permissionError);
              } else {
                console.warn('onPermissionError callback not provided');
              }
              // Don't send the error message to the normal sendMessage handler
              return;
            }
          }

        // Ensure we're sending valid data
          if (Array.isArray(eventData) || typeof eventData === 'object') {
            sendMessage(eventData);
          } else {
            console.warn('Received invalid data format from EventSource:', eventData);
            sendMessage([] as T);
          }
        })().catch((error) => {
          console.warn('Failed to parse EventSource message:', error);
          // Send empty array on parse error to prevent UI issues
          sendMessage([] as T);
        });
      } catch (error) {
        console.warn('Failed to handle EventSource message:', error);
        sendMessage([] as T);
      }
    };

    // Handle "error" event type (SSE errors from server)
    eventSource.addEventListener('error', (event) => {
      try {
        const messageEvent = event as MessageEvent;
        if (messageEvent.data) {
          const errorData = JSON.parse(messageEvent.data);
          if (errorData.error && typeof errorData.error === 'string' && errorData.error.includes('config not found')) {
            console.error('Config not found error received via error event:', errorData.error);
            console.log('Calling onConfigError callback...');
            
            // Mark that we've detected a config error to prevent reconnection
            hasConfigErrorRef.current = true;
            
            // Close the connection immediately
            eventSource.close();
            
            // Call the config error callback if provided
            if (onConfigError) {
              onConfigError();
            } else {
              console.warn('onConfigError callback not provided');
            }
            return;
          }
          
          // Check for permission errors in error events
          if (errorData.error && errorData.error.type === 'permission_error') {
            console.error('Permission error received via error event:', errorData.error);
            
            // Mark that we've detected a permission error to prevent reconnection
            hasPermissionErrorRef.current = true;
            
            // Close the connection immediately
            eventSource.close();
            
            // Call the permission error callback if provided
            if (onPermissionError) {
              onPermissionError(errorData.error);
            } else {
              console.warn('onPermissionError callback not provided');
            }
            return;
          }
          
          // Check for permission errors in error message strings
          if (errorData.error && typeof errorData.error === 'string') {
            const errorMessage = errorData.error.toLowerCase();
            if (errorMessage.includes('forbidden') || errorMessage.includes('unauthorized') || errorMessage.includes('permission denied')) {
              console.error('Permission error detected in error event message:', errorData.error);
              
              // Mark that we've detected a permission error to prevent reconnection
              hasPermissionErrorRef.current = true;
              
              // Close the connection immediately
              eventSource.close();
              
              // Create a permission error object
              const permissionError = {
                type: 'permission_error',
                message: errorData.error,
                code: 403,
                resource: 'unknown',
                verb: 'access'
              };
              
              // Call the permission error callback if provided
              if (onPermissionError) {
                onPermissionError(permissionError);
              } else {
                console.warn('onPermissionError callback not provided');
              }
              return;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse error event data:', error);
      }
    });

    // Handle "permission_error" event type (SSE permission errors from server)
    eventSource.addEventListener('permission_error', (event) => {
      try {
        const messageEvent = event as MessageEvent;
        if (messageEvent.data) {
          const errorData = JSON.parse(messageEvent.data);
          console.error('Permission error received via permission_error event:', errorData);
          
          // Mark that we've detected a permission error to prevent reconnection
          hasPermissionErrorRef.current = true;
          
          // Close the connection immediately
          eventSource.close();
          
          // Call the permission error callback if provided
          if (onPermissionError) {
            onPermissionError(errorData.error);
          } else {
            console.warn('onPermissionError callback not provided');
          }
        }
      } catch (error) {
        console.warn('Failed to parse permission_error event data:', error);
      }
    });

    // Handle connection errors with improved retry logic
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      
      // Clear connection timeout since we're handling the error
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      isConnectingRef.current = false;
      
      // Set loading to false on error
      if (setLoading) {
        setLoading(false);
      } else if (isHelmReleases && !isHelmReleaseDetails) {
        dispatch(setHelmReleasesLoading(false));
      } else if (isHelmReleaseDetails) {
        dispatch(setHelmReleaseDetailsLoading(false));
      }
      
      // Don't send empty array immediately on error
      // This prevents "No results" from showing during temporary connection issues
      
      // Don't reconnect if we've detected a config error or permission error
      if (hasConfigErrorRef.current || hasPermissionErrorRef.current) {
        return;
      }
      
      // Attempt to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current); // Exponential backoff
        // console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
        
        if (onConnectionStatusChange) {
          onConnectionStatusChange('reconnecting');
        }
        
        // Close the current connection before reconnecting
        eventSource.close();
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        console.error('Max reconnection attempts reached. EventSource connection failed.');
        if (onConnectionStatusChange) {
          onConnectionStatusChange('error');
        }
        // Only send empty array after all reconnection attempts have failed
        sendMessage([] as T);
      }
    };
  };

  useEffect(() => {
    // Reset config error flag when URL changes
    hasConfigErrorRef.current = false;
    hasPermissionErrorRef.current = false; // Reset permission error flag on URL change
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts on URL change
    
    // Close any existing connection before creating a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Clear any existing timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    connect();
    
    // Cleanup function
    return () => {
      isConnectingRef.current = false;
      hasConfigErrorRef.current = false;
      hasPermissionErrorRef.current = false; // Clear permission error flag on cleanup
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      if (workerRef.current) {
        try { workerRef.current.terminate(); } catch { /* ignore */ }
        workerRef.current = null;
      }
    };
  }, [url]);
};

export {
  useEventSource
};