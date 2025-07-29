import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { setHelmReleasesLoading } from '@/data/Helm';

type KwEventSourceWithStatus<T = any> = {
  url: string;
  sendMessage: (message: T) => void;
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'reconnecting' | 'error') => void;
  onConfigError?: () => void;
  setLoading?: (loading: boolean) => void;
};

const useEventSource = <T = any>({url, sendMessage, onConnectionStatusChange, onConfigError, setLoading}: KwEventSourceWithStatus<T>) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;
  const connectionTimeout = 10000;
  const dispatch = useAppDispatch();

  // Determine if this is a Helm releases endpoint
  const isHelmReleases = url.includes('helmreleases');

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

    isConnectingRef.current = true;

    // Set loading to true when connection starts
    if (setLoading) {
      setLoading(true);
    } else if (isHelmReleases) {
      dispatch(setHelmReleasesLoading(true));
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

    // Set up connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      console.warn('EventSource connection timeout, closing and reconnecting...');
      eventSource.close();
      isConnectingRef.current = false;
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        connect();
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

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        // Skip empty messages (keep-alive comments)
        if (!event.data || event.data.trim() === '') {
          // console.log('Received keep-alive message');
          return;
        }
        
        // console.log('Received SSE message:', event.data.substring(0, 100) + '...');
        const eventData = JSON.parse(event.data);
        
        // Handle null data properly - don't try to access properties on null
        if (eventData === null) {
          // Send empty array for null data instead of trying to access properties
          sendMessage([] as T);
          return;
        }
        
        // Check if this is a config error message
        if (eventData.error && typeof eventData.error === 'string' && eventData.error.includes('config not found')) {
          console.error('Config not found error received:', eventData.error);
          console.log('Calling onConfigError callback...');
          // Call the config error callback if provided
          if (onConfigError) {
            onConfigError();
          } else {
            console.warn('onConfigError callback not provided');
          }
          // Don't send the error message to the normal sendMessage handler
          return;
        }
        
        sendMessage(eventData);
      } catch (error) {
        console.warn('Failed to parse EventSource message:', error);
        // Don't send empty array on parse error, just log the warning
        // This prevents "No results" from showing during temporary issues
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
            // Call the config error callback if provided
            if (onConfigError) {
              onConfigError();
            } else {
              console.warn('onConfigError callback not provided');
            }
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to parse error event data:', error);
      }
    });

    // Handle connection errors
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
      } else if (isHelmReleases) {
        dispatch(setHelmReleasesLoading(false));
      }
      
      // Don't send empty array immediately on error
      // This prevents "No results" from showing during temporary connection issues
      
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
    connect();
    
    // Cleanup function
    return () => {
      isConnectingRef.current = false;
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
    };
  }, [url]);
};

export {
  useEventSource
};