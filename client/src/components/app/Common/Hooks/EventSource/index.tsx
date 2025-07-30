import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { setHelmReleasesLoading } from '@/data/Helm/HelmReleasesSlice';
import { setHelmReleaseDetailsLoading } from '@/data/Helm/HelmReleaseDetailsSlice';

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
  const maxReconnectAttempts = 3; // Reduced from 5 to 3 for better UX
  const baseReconnectDelay = 2000; // Increased from 1000 to 2000ms
  
  // Determine if this is a Helm releases endpoint
  const isHelmReleases = url.includes('helmreleases');
  const isHelmReleaseDetails = url.includes('helmreleases') && !url.includes('history');
  
  // Optimized timeouts based on Phase 2 server improvements
  const connectionTimeout = isHelmReleases ? 90000 : 15000; // 90 seconds for Helm, 15 seconds for others
  const hasConfigErrorRef = useRef(false);
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

    // Don't reconnect if we've already detected a config error
    if (hasConfigErrorRef.current) {
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
      if (reconnectAttemptsRef.current < maxReconnectAttempts && !hasConfigErrorRef.current) {
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

    // Handle incoming messages with improved error handling
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
        }
      } catch (error) {
        console.warn('Failed to parse error event data:', error);
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
      
      // Don't reconnect if we've detected a config error
      if (hasConfigErrorRef.current) {
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
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts on URL change
    connect();
    
    // Cleanup function
    return () => {
      isConnectingRef.current = false;
      hasConfigErrorRef.current = false;
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