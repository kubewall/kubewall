import { useState } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ClockIcon, CheckCircledIcon, CrossCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import { HelmReleaseHistory as HelmReleaseHistoryType } from '@/types/helm';

interface HelmReleaseHistoryProps {
  name: string;
  configName: string;
  clusterName: string;
  namespace: string;
}

export function HelmReleaseHistory({ name }: HelmReleaseHistoryProps) {
  const { details } = useAppSelector((state) => state.helmReleaseDetails);
  const [selectedRevision, setSelectedRevision] = useState<HelmReleaseHistoryType | null>(null);

  const history = details?.history || [];

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
    return new Date(dateString).toLocaleString();
  };

  const handleRollback = (revision: number) => {
    toast.info('Rollback functionality coming soon', {
      description: `Rollback to revision ${revision} will be implemented in a future update.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Release History</h3>
          <p className="text-sm text-muted-foreground">
            {history.length} revision{history.length !== 1 ? 's' : ''} for {name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Timeline */}
        <div className="lg:col-span-2 h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revision Timeline</CardTitle>
              <CardDescription>History of all releases and their status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
                <div className="space-y-4 p-6 pb-8">
                  {history.map((revision: HelmReleaseHistoryType, index: number) => (
                    <div key={revision.revision} className="relative">
                      {/* Timeline connector */}
                      {index < history.length - 1 && (
                        <div className="absolute left-6 top-8 w-0.5 h-16 bg-gray-200 dark:bg-gray-700" />
                      )}
                      
                      <div className="flex items-start space-x-4">
                        {/* Status indicator */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            {getStatusIcon(revision.status)}
                          </div>
                        </div>

                        {/* Revision content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-medium">
                                Revision {revision.revision}
                              </h4>
                              {revision.isLatest && (
                                <Badge variant="secondary" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <Badge className={`text-xs ${getStatusColor(revision.status)}`}>
                              {revision.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(revision.updated)}
                          </p>
                          
                          {revision.description && (
                            <p className="text-sm mt-2">{revision.description}</p>
                          )}
                          
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              Chart: {revision.chart} v{revision.appVersion}
                            </span>
                          </div>

                          <div className="flex space-x-2 mt-3 mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRevision(revision)}
                            >
                              View Details
                            </Button>
                            {!revision.isLatest && revision.status === 'deployed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRollback(revision.revision)}
                              >
                                Rollback
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Revision Details */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revision Details</CardTitle>
              <CardDescription>
                {selectedRevision ? `Revision ${selectedRevision.revision}` : 'Select a revision to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {selectedRevision ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Revision {selectedRevision.revision}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(selectedRevision.updated)}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(selectedRevision.status)}
                        <Badge className={getStatusColor(selectedRevision.status)}>
                          {selectedRevision.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Chart</label>
                      <p className="text-sm mt-1">{selectedRevision.chart}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">App Version</label>
                      <p className="text-sm mt-1">{selectedRevision.appVersion}</p>
                    </div>

                    {selectedRevision.description && (
                      <div>
                        <label className="text-sm font-medium">Description</label>
                        <p className="text-sm mt-1">{selectedRevision.description}</p>
                      </div>
                    )}

                    {selectedRevision.isLatest && (
                      <div className="pt-2">
                        <Badge variant="secondary">Current Revision</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClockIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a revision from the timeline to view its details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 