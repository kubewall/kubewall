import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { memo, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DependencyCard, type DependencyResource } from "./DependencyCard";

interface ResourceListProps {
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
}

const ResourceList = memo<ResourceListProps>(function ResourceList({
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
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    
    const query = searchQuery.toLowerCase();
    return resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(query) ||
        resource.namespace.toLowerCase().includes(query) ||
        (resource.status && resource.status.toLowerCase().includes(query))
    );
  }, [resources, searchQuery]);

  if (!resources || resources.length === 0) {
    return null;
  }

  const resourceCount = filteredResources.length;
  const totalCount = resources.length;

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
              <Badge 
                variant="secondary" 
                className="text-xs px-2 py-1 bg-secondary/80 group-hover:bg-secondary transition-colors"
              >
                {searchQuery ? resourceCount : totalCount}
              </Badge>
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 bg-background/50 border-border/50 focus:bg-background transition-colors"
                  />
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
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-xs"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredResources.map((resource, index) => (
                  <DependencyCard
                    key={`${resource.name}-${resource.namespace}-${index}`}
                    resource={resource}
                    resourceType={resourceType}
                    onNavigate={onNavigate}
                    showStatus={showStatus}
                    showLastUpdated={showLastUpdated}
                    className="hover:scale-[1.01] transition-transform duration-200"
                  />
                ))}
              </div>
            )}
            
            {searchQuery && filteredResources.length > 0 && filteredResources.length < totalCount && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing {filteredResources.length} of {totalCount} {title.toLowerCase()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
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

export { ResourceList };
export type { ResourceListProps };