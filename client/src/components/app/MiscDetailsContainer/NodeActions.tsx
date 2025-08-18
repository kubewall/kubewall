import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  cordonNode, 
  uncordonNode, 
  drainNode, 
  checkNodeActionPermission,
  resetNodeActions,
  NodeActionRequest 
} from '@/data/Clusters/Nodes/NodeActionsSlice';
import { updateNodeDetails } from '@/data/Clusters/Nodes/NodeDetailsSlice';
import { createEventStreamQueryObject } from '@/utils';
import { toast } from 'sonner';
import { API_VERSION } from '@/constants';
import kwFetch from '@/data/kwFetch';
import { 
  ShieldXIcon, 
  ShieldCheckIcon, 
  ZapIcon, 
  Loader2Icon,
  AlertTriangleIcon,
  CircleIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NodeActionsProps {
  nodeName: string;
  config: string;
  cluster: string;
}

const NodeActions: React.FC<NodeActionsProps> = ({ 
  nodeName, 
  config, 
  cluster
}) => {
  const dispatch = useAppDispatch();
  const { loading, error, response, permissions, checkingPermissions } = useAppSelector((state) => state.nodeActions);
  const { nodeDetails } = useAppSelector((state) => state.nodeDetails);
  
  // Get node state from Redux store
  const isCordoned = nodeDetails?.spec?.unschedulable || false;
  
  const [cordonDialogOpen, setCordonDialogOpen] = useState(false);
  const [uncordonDialogOpen, setUncordonDialogOpen] = useState(false);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
  const [drainOptions, setDrainOptions] = useState<NodeActionRequest>({
    force: false,
    ignoreDaemonSets: true,
    deleteEmptyDirData: false,
    gracePeriod: 30,
  });

  const queryParams = useMemo(() => {
    return createEventStreamQueryObject(config, cluster);
  }, [config, cluster]);

  // Check permissions for all actions
  useEffect(() => {
    const actions = ['cordon', 'uncordon', 'drain'];
    actions.forEach(action => {
      dispatch(checkNodeActionPermission({
        action,
        nodeName,
        queryParams: new URLSearchParams(queryParams).toString()
      }));
    });
  }, [dispatch, nodeName, queryParams]);

  // Handle success/error responses
  useEffect(() => {
    if (response) {
      toast.success('Success', {
        description: response.message,
      });
      dispatch(resetNodeActions());
      
      // Close dialogs
      setCordonDialogOpen(false);
      setUncordonDialogOpen(false);
      setDrainDialogOpen(false);
      
      // Refresh node details to update the UI
      const refreshNodeDetails = async () => {
        try {
          const url = `${API_VERSION}/nodes/${nodeName}?${new URLSearchParams(queryParams).toString()}`;
          const updatedNode = await kwFetch(url, { method: 'GET' });
          dispatch(updateNodeDetails(updatedNode));
        } catch (error) {
          console.error('Failed to refresh node details:', error);
        }
      };
      
      refreshNodeDetails();
    }
  }, [response, dispatch, nodeName, queryParams]);

  useEffect(() => {
    if (error) {
      toast.error('Error', {
        description: error.message || 'Action failed',
      });
      dispatch(resetNodeActions());
    }
  }, [error, dispatch]);

  const getPermission = (action: string) => {
    const key = `${action}-${nodeName}`;
    return permissions[key];
  };

  const handleCordon = () => {
    dispatch(cordonNode({
      nodeName,
      queryParams: new URLSearchParams(queryParams).toString()
    }));
  };

  const handleUncordon = () => {
    dispatch(uncordonNode({
      nodeName,
      queryParams: new URLSearchParams(queryParams).toString()
    }));
  };

  const handleDrain = () => {
    dispatch(drainNode({
      nodeName,
      queryParams: new URLSearchParams(queryParams).toString(),
      options: drainOptions
    }));
  };

  const cordonPermission = getPermission('cordon');
  const uncordonPermission = getPermission('uncordon');
  const drainPermission = getPermission('drain');

  return (
    <div className="flex items-center gap-2">
      {/* Node Status Indicator */}
      <div className="flex items-center gap-1">
        <Badge 
          variant={isCordoned ? "destructive" : "default"} 
          className="text-xs px-2 py-0.5"
        >
          <CircleIcon className="h-2 w-2 mr-1" />
          {isCordoned ? "Cordoned" : "Ready"}
        </Badge>
      </div>
      
      {/* Cordon Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Dialog open={cordonDialogOpen} onOpenChange={setCordonDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant={isCordoned ? "destructive" : "outline"}
                  size="sm"
                  disabled={loading || checkingPermissions || !cordonPermission?.allowed || isCordoned}
                  className="h-8 px-2 gap-1"
                >
                  {loading ? (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldXIcon className="h-3 w-3" />
                  )}
                  <span className="text-xs">Cordon</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cordon Node</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to cordon node <strong>{nodeName}</strong>? 
                    This will mark the node as unschedulable, preventing new pods from being scheduled on it.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCordonDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCordon} disabled={loading}>
                    {loading ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      'Cordon Node'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TooltipTrigger>
          <TooltipContent>
            {checkingPermissions
              ? 'Checking permissions...'
              : !cordonPermission?.allowed
                ? "You don't have permission to cordon this node"
                : isCordoned
                  ? 'Node is already cordoned'
                  : 'Mark node as unschedulable'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Uncordon Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Dialog open={uncordonDialogOpen} onOpenChange={setUncordonDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant={!isCordoned ? "destructive" : "outline"}
                  size="sm"
                  disabled={loading || checkingPermissions || !uncordonPermission?.allowed || !isCordoned}
                  className="h-8 px-2 gap-1"
                >
                  {loading ? (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldCheckIcon className="h-3 w-3" />
                  )}
                  <span className="text-xs">Uncordon</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Uncordon Node</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to uncordon node <strong>{nodeName}</strong>? 
                    This will mark the node as schedulable again, allowing new pods to be scheduled on it.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUncordonDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUncordon} disabled={loading}>
                    {loading ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      'Uncordon Node'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TooltipTrigger>
          <TooltipContent>
            {checkingPermissions
              ? 'Checking permissions...'
              : !uncordonPermission?.allowed
                ? "You don't have permission to uncordon this node"
                : !isCordoned
                  ? 'Node is not cordoned'
                  : 'Mark node as schedulable'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Drain Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Dialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || checkingPermissions || !drainPermission?.allowed}
                  className="h-8 px-2 gap-1 text-destructive hover:text-destructive border-destructive hover:border-destructive"
                >
                  {loading ? (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  ) : (
                    <ZapIcon className="h-3 w-3" />
                  )}
                  <span className="text-xs">Drain</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Drain Node</DialogTitle>
                  <DialogDescription>
                    Drain node <strong>{nodeName}</strong> to safely remove all pods from it. 
                    This will evict all pods and mark the node as unschedulable.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>
                      This action will evict all pods from the node. Make sure you have sufficient capacity in your cluster.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ignoreDaemonSets"
                        checked={drainOptions.ignoreDaemonSets}
                        onCheckedChange={(checked) => 
                          setDrainOptions(prev => ({ ...prev, ignoreDaemonSets: checked as boolean }))
                        }
                      />
                      <Label htmlFor="ignoreDaemonSets">Ignore DaemonSets</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="force"
                        checked={drainOptions.force}
                        onCheckedChange={(checked) => 
                          setDrainOptions(prev => ({ ...prev, force: checked as boolean }))
                        }
                      />
                      <Label htmlFor="force">Force (ignore errors)</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="deleteEmptyDirData"
                        checked={drainOptions.deleteEmptyDirData}
                        onCheckedChange={(checked) => 
                          setDrainOptions(prev => ({ ...prev, deleteEmptyDirData: checked as boolean }))
                        }
                      />
                      <Label htmlFor="deleteEmptyDirData">Delete empty directory data</Label>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="gracePeriod">Grace Period (seconds)</Label>
                      <Input
                        id="gracePeriod"
                        type="number"
                        min="0"
                        value={drainOptions.gracePeriod}
                        onChange={(e) => 
                          setDrainOptions(prev => ({ ...prev, gracePeriod: parseInt(e.target.value) || 30 }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDrainDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDrain} disabled={loading}>
                    {loading ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      'Drain Node'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TooltipTrigger>
          <TooltipContent>
            {checkingPermissions
              ? 'Checking permissions...'
              : !drainPermission?.allowed
                ? "You don't have permission to drain this node"
                : 'Evict all pods from the node'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default NodeActions;
