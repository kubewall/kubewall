import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, ChevronUpIcon } from "@radix-ui/react-icons";
import { memo, useState, useMemo, useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { OptimizedDependencyCard, type DependencyResource } from "./OptimizedDependencyCard";
import { useDebounce } from "@/hooks/useDebounce";
import "./dependencies.css";

interface ProgressiveResourceListProps {
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
  initialItemCount?: number;
  incrementCount?: number;
  maxItemsBeforeVirtualization?: number;
}

const ProgressiveResourceList = memo<ProgressiveResourceListProps>(function ProgressiveResourceList({
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
  initialItemCount = 10,
  incrementCount = 20,
  maxItemsBeforeVirtualization = 100,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(initialItemCount);
  const [isPending, startTransition] = useTransition();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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

  const visibleResources = useMemo(() => {
    return filteredResources.slice(0, visibleCount);
  }, [filteredResources, visibleCount]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    // Reset visible count when searching
    if (newQuery !== searchQuery) {
      setVisibleCount(initialItemCount);
    }
  }, [searchQuery, initialItemCount]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setVisibleCount(initialItemCount);
  }, [initialItemCount]);

  const showMore = useCallback(() => {
    startTransition(() => {
      setVisibleCount(prev => Math.min(prev + incrementCount, filteredResources.length));
    });
  }, [incrementCount, filteredResources.length]);

  const showLess = useCallback(() => {
    startTransition(() => {
      setVisibleCount(initialItemCount);
    });
  }, [initialItemCount]);

  const showAll = useCallback(() => {
    startTransition(() => {
      setVisibleCount(filteredResources.length);
    });
  }, [filteredResources.length]);

  if (!resources || resources.length === 0) {
    return null;
  }

  const resourceCount = filteredResources.length;
  const totalCount = resources.length;
  const hasMore = visibleCount < resourceCount;
  const isShowingAll = visibleCount >= resourceCount;
  const shouldShowProgressiveControls = resourceCount > initialItemCount;
  const shouldSuggestVirtualization = resourceCount > maxItemsBeforeVirtualization;

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
                {shouldSuggestVirtualization && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                    Large Dataset
                  </Badge>
                )}
                {shouldShowProgressiveControls && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                    Progressive
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
            ) : (
              <>
                <div className="space-y-2 dependency-list-container">
                  {visibleResources.map((resource, index) => (
                    <OptimizedDependencyCard
                      key={`${resource.name}-${resource.namespace}-${index}`}
                      resource={resource}
                      resourceType={resourceType}
                      onNavigate={onNavigate}
                      showStatus={showStatus}
                      showLastUpdated={showLastUpdated}
                      index={index}
                      className="dependency-card-optimized dependency-transition"
                    />
                  ))}
                </div>
                
                {shouldShowProgressiveControls && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        Showing {visibleCount} of {resourceCount} {title.toLowerCase()}
                        {isPending && (
                          <span className="ml-2 inline-flex items-center">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {hasMore && (
                          <div className="progressive-show-more">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={showMore}
                              disabled={isPending}
                              className="text-xs h-auto px-2 py-1 hover:text-foreground dependency-transition"
                            >
                              Show {Math.min(incrementCount, resourceCount - visibleCount)} more
                            </Button>
                            {resourceCount - visibleCount > incrementCount && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={showAll}
                                disabled={isPending}
                                className="text-xs h-auto px-2 py-1 hover:text-foreground dependency-transition ml-2"
                              >
                                Show all ({resourceCount - visibleCount} remaining)
                              </Button>
                            )}
                          </div>
                        )}
                        {isShowingAll && visibleCount > initialItemCount && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={showLess}
                            disabled={isPending}
                            className="text-xs h-auto px-2 py-1 hover:text-foreground flex items-center space-x-1"
                          >
                            <ChevronUpIcon className="h-3 w-3" />
                            <span>Show less</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {shouldSuggestVirtualization && isShowingAll && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-md">
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          💡 <strong>Performance tip:</strong> Consider using virtualization for better performance with {resourceCount} items.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

export { ProgressiveResourceList };
export type { ProgressiveResourceListProps };