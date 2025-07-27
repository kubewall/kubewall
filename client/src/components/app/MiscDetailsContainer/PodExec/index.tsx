import { useRef, useState, useEffect } from "react";
import { PodDetailsSpec } from "@/types";

import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import XtermTerminal from "../Logs/Xtrem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PodExecProps = {
  pod: string;
  namespace: string;
  configName: string;
  clusterName: string;
  podDetailsSpec: PodDetailsSpec;
}

export function PodExec({ pod, namespace, configName, clusterName, podDetailsSpec }: PodExecProps) {
  const execContainerRef = useRef<HTMLDivElement>(null);
  const xterm = useRef<Terminal | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [command, setCommand] = useState('/bin/sh');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const containerNames = podDetailsSpec.containers?.map(container => container.name) || [];

  // Set default container to the first one (0th container)
  useEffect(() => {
    if (containerNames.length > 0 && !selectedContainer) {
      setSelectedContainer(containerNames[0]);
    }
  }, [containerNames, selectedContainer]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
    };
  }, []);

  const connectToPod = () => {
    if (!selectedContainer) {
      alert('Please select a container');
      return;
    }

    // Disconnect any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }

    // Create WebSocket URL - handle both HTTP and HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/pods/${namespace}/${pod}/exec/ws?container=${selectedContainer}&command=${command}&config=${configName}&cluster=${clusterName}`;
    
    // console.log('Connecting to WebSocket:', wsUrl);
    
    const websocket = new WebSocket(wsUrl);
    
    // Set WebSocket reference immediately to avoid race conditions
    wsRef.current = websocket;
    
    websocket.onopen = () => {
      // console.log('WebSocket connected successfully');
      setIsConnected(true);
      if (xterm.current) {
        xterm.current.writeln(`\r\n\x1b[32mConnected to pod ${pod} in container ${selectedContainer}\x1b[0m`);
        xterm.current.writeln(`\r\n\x1b[36mCommand: ${command}\x1b[0m`);
        xterm.current.writeln(`\r\n\x1b[37mType 'exit' to disconnect\x1b[0m\r\n`);
      }
    };

    websocket.onmessage = (event) => {
      // console.log('WebSocket message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (xterm.current) {
          if (data.type === 'stdout') {
            xterm.current.write(data.data);
          } else if (data.type === 'stderr') {
            xterm.current.write(`\x1b[31m${data.data}\x1b[0m`);
          } else if (data.error) {
            xterm.current.writeln(`\r\n\x1b[31mError: ${data.error}\x1b[0m`);
          }
        }
      } catch (error) {
        // If not JSON, treat as raw output
        if (xterm.current) {
          xterm.current.write(event.data);
        }
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      wsRef.current = null;
      if (xterm.current) {
        xterm.current.writeln(`\r\n\x1b[31mWebSocket error occurred\x1b[0m`);
      }
    };

    websocket.onclose = (event) => {
      // console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;
      if (xterm.current) {
        xterm.current.writeln(`\r\n\x1b[31mDisconnected from pod ${pod}\x1b[0m`);
      }
    };
  };

  const disconnectFromPod = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const handleTerminalInput = (data: string) => {
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // console.log('Cannot send input - WebSocket not connected or not open');
      return;
    }

    // Handle special terminal control sequences
    // This includes Ctrl+L (clear screen), Ctrl+C (interrupt), etc.
    if (data.length === 1) {
      const charCode = data.charCodeAt(0);
      
      // Ctrl+L (form feed) - clear screen
      if (charCode === 12) {
        // Clear the terminal screen locally
        if (xterm.current) {
          xterm.current.clear();
        }
        // Still send to backend for proper terminal behavior
      }
      // Ctrl+C (ETX) - interrupt
      else if (charCode === 3) {
        // Let the backend handle the interrupt
        // console.log('Ctrl+C detected - sending interrupt signal');
      }
      // Ctrl+D (EOT) - end of transmission
      else if (charCode === 4) {
        // Let the backend handle the EOF
        // console.log('Ctrl+D detected - sending EOF signal');
      }
      // Ctrl+Z (SUB) - suspend
      else if (charCode === 26) {
        // Let the backend handle the suspend
        // console.log('Ctrl+Z detected - sending suspend signal');
      }
    }
    // Handle ANSI escape sequences for clear screen
    else if (data === '\x1b[2J' || data === '\x1b[H\x1b[2J') {
      // ANSI clear screen sequence
      if (xterm.current) {
        xterm.current.clear();
      }
      // Still send to backend for proper terminal behavior
    }

    // Send input to WebSocket
    const message = JSON.stringify({
      input: data
    });
    
    try {
      wsRef.current.send(message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      // Update connection state if send fails
      setIsConnected(false);
      wsRef.current = null;
    }
  };

  // Handle container change
  const handleContainerChange = (newContainer: string) => {
    if (isConnected) {
      // Disconnect first if connected
      disconnectFromPod();
    }
    setSelectedContainer(newContainer);
  };

  return (
    <div className="pod-exec flex-col md:flex border rounded-lg">
      <div className="flex items-start justify-between py-4 flex-row items-center h-10 border-b bg-muted/50">
        <div className="mx-2 flex basis-9/12 space-x-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="container" className="text-xs">Container:</Label>
            <Select value={selectedContainer} onValueChange={handleContainerChange}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Select container" />
              </SelectTrigger>
              <SelectContent>
                {containerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="command" className="text-xs">Command:</Label>
            <Input
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-32 h-8 text-xs"
              placeholder="/bin/sh"
              disabled={isConnected}
            />
          </div>

          {!isConnected ? (
            <Button
              onClick={connectToPod}
              className="h-8 text-xs"
              disabled={!selectedContainer}
            >
              Connect
            </Button>
          ) : (
            <Button
              onClick={disconnectFromPod}
              variant="destructive"
              className="h-8 text-xs"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>
      
      <div ref={execContainerRef} className="m-2">
        <XtermTerminal
          containerNameProp={selectedContainer}
          xterm={xterm}
          searchAddonRef={searchAddonRef}
          updateLogs={() => {}} // Not used for exec
          onInput={handleTerminalInput}
        />
      </div>
    </div>
  );
} 