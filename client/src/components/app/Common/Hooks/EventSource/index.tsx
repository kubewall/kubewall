import { KwEventSource } from "@/types";
import { isIP } from "@/utils";
import { useEffect } from "react";

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
    // opening a connection to the server to begin receiving events from it
    const eventSource = new EventSource(updatedUrl);
    // attaching a handler to receive message events
    eventSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);
        sendMessage(eventData);
      } catch (error) {
        // If parsing fails, try to send the raw data, or send empty array as fallback
        try {
          sendMessage(event.data);
        } catch {
          sendMessage([]);
        }
      }
    };

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      sendMessage([]);
    };
    
    // terminating the connection on component unmount
    return () => eventSource.close();
  }, [url]);
};

export {
  useEventSource
};