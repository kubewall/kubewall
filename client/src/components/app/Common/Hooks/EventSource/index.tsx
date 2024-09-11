import { KwEventSource } from "@/types";
import { useEffect } from "react";

const useEventSource = ({url, sendMessage} : KwEventSource) => {

  useEffect(() => {
    // opening a connection to the server to begin receiving events from it
    const eventSource = new EventSource(url);
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