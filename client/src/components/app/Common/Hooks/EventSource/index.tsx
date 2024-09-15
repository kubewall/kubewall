import { KwEventSource } from "@/types";
import { useEffect } from "react";

const useEventSource = ({url, sendMessage} : KwEventSource) => {
  const updatedUrl = window.location.protocol === 'http:' ? `http://${new Date().getTime()}.${window.location.host}${url}` : url;
  useEffect(() => {
    // opening a connection to the server to begin receiving events from it
    const eventSource = new EventSource(updatedUrl);
    // attaching a handler to receive message events
    eventSource.onmessage = (event) => {
      // const eventData = JSON.parse(event.data);
      // sendMessage(eventData)

      try {
        const eventData = JSON.parse(event.data);
        sendMessage(eventData);
      } catch {
        // const eventData = JSON.parse(event.data);
        sendMessage(event.data);
      }
    };
    
    // terminating the connection on component unmount
    return () => eventSource.close();
  }, [url]);
};

export {
  useEventSource
};