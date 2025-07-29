import { KwEventSource } from "@/types";
import { isIP } from "@/utils";
import { useEffect, useRef } from "react";

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

type KwEventSourceWithStatus = KwEventSource & {
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onConfigError?: () => void; // New callback for config errors
};

const useEventSource = ({url, sendMessage, onConnectionStatusChange, onConfigError}: KwEventSourceWithStatus) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  const connectionTimeout = 30000; // 30 seconds timeout
  const isConnectingRef = useRef(false);

  let updatedUrl = '';
  if(window.location.protocol === 'http:') {
    if (!isIP(window.location.host.split(':')[0])) {
      updatedUrl = `http://${new Date().getTime()}.${window.location.host}${url}`;
    } else {
      updatedUrl = `http://${window.location.host}${url}`;
    }
  } else {
    updatedUrl = url;
  }

  const connect = () => {
    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    isConnectingRef.current = true;

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
          sendMessage([]);
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

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      // console.log('EventSource readyState:', eventSource.readyState);
      
      // Check if the connection is in a terminal state
      if (eventSource.readyState === EventSource.CLOSED) {
        // console.log('EventSource connection is closed');
        isConnectingRef.current = false;
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // console.log('EventSource is connecting...');
      } else if (eventSource.readyState === EventSource.OPEN) {
        // console.log('EventSource is open');
      }
      
      // Check if this error is related to config not found
      // This can happen when the backend returns an error response
      if (error && typeof error === 'object' && 'data' in error) {
        try {
          const errorData = JSON.parse((error as any).data);
          if (errorData.error && typeof errorData.error === 'string' && errorData.error.includes('config not found')) {
            console.error('Config not found error in onerror handler:', errorData.error);
            if (onConfigError) {
              onConfigError();
            }
            return;
          }
        } catch (parseError) {
          // If we can't parse the error data, continue with normal error handling
        }
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
        sendMessage([]);
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