import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { memo, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FixedSizeList as List } from "react-window";
import { cn } from "@/lib/utils";
import { OptimizedDependencyCard, type DependencyResource } from "./OptimizedDependencyCard";
import { useDebounce } from "@/hooks/useDebounce";
import "./dependencies.css";

interface VirtualizedResourceListProps {
  title: string;
  resources: DependencyResource[];
  resourceType: string;
  onNavigate: (resourceType: string, resourceName: string, resourceNamespace: string) => void;
  className?: string;
  defaultExpanded?: boolean;
  showSearch?: boolean;
  showStatus?: boolean;
  showLastUpdated?: boolean;
  emptyMessage?: string;
  itemHeight?: number;
  maxHeight?: number;
  virtualizationThreshold?: number;
}

interface VirtualItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    resources: DependencyResource[];
    resourceType: string;
    onNavigate: (resourceType: string, resourceName: string, resourceNamespace: string) => void;
    showStatus: boolean;
    showLastUpdated: boolean;
  };
}

const VirtualItem = memo<VirtualItemProps>(function VirtualItem({ index, style, data }) {
  const { resources, resourceType, onNavigate, showStatus, showLastUpdated } = data;
  const resource = resources[index];

  if (!resource) return null;

  return (
    <div style={style} className="px-2 virtual-list-item">
      <OptimizedDependencyCard
        resource={resource}
        resourceType={resourceType}
        onNavigate={onNavigate}
        showStatus={showStatus}
        showLastUpdated={showLastUpdated}
        index={index}
        className="mb-2 dependency-card-optimized"
      />
    </div>
  );
});

const VirtualizedResourceList = memo<VirtualizedResourceListProps>(function VirtualizedResourceList({
  title,
  resources,
  resourceType,
  onNavigate,
  className,
  defaultExpanded = true,
  showSearch = true,
  showStatus = false,
  showLastUpdated = false,
  emptyMessage,
  itemHeight = 100,
  maxHeight = 400,
  virtualizationThreshold = 20,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const listRef = useRef<List>(null);

  const filteredResources = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return resources;
    
    const query = debouncedSearchQuery.toLowerCase();
    return resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(query) ||
        resource.namespace.toLowerCase().includes(query) ||
        (resource.status && resource.status.toLowerCase().includes(query))
    );
  }, [resources, debouncedSearchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const itemData = useMemo(() => ({
    resources: filteredResources,
    resourceType,
    onNavigate,
    showStatus,
    showLastUpdated,
  }), [filteredResources, resourceType, onNavigate, showStatus, showLastUpdated]);

  // Reset scroll position when search changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0, "start");
    }
  }, [debouncedSearchQuery]);

  if (!resources || resources.length === 0) {
    return null;
  }

  const resourceCount = filteredResources.length;
  const totalCount = resources.length;
  const shouldVirtualize = filteredResources.length > virtualizationThreshold;
  const listHeight = Math.min(maxHeight, filteredResources.length * itemHeight);

  return (
    <Card className={cn("shadow-none rounded-lg border-border/50 bg-card/30", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-4 hover:bg-accent/50 transition-colors cursor-pointer group">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                  <span className="group-hover:text-foreground transition-colors">{title}</span>
                </div>
                {searchQuery && resourceCount !== totalCount && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({resourceCount} of {totalCount})
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {shouldVirtualize && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20">
                    Virtual
                  </Badge>
                )}
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-1 bg-secondary/80 group-hover:bg-secondary transition-colors"
                >
                  {searchQuery ? resourceCount : totalCount}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="px-4 pb-4">
            {showSearch && resources.length > 3 && (
              <div className="mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${title.toLowerCase()}...`}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-10 h-9 bg-background/50 border-border/50 focus:bg-background transition-colors"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSearch}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent/50"
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {filteredResources.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <div className="text-sm">
                  {searchQuery ? (
                    <>
                      No {title.toLowerCase()} found matching &quot;<span className="font-medium">{searchQuery}</span>&quot;
                    </>
                  ) : (
                    emptyMessage || `No ${title.toLowerCase()} found.`
                  )}
                </div>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="mt-2 text-xs"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : shouldVirtualize ? (
              <div className="border border-border/30 rounded-lg overflow-hidden virtual-list-container">
                <List
                  ref={listRef}
                  height={listHeight}
                  width="100%"
                  itemCount={filteredResources.length}
                  itemSize={itemHeight}
                  itemData={itemData}
                  className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                >
                  {VirtualItem}
                </List>
              </div>
            ) : (
              <div className="space-y-2 dependency-list-container">
                {filteredResources.map((resource, index) => (
                  <OptimizedDependencyCard
                    key={`${resource.name}-${resource.namespace}-${index}`}
                    resource={resource}
                    resourceType={resourceType}
                    onNavigate={onNavigate}
                    showStatus={showStatus}
                    showLastUpdated={showLastUpdated}
                    index={index}
                    className="dependency-card-optimized"
                  />
                ))}
              </div>
            )}
            
            {searchQuery && filteredResources.length > 0 && filteredResources.length < totalCount && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing {filteredResources.length} of {totalCount} {title.toLowerCase()}
                    {shouldVirtualize && " (virtualized)"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="text-xs h-auto p-1 hover:text-foreground"
                  >
                    Show all
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

export { VirtualizedResourceList };
export type { VirtualizedResourceListProps };