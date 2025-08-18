import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { toast } from "sonner";
import { ArrowRightIcon } from "@radix-ui/react-icons";

interface ContainerPort {
  containerPort: number;
  protocol?: string;
  name?: string;
}

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

interface PortForwardDialogProps {
  resourceType: string;
  resourceName: string;
  namespace: string;
  configName: string;
  clusterName: string;
  podDetails?: any; // Pod details to extract container ports
}

export function PortForwardDialog({ 
  resourceType, 
  resourceName, 
  namespace, 
  configName, 
  clusterName,
  podDetails 
}: PortForwardDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localPort, setLocalPort] = useState<number>(0);
  const [remotePort, setRemotePort] = useState<number>(0);
  const [protocol, setProtocol] = useState<string>("TCP");
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeSessions, setActiveSessions] = useState<PortForwardSession[]>([]);
  const [containerPorts, setContainerPorts] = useState<ContainerPort[]>([]);
  const [selectedContainerPort, setSelectedContainerPort] = useState<ContainerPort | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Extract container ports from pod details
  useEffect(() => {
    if (podDetails?.spec?.containers) {
      const ports: ContainerPort[] = [];
      podDetails.spec.containers.forEach((container: any) => {
        if (container.ports) {
          container.ports.forEach((port: any) => {
            ports.push({
              containerPort: port.containerPort,
              protocol: port.protocol || 'TCP',
              name: port.name
            });
          });
        }
      });
      setContainerPorts(ports);
      
      // Set default remote port to first available port
      if (ports.length > 0 && remotePort === 0) {
        setSelectedContainerPort(ports[0]);
        setRemotePort(ports[0].containerPort);
        setProtocol(ports[0].protocol || 'TCP');
      }
    }
  }, [podDetails, remotePort]);

  // Fetch active sessions when dialog opens and poll for updates
  useEffect(() => {
    if (isOpen) {
      fetchActiveSessions();
      
      // Poll for updates every 2 seconds to catch local port detection
      const interval = setInterval(() => {
        fetchActiveSessions();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);

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

  const handleContainerPortChange = (portStr: string) => {
    const port = containerPorts.find(p => p.containerPort.toString() === portStr);
    if (port) {
      setSelectedContainerPort(port);
      setRemotePort(port.containerPort);
      setProtocol(port.protocol || 'TCP');
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
      fetchActiveSessions();
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
        } else if (data.type === 'port_assigned') {
          const localPort = data.localPort;
          if (localPort && localPort > 0) {
            toast.success(`Port assigned: localhost:${localPort}`);
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
        } else if (data.type === 'status_update') {
          const status = data.session?.status;
          const localPort = data.session?.localPort;
          if (status === 'running' && localPort && localPort > 0) {
            toast.success(`Port forward running on localhost:${localPort}`);
          }
          fetchActiveSessions();
        } else if (data.type === 'error') {
          toast.error(`Port forward error: ${data.error || data.message}`);
          setIsConnecting(false);
        } else if (data.type === 'heartbeat') {
          // Heartbeat received, connection is still active
          console.log('Port forward heartbeat received');
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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form when dialog closes
      setLocalPort(0);
      if (containerPorts.length > 0) {
        setSelectedContainerPort(containerPorts[0]);
        setRemotePort(containerPorts[0].containerPort);
        setProtocol(containerPorts[0].protocol || 'TCP');
      } else {
        setRemotePort(0);
        setProtocol('TCP');
      }
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowRightIcon className="h-4 w-4" />
          Port Forward
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Port Forward - {resourceName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Create New Port Forward */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Create Port Forward</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="localPort">Local Port (0 = auto-assign)</Label>
                <Input
                  id="localPort"
                  type="number"
                  value={localPort}
                  onChange={(e) => setLocalPort(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  max="65535"
                />
                <p className="text-xs text-muted-foreground">
                  Leave as 0 to automatically assign an available port
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="remotePort">Remote Port *</Label>
                {containerPorts.length > 0 ? (
                  <Select 
                    value={selectedContainerPort?.containerPort.toString() || ''} 
                    onValueChange={handleContainerPortChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select container port" />
                    </SelectTrigger>
                    <SelectContent>
                      {containerPorts.map((port) => (
                        <SelectItem 
                          key={port.containerPort} 
                          value={port.containerPort.toString()}
                        >
                          {port.containerPort} {port.name ? `(${port.name})` : ''} - {port.protocol || 'TCP'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
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
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p><strong>Resource:</strong> {resourceType} {resourceName} in {namespace}</p>
              <p><strong>Cluster:</strong> {clusterName}</p>
              {localPort === 0 && (
                <p className="text-amber-600 mt-2">
                  <strong>Note:</strong> Local port will be automatically assigned and displayed once the connection is established.
                </p>
              )}
              <p className="text-blue-600 mt-2">
                <strong>Auto-timeout:</strong> Port forward sessions will automatically stop after 30 minutes of inactivity.
              </p>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Active Port Forwards</h3>
            
            {activeSessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active port forward sessions</p>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
