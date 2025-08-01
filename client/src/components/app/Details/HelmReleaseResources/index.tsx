import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/redux/hooks';
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
  ExternalLinkIcon,
  UpdateIcon
} from '@radix-ui/react-icons';
import { fetchHelmReleaseResources } from '@/data/Helm/HelmReleaseResourcesSlice';
import { RootState } from '@/redux/store';
import { HelmReleaseResource } from '@/types';
import {
  DEPLOYMENT_ENDPOINT,
  SERVICES_ENDPOINT,
  CONFIG_MAPS_ENDPOINT,
  SECRETS_ENDPOINT,
  INGRESSES_ENDPOINT,
  PERSISTENT_VOLUME_CLAIMS_ENDPOINT,
  SERVICE_ACCOUNTS_ENDPOINT,
  ROLES_ENDPOINT,
  ROLE_BINDINGS_ENDPOINT,
  DAEMON_SETS_ENDPOINT,
  STATEFUL_SETS_ENDPOINT,
  REPLICA_SETS_ENDPOINT,
  JOBS_ENDPOINT,
  CRON_JOBS_ENDPOINT,
  HPA_ENDPOINT,
  CLUSTER_ROLES_ENDPOINT,
  CLUSTER_ROLE_BINDINGS_ENDPOINT,
  RESOURCE_QUOTAS_ENDPOINT,
  POD_DISRUPTION_BUDGETS_ENDPOINT,
  PRIORITY_CLASSES_ENDPOINT,
  ENDPOINTS_ENDPOINT,
  LEASES_ENDPOINT,
  PODS_ENDPOINT,
  NODES_ENDPOINT,
  NAMESPACES_ENDPOINT,
  STORAGE_CLASSES_ENDPOINT,
  PERSISTENT_VOLUMES_ENDPOINT,
  HELM_RELEASES_ENDPOINT,
} from '@/constants/ApiConstants';

interface HelmReleaseResourcesProps {
  name: string;
  configName: string;
  clusterName: string;
  namespace: string;
}

export function HelmReleaseResources({ name, configName, clusterName, namespace }: HelmReleaseResourcesProps) {
  const dispatch = useAppDispatch();
  const [selectedResourceType, setSelectedResourceType] = useState<string>('all');
  
  const { resources, loading, error } = useSelector((state: RootState) => state.helmReleaseResources);

  // Fetch resources when component mounts or props change
  useEffect(() => {
    // Only fetch if we don't already have data for this release
    if (!resources || !resources.resources) {
      console.log('Fetching Helm release resources for:', name);
      dispatch(fetchHelmReleaseResources({
        config: configName,
        cluster: clusterName,
        releaseName: name,
        namespace: namespace
      }));
    } else {
      console.log('Using cached Helm release resources for:', name);
    }
  }, [dispatch, configName, clusterName, name, namespace, resources]);

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
      case 'ingress':
        return <GearIcon className="h-4 w-4" />;
      case 'persistentvolumeclaim':
        return <LayersIcon className="h-4 w-4" />;
      case 'serviceaccount':
        return <LayersIcon className="h-4 w-4" />;
      case 'role':
        return <LayersIcon className="h-4 w-4" />;
      case 'rolebinding':
        return <LayersIcon className="h-4 w-4" />;
      case 'daemonset':
        return <CubeIcon className="h-4 w-4" />;
      case 'statefulset':
        return <CubeIcon className="h-4 w-4" />;
      case 'replicaset':
        return <CubeIcon className="h-4 w-4" />;
      case 'job':
        return <CubeIcon className="h-4 w-4" />;
      case 'cronjob':
        return <CubeIcon className="h-4 w-4" />;
      case 'horizontalpodautoscaler':
        return <GearIcon className="h-4 w-4" />;
      default:
        return <CubeIcon className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
      case 'completed':
        return <CheckCircledIcon className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'failed':
      case 'stopped':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'failed':
      case 'stopped':
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
      case 'ingress':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'persistentvolumeclaim':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300';
      case 'serviceaccount':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'role':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'rolebinding':
        return 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300';
      case 'daemonset':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'statefulset':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'replicaset':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'job':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'cronjob':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'horizontalpodautoscaler':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getResourceKindEndpoint = (kind: string): string => {
    const kindMap: Record<string, string> = {
      'deployment': DEPLOYMENT_ENDPOINT,
      'service': SERVICES_ENDPOINT,
      'configmap': CONFIG_MAPS_ENDPOINT,
      'secret': SECRETS_ENDPOINT,
      'ingress': INGRESSES_ENDPOINT,
      'persistentvolumeclaim': PERSISTENT_VOLUME_CLAIMS_ENDPOINT,
      'serviceaccount': SERVICE_ACCOUNTS_ENDPOINT,
      'role': ROLES_ENDPOINT,
      'rolebinding': ROLE_BINDINGS_ENDPOINT,
      'daemonset': DAEMON_SETS_ENDPOINT,
      'statefulset': STATEFUL_SETS_ENDPOINT,
      'replicaset': REPLICA_SETS_ENDPOINT,
      'job': JOBS_ENDPOINT,
      'cronjob': CRON_JOBS_ENDPOINT,
      'horizontalpodautoscaler': HPA_ENDPOINT,
      'clusterrole': CLUSTER_ROLES_ENDPOINT,
      'clusterrolebinding': CLUSTER_ROLE_BINDINGS_ENDPOINT,
      'resourcequota': RESOURCE_QUOTAS_ENDPOINT,
      'poddisruptionbudget': POD_DISRUPTION_BUDGETS_ENDPOINT,
      'priorityclass': PRIORITY_CLASSES_ENDPOINT,
      'endpoint': ENDPOINTS_ENDPOINT,
      'lease': LEASES_ENDPOINT,
      'pod': PODS_ENDPOINT,
      'node': NODES_ENDPOINT,
      'namespace': NAMESPACES_ENDPOINT,
      'storageclass': STORAGE_CLASSES_ENDPOINT,
      'persistentvolume': PERSISTENT_VOLUMES_ENDPOINT,
      'helmrelease': HELM_RELEASES_ENDPOINT,
    };
    
    return kindMap[kind.toLowerCase()] || kind.toLowerCase();
  };

  const getResourceDetailsUrl = (resource: HelmReleaseResource) => {
    if (!resource || !resource.kind || !resource.name) {
      return '#';
    }
    
    const resourceKind = getResourceKindEndpoint(resource.kind);
    const resourceName = encodeURIComponent(resource.name);
    const resourceNamespace = encodeURIComponent(resource.namespace || namespace);
    const encodedClusterName = encodeURIComponent(clusterName);
    const encodedConfigName = encodeURIComponent(configName);
    
    return `/${encodedConfigName}/details?cluster=${encodedClusterName}&resourcekind=${resourceKind}&resourcename=${resourceName}&namespace=${resourceNamespace}`;
  };

  // Handle loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Release Resources</h3>
            <p className="text-sm text-muted-foreground">
              Kubernetes resources managed by {name}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <UpdateIcon className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading resources... This may take a few moments for large releases.</span>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Release Resources</h3>
            <p className="text-sm text-muted-foreground">
              Kubernetes resources managed by {name}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
          <span className="ml-2 text-red-600">Error loading resources: {error}</span>
        </div>
      </div>
    );
  }

  // Handle no data state
  if (!resources || !resources.resources || !Array.isArray(resources.resources)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Release Resources</h3>
            <p className="text-sm text-muted-foreground">
              Kubernetes resources managed by {name}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <CubeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No resources found for this release</p>
        </div>
      </div>
    );
  }

  const filteredResources = selectedResourceType === 'all' 
    ? resources.resources 
    : resources.resources.filter(resource => resource.kind.toLowerCase() === selectedResourceType.toLowerCase());

  const resourceTypes = Array.from(new Set(resources.resources.map(r => r.kind)));

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
          {resources.total || 0} resource{(resources.total || 0) !== 1 ? 's' : ''}
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
                {resources.summary?.byType && Object.entries(resources.summary.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getResourceIcon(type)}
                      <span className="text-sm font-medium">{type}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Resources</span>
                  <span className="font-medium">{resources.total || 0}</span>
                </div>
                {resources.summary?.byStatus && Object.entries(resources.summary.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{status}</span>
                    <span className={`font-medium ${getStatusColor(status).split(' ')[1]}`}>
                      {count}
                    </span>
                  </div>
                ))}
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
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="space-y-4">
                  {filteredResources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CubeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No resources found for the selected type</p>
                    </div>
                  ) : (
                    filteredResources.filter(resource => resource && resource.kind && resource.name).map((resource) => (
                        <div key={`${resource.kind}-${resource.name}`} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              {getResourceIcon(resource.kind || 'unknown')}
                              <div>
                                <h4 className="font-medium">{resource.name || 'Unknown'}</h4>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge className={`text-xs ${getResourceTypeColor(resource.kind || 'unknown')}`}>
                                    {resource.kind || 'Unknown'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {resource.age || 'Unknown'} old
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(resource.status || 'unknown')}
                              <Badge className={`text-xs ${getStatusColor(resource.status || 'unknown')}`}>
                                {resource.status || 'Unknown'}
                              </Badge>
                            </div>
                            
                            {resource && resource.kind && resource.name ? (
                              <Link to={getResourceDetailsUrl(resource)}>
                                <Button variant="outline" size="sm">
                                  <ExternalLinkIcon className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              </Link>
                            ) : (
                              <Button variant="outline" size="sm" disabled>
                                <ExternalLinkIcon className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            )}
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
    </div>
  );
} 