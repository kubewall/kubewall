import { KwEventSource } from "@/types";
import { isIP } from "@/utils";
import { useEffect } from "react";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

const useEventSource = ({url, sendMessage} : KwEventSource) => {
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
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    let stopped = false;

    const connect = () => {
      // opening a connection to the server to begin receiving events from it
      eventSource = new EventSource(updatedUrl);

      eventSource.onopen = () => {
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      };

      // attaching a handler to receive message events
      eventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          sendMessage(eventData);
        } catch {
          sendMessage(event.data);
        }
      };

      // EventSource retries transient drops on its own and only reaches
      // CLOSED once the browser has given up entirely (e.g. a non-2xx
      // response) - without this, the view is silently frozen forever.
      eventSource.onerror = () => {
        if (stopped || eventSource?.readyState !== EventSource.CLOSED) return;
        eventSource.close();
        reconnectTimer = setTimeout(() => {
          if (!stopped) connect();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      };
    };

    connect();

    // terminating the connection on component unmount
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [url]);
};

export {
  useEventSource
};
