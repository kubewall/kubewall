import { useAppSelector } from '@/redux/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Link } from '@tanstack/react-router';
import { 
  ClockIcon, 
  CheckCircledIcon, 
  CrossCircledIcon, 
  ExclamationTriangleIcon,
  CubeIcon,
  ExternalLinkIcon
} from '@radix-ui/react-icons';

export function HelmReleaseOverview() {
  const { details } = useAppSelector((state) => state.helmReleaseDetails);
  
  if (!details) return null;

  const { release, history } = details;
  const recentHistory = history?.slice(0, 5) || [];
  const deployments = release?.deployments || [];

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'deployed':
        return <CheckCircledIcon className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <CrossCircledIcon className="h-4 w-4 text-red-500" />;
      case 'superseded':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'deployed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'superseded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDeploymentUrl = (deploymentName: string) => {
    return `/${details.release.namespace}/details?cluster=${details.release.namespace}&resourcekind=deployments&resourcename=${deploymentName}&namespace=${details.release.namespace}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Recent History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent History</CardTitle>
          <CardDescription>Last 5 revisions</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {recentHistory.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No history available</p>
                </div>
              ) : (
                recentHistory.map((revision: any) => (
                  <div key={revision.revision} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(revision.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Revision {revision.revision}</span>
                          {revision.isLatest && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(revision.updated)}
                        </p>
                        {revision.description && (
                          <p className="text-sm mt-1">{revision.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs ${getStatusColor(revision.status)}`}>
                      {revision.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Deployments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Deployments</CardTitle>
          <CardDescription>Kubernetes deployments managed by this release</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {deployments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CubeIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No deployments found</p>
                </div>
              ) : (
                deployments.map((deployment: string) => (
                  <div key={deployment} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CubeIcon className="h-4 w-4 text-blue-500" />
                      <div>
                        <span className="font-medium">{deployment}</span>
                        <p className="text-sm text-muted-foreground">
                          Deployment
                        </p>
                      </div>
                    </div>
                    <Link to={getDeploymentUrl(deployment)}>
                      <Button variant="outline" size="sm">
                        <ExternalLinkIcon className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Release Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Release Statistics</CardTitle>
          <CardDescription>Summary of release information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {history?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Revisions</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {deployments.length}
                </div>
                <div className="text-sm text-muted-foreground">Deployments</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Status</span>
                <Badge className={getStatusColor(release?.status || '')}>
                  {release?.status || 'Unknown'}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Chart Version</span>
                <span className="font-medium">{release?.version || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>App Version</span>
                <span className="font-medium">{release?.appVersion || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Last Updated</span>
                <span className="font-medium">
                  {release?.updated ? formatDate(release.updated) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Actions</CardTitle>
          <CardDescription>Common operations for this release</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" disabled>
              <ClockIcon className="h-4 w-4 mr-2" />
              Rollback to Previous Revision
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <CubeIcon className="h-4 w-4 mr-2" />
              Upgrade Release
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              Uninstall Release
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <CheckCircledIcon className="h-4 w-4 mr-2" />
              Test Release
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Advanced Helm operations will be available in future updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 