import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Link } from '@tanstack/react-router';
import { 
  CubeIcon, 
  GearIcon, 
  LayersIcon, 
  ExclamationTriangleIcon,
  CheckCircledIcon,
  ClockIcon,
  ExternalLinkIcon
} from '@radix-ui/react-icons';

interface HelmReleaseResourcesProps {
  name: string;
  configName: string;
  clusterName: string;
  namespace: string;
}

interface ResourceItem {
  name: string;
  kind: string;
  status: string;
  age: string;
  namespace?: string;
}

export function HelmReleaseResources({ name, configName, clusterName, namespace }: HelmReleaseResourcesProps) {
  const [selectedResourceType, setSelectedResourceType] = useState<string>('all');
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Mock data - in a real implementation, this would come from the API
  useEffect(() => {
    // Simulate fetching resources based on the release
    const mockResources: ResourceItem[] = [
      {
        name: 'agent',
        kind: 'Deployment',
        status: 'Running',
        age: '2d',
        namespace: namespace
      },
      {
        name: 'agent-service',
        kind: 'Service',
        status: 'Active',
        age: '2d',
        namespace: namespace
      },
      {
        name: 'agent-config',
        kind: 'ConfigMap',
        status: 'Active',
        age: '2d',
        namespace: namespace
      },
      {
        name: 'agent-secret',
        kind: 'Secret',
        status: 'Active',
        age: '2d',
        namespace: namespace
      }
    ];

    setResources(mockResources);
  }, [name, namespace]);

  const getResourceIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'deployment':
        return <CubeIcon className="h-4 w-4" />;
      case 'service':
        return <GearIcon className="h-4 w-4" />;
      case 'configmap':
        return <LayersIcon className="h-4 w-4" />;
      case 'secret':
        return <LayersIcon className="h-4 w-4" />;
      default:
        return <CubeIcon className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
        return <CheckCircledIcon className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getResourceTypeColor = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'deployment':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'service':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'configmap':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'secret':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const filteredResources = selectedResourceType === 'all' 
    ? resources 
    : resources.filter(resource => resource.kind.toLowerCase() === selectedResourceType.toLowerCase());

  const resourceTypes = Array.from(new Set(resources.map(r => r.kind)));

  const getResourceDetailsUrl = (resource: ResourceItem) => {
    const resourceKind = resource.kind.toLowerCase();
    const resourceName = resource.name;
    const resourceNamespace = resource.namespace || namespace;
    
    return `/${configName}/details?cluster=${clusterName}&resourcekind=${resourceKind}&resourcename=${resourceName}&namespace=${resourceNamespace}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Release Resources</h3>
          <p className="text-sm text-muted-foreground">
            Kubernetes resources managed by {name}
          </p>
        </div>
        <Badge variant="outline">
          {resources.length} resource{resources.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Resource Summary */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resource Types</CardTitle>
              <CardDescription>Resources created by this release</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resourceTypes.map(type => {
                  const count = resources.filter(r => r.kind === type).length;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getResourceIcon(type)}
                        <span className="text-sm font-medium">{type}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Resources</span>
                  <span className="font-medium">{resources.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Running</span>
                  <span className="font-medium text-green-600">
                    {resources.filter(r => r.status.toLowerCase() === 'running' || r.status.toLowerCase() === 'active').length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-medium text-yellow-600">
                    {resources.filter(r => r.status.toLowerCase() === 'pending').length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Failed</span>
                  <span className="font-medium text-red-600">
                    {resources.filter(r => r.status.toLowerCase() === 'failed').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resources List */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resources</CardTitle>
                  <CardDescription>
                    Kubernetes resources managed by this Helm release
                  </CardDescription>
                </div>
                <Tabs value={selectedResourceType} onValueChange={setSelectedResourceType}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    {resourceTypes.slice(0, 3).map(type => (
                      <TabsTrigger key={type} value={type.toLowerCase()}>
                        {type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredResources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CubeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No resources found for the selected type</p>
                    </div>
                  ) : (
                    filteredResources.map((resource) => (
                      <div key={`${resource.kind}-${resource.name}`} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              {getResourceIcon(resource.kind)}
                              <div>
                                <h4 className="font-medium">{resource.name}</h4>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge className={`text-xs ${getResourceTypeColor(resource.kind)}`}>
                                    {resource.kind}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {resource.age} old
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(resource.status)}
                              <Badge className={`text-xs ${getStatusColor(resource.status)}`}>
                                {resource.status}
                              </Badge>
                            </div>
                            
                            <Link to={getResourceDetailsUrl(resource)}>
                              <Button variant="outline" size="sm">
                                <ExternalLinkIcon className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resource Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resource Management</CardTitle>
          <CardDescription>Actions for managing release resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button variant="outline" disabled>
              Scale Resources
            </Button>
            <Button variant="outline" disabled>
              Restart Resources
            </Button>
            <Button variant="outline" disabled>
              View Logs
            </Button>
            <Button variant="outline" disabled>
              Resource Events
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Advanced resource management features will be available in future updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 