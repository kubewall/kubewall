import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { toast } from "sonner";

interface PortForwardSession {
  id: string;
  resourceType: string;
  resourceName: string;
  namespace: string;
  localPort: number;
  remotePort: number;
  protocol: string;
  status: string;
  createdAt: string;
  configId: string;
  cluster: string;
}

interface PortForwardProps {
  resourceType: string;
  resourceName: string;
  namespace: string;
  configName: string;
  clusterName: string;
}

export function PortForward({ resourceType, resourceName, namespace, configName, clusterName }: PortForwardProps) {
  const [localPort, setLocalPort] = useState<number>(0);
  const [remotePort, setRemotePort] = useState<number>(80);
  const [protocol, setProtocol] = useState<string>("TCP");
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeSessions, setActiveSessions] = useState<PortForwardSession[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch active sessions on component mount
  useEffect(() => {
    fetchActiveSessions();
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch(`/api/v1/portforward/sessions?config=${configName}&cluster=${clusterName}`);
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch active sessions:', error);
    }
  };

  const startPortForward = () => {
    if (!remotePort) {
      toast.error("Remote port is required");
      return;
    }

    setIsConnecting(true);

    // Create WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/portforward/ws?` + 
      `resourceType=${resourceType}&resourceName=${resourceName}&namespace=${namespace}&` +
      `localPort=${localPort}&remotePort=${remotePort}&protocol=${protocol}&` +
      `config=${configName}&cluster=${clusterName}`;
    
    const websocket = new WebSocket(wsUrl);
    wsRef.current = websocket;
    
    websocket.onopen = () => {
      toast.success("Port forward connection established");
      setIsConnecting(false);
      fetchActiveSessions(); // Refresh sessions list
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Port forward WebSocket message:', data);
        
        if (data.type === 'session_created') {
          toast.success("Port forward session created successfully");
          fetchActiveSessions();
        } else if (data.type === 'status_update') {
          const status = data.session?.status;
          if (status === 'running') {
            const localPort = data.session?.localPort;
            if (localPort && localPort > 0) {
              toast.success(`Port forward running on localhost:${localPort}`);
            } else {
              toast.info(`Port forward status: ${status}`);
            }
          } else {
            toast.info(`Port forward status: ${status}`);
          }
          fetchActiveSessions();
        } else if (data.type === 'port_forward_started') {
          const message = data.message;
          const localPort = data.session?.localPort;
          if (localPort && localPort > 0) {
            toast.success(`Port forward started: localhost:${localPort} -> ${resourceName}:${remotePort}`);
          } else {
            toast.success(message || "Port forward started successfully");
          }
          fetchActiveSessions();
        } else if (data.type === 'error') {
          toast.error(`Port forward error: ${data.error || data.message}`);
          setIsConnecting(false);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error("Failed to establish port forward connection");
      setIsConnecting(false);
    };

    websocket.onclose = () => {
      toast.info("Port forward connection closed");
      setIsConnecting(false);
      fetchActiveSessions();
    };
  };

  const stopSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/v1/portforward/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success("Port forward session stopped");
        fetchActiveSessions();
      } else {
        toast.error("Failed to stop port forward session");
      }
    } catch (error) {
      console.error('Failed to stop session:', error);
      toast.error("Failed to stop port forward session");
    }
  };

  const getConnectionString = (session: PortForwardSession) => {
    const localPortStr = session.localPort > 0 ? session.localPort : 'auto';
    return `localhost:${localPortStr} -> ${session.resourceName}:${session.remotePort}`;
  };

  const getConnectionStringForCopy = (session: PortForwardSession) => {
    if (session.localPort > 0) {
      return `localhost:${session.localPort}`;
    }
    return 'localhost:auto';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-green-500">Running</Badge>;
      case 'connecting':
        return <Badge variant="secondary">Connecting</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="port-forward space-y-4">
      {/* Create New Port Forward */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create Port Forward</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="localPort">Local Port (0 = auto)</Label>
              <Input
                id="localPort"
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
                max="65535"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="remotePort">Remote Port *</Label>
              <Input
                id="remotePort"
                type="number"
                value={remotePort}
                onChange={(e) => setRemotePort(parseInt(e.target.value) || 0)}
                placeholder="80"
                min="1"
                max="65535"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select protocol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TCP">TCP</SelectItem>
                  <SelectItem value="UDP">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                onClick={startPortForward}
                disabled={isConnecting || !remotePort}
                className="w-full"
              >
                {isConnecting ? "Connecting..." : "Start Port Forward"}
              </Button>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Resource:</strong> {resourceType} {resourceName} in {namespace}</p>
            <p><strong>Cluster:</strong> {clusterName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Port Forwards</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <p className="text-muted-foreground">No active port forward sessions</p>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{session.resourceType}</span>
                      <span className="text-muted-foreground">{session.resourceName}</span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Connection:</span> {getConnectionString(session)}
                      {session.localPort > 0 && (
                        <CopyToClipboard val={getConnectionStringForCopy(session)} />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Created: {new Date(session.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => stopSession(session.id)}
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
