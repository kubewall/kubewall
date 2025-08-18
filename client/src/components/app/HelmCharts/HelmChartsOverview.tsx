import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MagnifyingGlassIcon, 
  DownloadIcon, 
  ExternalLinkIcon,
  ClockIcon,
  GlobeIcon,
  ReloadIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';
import { toast } from 'sonner';
import { HelmChart, HelmChartsSearchResponse } from '@/types/helm';
import { HELM_CHARTS_ENDPOINT } from '@/constants';
import { HelmChartInstallDialog } from './HelmChartInstallDialog';

import { useRouterState } from '@tanstack/react-router';

interface HelmChartsOverviewProps {
  onChartSelect?: (chart: HelmChart) => void;
}

export function HelmChartsOverview({ }: HelmChartsOverviewProps) {
  const [charts, setCharts] = useState<HelmChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCharts, setTotalCharts] = useState(0);
  const [selectedChart, setSelectedChart] = useState<HelmChart | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [installedCharts, setInstalledCharts] = useState<Set<string>>(new Set());

  const router = useRouterState();
  const configName = router.location.pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';


  const pageSize = 20;

  const searchCharts = async (query: string = '', page: number = 1) => {
    if (!clusterName || !configName) {
      toast.error('Please select a cluster first');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        cluster: clusterName,
        config: configName,
        page: page.toString(),
        size: pageSize.toString()
      });

      if (query.trim()) {
        params.append('q', query.trim());
      }

      const response = await fetch(`/api/v1/${HELM_CHARTS_ENDPOINT}?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch charts: ${response.statusText}`);
      }

      const data: HelmChartsSearchResponse = await response.json();
      setCharts(data.data || []);
      setTotalCharts(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching charts:', error);
      toast.error('Failed to fetch Helm charts', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      setCharts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchCharts();
    // Also load installed releases for indicator
    loadInstalledReleases();
  }, [clusterName, configName]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    searchCharts(searchQuery, 1);
  };

  const handlePageChange = (page: number) => {
    searchCharts(searchQuery, page);
  };

  const loadInstalledReleases = async () => {
    if (!clusterName || !configName) return;
    try {
      const params = new URLSearchParams({ cluster: clusterName, config: configName });
      const response = await fetch(`/api/v1/helmreleases?${params.toString()}`);
      if (!response.ok) return;
      const releases: Array<{ chart?: string }> = await response.json();
      const names = new Set<string>();
      releases?.forEach((r) => {
        if (r?.chart) names.add(r.chart.toLowerCase());
      });
      setInstalledCharts(names);
    } catch (e) {
      // Non-fatal for UI; ignore
    }
  };

  const handleInstallChart = (chart: HelmChart) => {
    setSelectedChart(chart);
    setShowInstallDialog(true);
  };

  // Refresh installed state when dialog closes (after installation)
  useEffect(() => {
    if (!showInstallDialog) {
      loadInstalledReleases();
    }
  }, [showInstallDialog]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getRepositoryBadgeColor = (official: boolean) => {
    return official ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200';
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card className="max-h-[82vh] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-5 w-5" />
            Browse Helm Charts
          </CardTitle>
          <CardDescription>
            Discover and install Helm charts from Artifact Hub
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search charts (e.g., nginx, postgres, redis)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!!loading}>
              {loading ? (
                <ReloadIcon className="h-4 w-4 animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4" />
              )}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {totalCharts > 0 ? `${totalCharts} Charts Found` : 'No Charts Found'}
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage <= 1 || loading}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({totalCharts} total)
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage >= totalPages || loading}
                >
                  Last
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <ReloadIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600">Loading charts...</p>
              </div>
            </div>
          ) : charts.length === 0 ? (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No charts found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery ? `No charts match "${searchQuery}"` : 'Try searching for a specific chart name'}
              </p>
              {searchQuery && (
                <Button variant="outline" onClick={() => { setSearchQuery(''); searchCharts('', 1); }}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="w-full h-[65vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2 pb-8">
                {charts.map((chart) => (
                  <Card key={chart.id} className="hover:shadow-lg transition-all duration-200 hover:scale-105 aspect-square flex flex-col overflow-hidden">
                    <CardContent className="p-3 flex flex-col h-full justify-between">
                      {/* Chart Icon */}
                      <div className="flex justify-center mb-2">
                        {chart.icon ? (
                          <img
                            src={chart.icon}
                            alt={chart.name}
                            className="w-12 h-12 rounded-lg object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                            <GlobeIcon className="h-6 w-6 text-gray-500 dark:text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Chart Info */}
                      <div className="flex-1 flex flex-col justify-between min-h-0">
                        <div className="text-center mb-2">
                          <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                            {chart.name}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 h-6 leading-3">
                            {chart.description || 'No description available'}
                          </p>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-col items-center gap-1 mb-2">
                          <div className="flex flex-wrap justify-center gap-1">
                            <Badge className={`text-xs px-1 py-0 ${getRepositoryBadgeColor(chart.repository.official ?? false)}`}>
                              {chart.repository.name}
                            </Badge>
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              v{chart.version}
                            </Badge>
                          </div>
                           <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <ClockIcon className="h-3 w-3" />
                            {formatDate(chart.created)}
                          </span>
                        </div>

                        {/* Keywords - Only show if space allows */}
                        {chart.keywords && chart.keywords.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1 mb-2">
                            {chart.keywords.slice(0, 2).map((keyword) => (
                              <Badge key={keyword} variant="secondary" className="text-xs px-1 py-0">
                                {keyword}
                              </Badge>
                            ))}
                            {chart.keywords.length > 2 && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                +{chart.keywords.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons - Always at bottom */}
                      <div className="mt-auto">
                        <div className="flex items-center gap-1">
                          {installedCharts.has((chart.name || '').toLowerCase()) ? (
                            <Button variant="secondary" size="sm" className="h-8 flex-1" disabled>
                              <CheckCircledIcon className="h-3 w-3 mr-1" />
                              Installed
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 flex-1"
                              onClick={() => handleInstallChart(chart)}
                            >
                              <DownloadIcon className="h-3 w-3 mr-1" />
                              Install
                            </Button>
                          )}
                          {chart.home && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 justify-center"
                              onClick={() => window.open(chart.home, '_blank')}
                              aria-label="Open homepage"
                              title="Open homepage"
                            >
                              <ExternalLinkIcon className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage <= 1 || loading}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <span className="text-xs text-gray-500">
                  ({totalCharts} total)
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage >= totalPages || loading}
              >
                Last
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Install Dialog */}
      <HelmChartInstallDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
        chart={selectedChart}
        clusterName={clusterName}
        configName={configName}
      />
    </div>
  );
}

export default HelmChartsOverview;