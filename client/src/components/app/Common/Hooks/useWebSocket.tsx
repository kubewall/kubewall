import { useCallback, useEffect, useRef } from 'react';
import { isIP } from '@/utils';

export type WebSocketOptions = {
  url: string;
  onMessage: (data: string | ArrayBuffer) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onOpen?: (event: Event) => void;
  enabled?: boolean;
};

export function useWebSocket({
  url,
  onMessage,
  onError,
  onClose,
  onOpen,
  enabled = true,
}: WebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);
  const onOpenRef = useRef(onOpen);

  // Keep callbacks in sync
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onCloseRef.current = onClose;
    onOpenRef.current = onOpen;
  }, [onMessage, onError, onClose, onOpen]);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Determine WebSocket URL based on protocol
    let wsUrl = url;
    if (window.location.protocol === 'http:') {
      const protocol = 'ws://';
      const host = window.location.host;
      if (!isIP(host.split(':')[0])) {
        // Add timestamp for non-IP hosts to avoid caching issues
        wsUrl = `${protocol}${new Date().getTime()}.${host}${url}`;
      } else {
        wsUrl = `${protocol}${host}${url}`;
      }
    } else if (window.location.protocol === 'https:') {
      // Convert https to wss
      const httpsPrefix = 'https://';
      const wssPrefix = 'wss://';
      if (url.startsWith(httpsPrefix)) {
        wsUrl = url.replace(httpsPrefix, wssPrefix);
      } else if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        wsUrl = `wss://${window.location.host}${url}`;
      }
    }

    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer'; // Ensure we receive binary data as ArrayBuffer
      wsRef.current = ws;

      ws.onopen = (event) => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
        onOpenRef.current?.(event);
      };

      ws.onmessage = (event) => {
        onMessageRef.current(event.data);
      };

      ws.onerror = (event) => {
        onErrorRef.current?.(event);
      };

      ws.onclose = (event) => {
        onCloseRef.current?.(event);
        wsRef.current = null;
      };
    } catch (error) {
      onErrorRef.current?.(error as Event);
    }
  }, [url, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: string | ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    send,
    disconnect,
    connect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
