import React, { useState, useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Clock, Activity, AlertCircle, CheckCircle, ChevronRight, ChevronDown, Timer, Zap } from 'lucide-react';

interface SpanLog {
  timestamp: string;
  level: string;
  message: string;
  fields: Record<string, any>;
}

interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: string;
  duration: number;
  status: string;
  tags: Record<string, string>;
  logs: SpanLog[];
}

interface Trace {
  traceId: string;
  operationName: string;
  startTime: string;
  duration: number;
  status: string;
  services: string[];
  spanCount: number;
  spans: Span[];
  tags: Record<string, string>;
}

interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
  depth: number;
}

const TraceDetails: React.FC = () => {
  const router = useRouterState();
  const traceId = router.location.pathname.split('/').pop() || '';
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  useEffect(() => {
    if (!traceId) return;

    const fetchTrace = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/traces/${traceId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch trace');
        }
        const data = await response.json();
        setTrace(data.trace);
        
        // Auto-expand root spans
        const rootSpans = data.trace.spans.filter((span: Span) => !span.parentSpanId);
        setExpandedSpans(new Set(rootSpans.map((span: Span) => span.spanId)));
        
        // Select the first span by default
        if (data.trace.spans.length > 0) {
          setSelectedSpan(data.trace.spans[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trace');
      } finally {
        setLoading(false);
      }
    };

    fetchTrace();
  }, [traceId]);

  const buildSpanTree = (spans: Span[]): SpanTreeNode[] => {
    const spanMap = new Map<string, Span>();
    const children = new Map<string, Span[]>();
    const roots: Span[] = [];

    // Build maps
    spans.forEach(span => {
      spanMap.set(span.spanId, span);
      // Check for root spans: no parent or parent is "0000000000000000" (OpenTelemetry zero span ID)
      if (!span.parentSpanId || span.parentSpanId === "0000000000000000") {
        roots.push(span);
      } else {
        if (!children.has(span.parentSpanId)) {
          children.set(span.parentSpanId, []);
        }
        children.get(span.parentSpanId)!.push(span);
      }
    });

    const buildNode = (span: Span, depth: number): SpanTreeNode => {
      const childSpans = children.get(span.spanId) || [];
      return {
        span,
        children: childSpans.map(child => buildNode(child, depth + 1)),
        depth
      };
    };

    return roots.map(root => buildNode(root, 0));
  };

  const toggleSpanExpansion = (spanId: string) => {
    setExpandedSpans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spanId)) {
        newSet.delete(spanId);
      } else {
        newSet.add(spanId);
      }
      return newSet;
    });
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

  const calculateSpanPosition = (span: Span, traceStartTime: string, traceDuration: number) => {
    const traceStart = new Date(traceStartTime).getTime();
    const spanStart = new Date(span.startTime).getTime();
    const relativeStart = spanStart - traceStart;
    const left = (relativeStart / (traceDuration / 1000)) * 100;
    const width = (span.duration / 1000 / (traceDuration / 1000)) * 100;
    
    return { 
      left: Math.max(0, left), 
      width: Math.max(0.1, width),
      relativeStart: relativeStart / 1000, // in milliseconds
      absoluteStart: spanStart,
      absoluteEnd: spanStart + (span.duration / 1000)
    };
  };

  const getSpanColor = (span: Span) => {
    // Color coding based on operation type
    if (span.operationName.includes('k8s.')) {
      return span.status === 'success' ? 'bg-blue-500' : 'bg-blue-700';
    } else if (span.operationName.includes('data.')) {
      return span.status === 'success' ? 'bg-purple-500' : 'bg-purple-700';
    } else if (span.operationName.includes('auth.')) {
      return span.status === 'success' ? 'bg-orange-500' : 'bg-orange-700';
    } else if (span.operationName.includes('metrics.')) {
      return span.status === 'success' ? 'bg-teal-500' : 'bg-teal-700';
    } else {
      return span.status === 'success' ? 'bg-green-500' : 'bg-red-500';
    }
  };

  const getOperationIcon = (operationName: string) => {
    if (operationName.includes('k8s.')) {
      return <Activity className="w-3 h-3" />;
    } else if (operationName.includes('data.')) {
      return <Zap className="w-3 h-3" />;
    } else if (operationName.includes('auth.')) {
      return <CheckCircle className="w-3 h-3" />;
    } else if (operationName.includes('metrics.')) {
      return <Timer className="w-3 h-3" />;
    } else {
      return <Activity className="w-3 h-3" />;
    }
  };

  const formatRelativeTime = (relativeStart: number) => {
     if (relativeStart < 1) {
       return `+${(relativeStart * 1000).toFixed(0)}μs`;
     } else if (relativeStart < 1000) {
       return `+${relativeStart.toFixed(1)}ms`;
     } else {
       return `+${(relativeStart / 1000).toFixed(2)}s`;
     }
   };

   const renderWaterfallSpans = (nodes: SpanTreeNode[], traceStartTime: string, traceDuration: number) => {
     const renderWaterfallNode = (node: SpanTreeNode, depth: number = 0): React.ReactNode[] => {
       const { span, children } = node;
       const position = calculateSpanPosition(span, traceStartTime, traceDuration);
       const spanColor = getSpanColor(span);
       const operationIcon = getOperationIcon(span.operationName);
       const isSelected = selectedSpan?.spanId === span.spanId;
       const hasChildren = children.length > 0;
       
       const result: React.ReactNode[] = [];
       
       // Render current span
       result.push(
         <div key={span.spanId} className="relative">
           {/* Connection lines for nested spans */}
           {depth > 0 && (
             <div className="absolute left-0 top-0 bottom-0 flex items-center">
               <div 
                 className="border-l-2 border-muted-foreground/20 h-full"
                 style={{ marginLeft: `${(depth - 1) * 20 + 10}px` }}
               />
               <div 
                 className="border-t-2 border-muted-foreground/20 w-4"
                 style={{ marginLeft: `${(depth - 1) * 20 + 10}px` }}
               />
             </div>
           )}
           
           <div 
             className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors ml-${depth * 5} ${
               isSelected ? 'bg-primary/10 border border-primary/20' : ''
             }`}
             style={{ marginLeft: `${depth * 20}px` }}
             onClick={() => setSelectedSpan(span)}
           >
             {/* Span info with nesting indicator */}
             <div className="w-64 flex items-center gap-2 text-sm">
               {hasChildren && (
                 <div className="w-4 h-4 flex items-center justify-center">
                   <div className="w-2 h-2 rounded-full bg-primary" />
                 </div>
               )}
               {!hasChildren && depth > 0 && (
                 <div className="w-4 h-4 flex items-center justify-center">
                   <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                 </div>
               )}
               {operationIcon}
               <span className="font-medium truncate">{span.operationName}</span>
               <Badge variant="secondary" className="text-xs">{span.serviceName}</Badge>
             </div>
             
             {/* Enhanced timeline visualization */}
             <div className="flex-1 relative">
               <div className="h-6 bg-muted/20 rounded-sm relative overflow-hidden">
                 {/* Parent span background for context */}
                 {depth > 0 && (
                   <div className="absolute inset-0 bg-muted/10 rounded-sm" />
                 )}
                 
                 <div 
                   className={`h-full rounded-sm ${spanColor} relative group transition-all duration-200 hover:opacity-90`}
                   style={{
                     left: `${position.left}%`,
                     width: `${position.width}%`,
                     position: 'absolute',
                     minWidth: '2px',
                     zIndex: depth + 1
                   }}
                 >
                   {/* Depth indicator gradient */}
                   <div 
                     className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"
                     style={{ opacity: Math.max(0.1, 1 - depth * 0.2) }}
                   />
                   
                   {/* Hover tooltip with enhanced info */}
                   <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                     <div className="font-medium">{span.operationName}</div>
                     <div className="text-muted-foreground">
                       {formatDuration(span.duration)} • {formatRelativeTime(position.relativeStart)}
                     </div>
                   </div>
                 </div>
                 
                 {/* Overlap indicators for child spans */}
                 {hasChildren && children.map(child => {
                   const childPosition = calculateSpanPosition(child.span, traceStartTime, traceDuration);
                   return (
                     <div 
                       key={child.span.spanId}
                       className="absolute top-0 h-1 bg-primary/30 rounded-sm"
                       style={{
                         left: `${childPosition.left}%`,
                         width: `${childPosition.width}%`,
                         bottom: '-2px'
                       }}
                     />
                   );
                 })}
               </div>
               
               {/* Enhanced timing labels */}
               <div className="flex justify-between text-xs text-muted-foreground mt-1">
                 <span className="flex items-center gap-1">
                   {formatRelativeTime(position.relativeStart)}
                   {depth > 0 && <span className="text-muted-foreground/50">↳</span>}
                 </span>
                 <span className="font-medium">{formatDuration(span.duration)}</span>
               </div>
             </div>
             
             {/* Status and performance indicators */}
             <div className="flex items-center gap-2">
               {getStatusBadge(span.status)}
               <div className="text-xs text-muted-foreground text-right">
                 <div>{((span.duration / 1000 / (traceDuration / 1000)) * 100).toFixed(1)}%</div>
                 {hasChildren && (
                   <div className="text-muted-foreground/70">{children.length} child{children.length !== 1 ? 'ren' : ''}</div>
                 )}
               </div>
             </div>
           </div>
         </div>
       );
       
       // Render children recursively
       children.forEach(child => {
         result.push(...renderWaterfallNode(child, depth + 1));
       });
       
       return result;
     };
     
     return (
       <div className="space-y-1">
         {nodes.flatMap(node => renderWaterfallNode(node, 0))}
       </div>
     );
   };

  const renderSpanNode = (node: SpanTreeNode, traceStartTime: string, traceDuration: number) => {
    const { span, children, depth } = node;
    const isExpanded = expandedSpans.has(span.spanId);
    const hasChildren = children.length > 0;
    const isSelected = selectedSpan?.spanId === span.spanId;
    const position = calculateSpanPosition(span, traceStartTime, traceDuration);
    const spanColor = getSpanColor(span);
    const operationIcon = getOperationIcon(span.operationName);

    return (
      <div key={span.spanId} className="border-l border-muted/30 ml-2">
        <div 
          className={`flex items-center p-2 hover:bg-muted/50 cursor-pointer transition-colors ${
            isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedSpan(span)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSpanExpansion(span.spanId);
                }}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            ) : (
              <div className="w-6 flex justify-center">
                <div className="w-2 h-2 rounded-full bg-muted" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1">
                  {operationIcon}
                  <span className="font-medium truncate text-sm">{span.operationName}</span>
                </div>
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{span.serviceName}</Badge>
                {getStatusBadge(span.status)}
              </div>
              
              {/* Enhanced Timeline bar with better positioning */}
              <div className="relative">
                {/* Background timeline */}
                <div className="h-3 bg-muted/30 rounded-sm relative overflow-hidden">
                  {/* Span bar with improved styling */}
                  <div 
                    className={`h-full rounded-sm ${spanColor} relative transition-all duration-200 hover:opacity-80`}
                    style={{
                      left: `${position.left}%`,
                      width: `${position.width}%`,
                      position: 'absolute',
                      minWidth: '2px'
                    }}
                  >
                    {/* Gradient overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </div>
                  
                  {/* Start time indicator */}
                  {position.left > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 w-px bg-muted-foreground/30"
                      style={{ left: `${position.left}%` }}
                    />
                  )}
                </div>
                
                {/* Timing information */}
                <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(position.relativeStart)}</span>
                  <span className="font-medium">{formatDuration(span.duration)}</span>
                </div>
              </div>
            </div>
            
            {/* Performance indicators */}
            <div className="flex flex-col items-end gap-1 text-xs">
              <div className="text-muted-foreground">
                {formatDuration(span.duration)}
              </div>
              {/* Show percentage of total trace time */}
              <div className="text-muted-foreground/70">
                {((span.duration / 1000 / (traceDuration / 1000)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
        
        {isExpanded && children.map(child => 
          renderSpanNode(child, traceStartTime, traceDuration)
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Trace</h3>
              <p className="text-muted-foreground mb-4">
                {error || 'Trace not found'}
              </p>
              <Button onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Traces
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const spanTree = buildSpanTree(trace.spans);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{trace.operationName}</h1>
          <p className="text-muted-foreground font-mono text-sm">{trace.traceId}</p>
        </div>
      </div>

      {/* Trace Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(trace.duration)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trace.spanCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trace.services.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(trace.status)}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Timeline Tabs */}
        <Tabs defaultValue="waterfall" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="waterfall">Waterfall Timeline</TabsTrigger>
            <TabsTrigger value="hierarchy">Span Hierarchy</TabsTrigger>
          </TabsList>
          
          <TabsContent value="waterfall" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Waterfall Timeline
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Visual timeline showing span execution order and timing relationships
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  {/* Timeline header with time markers */}
                  <div className="sticky top-0 bg-background border-b p-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>0ms</span>
                      <span>{formatDuration(trace.duration)}</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-sm relative">
                      {/* Time markers */}
                      {[0.25, 0.5, 0.75].map(fraction => (
                        <div 
                          key={fraction}
                          className="absolute top-0 bottom-0 w-px bg-muted-foreground/20"
                          style={{ left: `${fraction * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Waterfall spans with nested visualization */}
                   <div className="p-4">
                     {renderWaterfallSpans(spanTree, trace.startTime, trace.duration)}
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="hierarchy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Span Hierarchy
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hierarchical view showing parent-child relationships between spans
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {spanTree.map(node => 
                    renderSpanNode(node, trace.startTime, trace.duration)
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Span Details */}
        <Card>
          <CardHeader>
            <CardTitle>Span Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSpan ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="tags">Tags</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Operation</h4>
                    <p className="text-sm">{selectedSpan.operationName}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Service</h4>
                    <Badge variant="secondary">{selectedSpan.serviceName}</Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Duration</h4>
                    <p className="text-sm">{formatDuration(selectedSpan.duration)}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Start Time</h4>
                    <p className="text-sm">{new Date(selectedSpan.startTime).toLocaleString()}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Status</h4>
                    {getStatusBadge(selectedSpan.status)}
                  </div>
                </TabsContent>
                
                <TabsContent value="tags" className="space-y-2">
                  {Object.entries(selectedSpan.tags).length > 0 ? (
                    Object.entries(selectedSpan.tags).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="font-medium text-sm">{key}</span>
                        <span className="text-sm text-muted-foreground">{value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No tags available</p>
                  )}
                </TabsContent>
                
                <TabsContent value="logs" className="space-y-2">
                  {selectedSpan.logs && selectedSpan.logs.length > 0 ? (
                    selectedSpan.logs.map((log, index) => (
                      <div key={index} className="p-3 bg-muted rounded space-y-1">
                        <div className="flex justify-between items-center">
                          <Badge variant={log.level === 'error' ? 'destructive' : 'secondary'}>
                            {log.level}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{log.message}</p>
                        {log.fields && Object.keys(log.fields).length > 0 && (
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.fields, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No logs available</p>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-muted-foreground">Select a span to view details</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TraceDetails;