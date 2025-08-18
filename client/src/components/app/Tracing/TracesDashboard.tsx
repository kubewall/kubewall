import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Clock, AlertCircle, CheckCircle, Search, Filter, Download } from 'lucide-react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { traceDetailsRoute } from '@/routes';

interface Trace {
  traceId: string;
  operationName: string;
  startTime: string;
  duration: number;
  services: string[];
  status: string;
  spanCount: number;
}

interface TraceFilter {
  service: string;
  operation: string;
  status: string;
  startTime: string;
  endTime: string;
  minDuration: string;
  maxDuration: string;
}

interface TracingStats {
  totalTraces: number;
  totalServices: number;
  avgDuration: number;
  errorRate: number;
  tracingEnabled: boolean;
  samplingRate: number;
}

const TracesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const router = useRouterState();
  const configName = router.location.pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';
  const [traces, setTraces] = useState<Trace[]>([]);
  const [stats, setStats] = useState<TracingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TraceFilter>({
    service: '',
    operation: '',
    status: '',
    startTime: '',
    endTime: '',
    minDuration: '',
    maxDuration: ''
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;

  const fetchTraces = async (reset = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filter.service) params.append('service', filter.service);
      if (filter.operation) params.append('operation', filter.operation);
      if (filter.status) params.append('status', filter.status);
      if (filter.startTime) params.append('startTime', filter.startTime);
      if (filter.endTime) params.append('endTime', filter.endTime);
      if (filter.minDuration) params.append('minDuration', filter.minDuration);
      if (filter.maxDuration) params.append('maxDuration', filter.maxDuration);
      
      params.append('limit', pageSize.toString());
      params.append('offset', (reset ? 0 : currentPage * pageSize).toString());

      const response = await fetch(`/api/v1/traces?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch traces');
      }

      const data = await response.json();
      
      if (reset) {
        setTraces(data.traces);
        setCurrentPage(0);
      } else {
        setTraces(prev => [...prev, ...data.traces]);
      }
      
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traces');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/v1/tracing/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch tracing stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch tracing stats:', err);
    }
  };

  useEffect(() => {
    fetchTraces(true);
    fetchStats();
  }, []);

  const handleFilterChange = (key: keyof TraceFilter, value: string) => {
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchTraces(true);
  };

  const handleLoadMore = () => {
    setCurrentPage(prev => prev + 1);
    fetchTraces(false);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/v1/traces/export');
      if (!response.ok) {
        throw new Error('Failed to export traces');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'traces.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export traces');
    }
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration.toFixed(2)}μs`;
    } else if (duration < 1000000) {
      return `${(duration / 1000).toFixed(2)}ms`;
    } else {
      return `${(duration / 1000000).toFixed(2)}s`;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'success' ? 'default' : 'destructive';
    const icon = status === 'success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />;
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {icon}
        {status}
      </Badge>
    );
  };

  if (!stats?.tracingEnabled) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Tracing Disabled</h3>
              <p className="text-muted-foreground">
                OpenTelemetry tracing is currently disabled. Enable it in the configuration to start collecting traces.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTraces.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalServices}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDuration.toFixed(2)}ms</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.errorRate.toFixed(2)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Service name"
              value={filter.service}
              onChange={(e) => handleFilterChange('service', e.target.value)}
            />
            <Input
              placeholder="Operation name"
              value={filter.operation}
              onChange={(e) => handleFilterChange('operation', e.target.value)}
            />
            <Select value={filter.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search
              </Button>
              <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traces Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Traces</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-red-500 mb-4 p-3 bg-red-50 rounded-md">
              {error}
            </div>
          )}
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trace ID</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Spans</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traces.map((trace) => (
                <TableRow 
                  key={trace.traceId} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate({ to: traceDetailsRoute.to, params: { config: configName, traceId: trace.traceId }, search: { cluster: clusterName } })}
                >
                  <TableCell className="font-mono text-sm">
                    {trace.traceId.substring(0, 16)}...
                  </TableCell>
                  <TableCell>{trace.operationName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {trace.services.map((service, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(trace.duration)}</TableCell>
                  <TableCell>{trace.spanCount}</TableCell>
                  <TableCell>{getStatusBadge(trace.status)}</TableCell>
                  <TableCell>{new Date(trace.startTime).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}
          
          {hasMore && !loading && (
            <div className="text-center mt-4">
              <Button onClick={handleLoadMore} variant="outline">
                Load More
              </Button>
            </div>
          )}
          
          {traces.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No traces found. Try adjusting your filters or wait for new traces to be collected.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TracesDashboard;