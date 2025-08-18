import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { memo, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface DependencyResource {
  name: string;
  namespace: string;
  status?: string;
  lastUpdated?: string;
}

interface OptimizedDependencyCardProps {
  resource: DependencyResource;
  resourceType: string;
  onNavigate: (resourceType: string, resourceName: string, resourceNamespace: string) => void;
  className?: string;
  showStatus?: boolean;
  showLastUpdated?: boolean;
  index?: number; // For virtual scrolling optimization
}

const OptimizedDependencyCard = memo<OptimizedDependencyCardProps>(function OptimizedDependencyCard({
  resource,
  resourceType,
  onNavigate,
  className,
  showStatus = false,
  showLastUpdated = false,
  index,
}) {
  const handleNavigate = useCallback(() => {
    onNavigate(resourceType, resource.name, resource.namespace);
  }, [onNavigate, resourceType, resource.name, resource.namespace]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate();
    }
  }, [handleNavigate]);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleNavigate();
  }, [handleNavigate]);

  // Memoize status badge variant calculation
  const statusVariant = useMemo(() => {
    if (!showStatus || !resource.status) return null;
    return resource.status === 'Running' ? 'default' : 'secondary';
  }, [showStatus, resource.status]);

  // Memoize aria label
  const ariaLabel = useMemo(() => 
    `Navigate to ${resourceType} ${resource.name} in namespace ${resource.namespace}`,
    [resourceType, resource.name, resource.namespace]
  );

  // Memoize button aria label
  const buttonAriaLabel = useMemo(() => 
    `View details for ${resource.name}`,
    [resource.name]
  );

  // Memoize tooltip content
  const tooltipContent = useMemo(() => 
    `View ${resourceType} details`,
    [resourceType]
  );

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between p-3 border border-border/50 rounded-lg",
        "bg-card/50 hover:bg-card transition-all duration-150 ease-in-out",
        "hover:border-border hover:shadow-sm cursor-pointer",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      data-index={index} // For debugging virtual scrolling
    >
      <div className="flex flex-col space-y-1 min-w-0 flex-1">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm text-foreground truncate">
            {resource.name}
          </span>
          {statusVariant && (
            <Badge 
              variant={statusVariant}
              className="text-xs px-2 py-0.5 shrink-0"
            >
              {resource.status}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span className="truncate">
            Namespace: {resource.namespace}
          </span>
          {showLastUpdated && resource.lastUpdated && (
            <>
              <span className="text-muted-foreground/50 shrink-0">•</span>
              <span className="truncate">
                Updated: {resource.lastUpdated}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 ml-4 shrink-0">
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 opacity-60 group-hover:opacity-100",
                  "transition-opacity duration-150 hover:bg-accent",
                  "focus:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-1"
                )}
                onClick={handleButtonClick}
                aria-label={buttonAriaLabel}
              >
                <ExternalLinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              <p>{tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Optimized hover effect - simpler gradient */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent to-accent/3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  return (
    prevProps.resource.name === nextProps.resource.name &&
    prevProps.resource.namespace === nextProps.resource.namespace &&
    prevProps.resource.status === nextProps.resource.status &&
    prevProps.resource.lastUpdated === nextProps.resource.lastUpdated &&
    prevProps.resourceType === nextProps.resourceType &&
    prevProps.showStatus === nextProps.showStatus &&
    prevProps.showLastUpdated === nextProps.showLastUpdated &&
    prevProps.className === nextProps.className &&
    prevProps.index === nextProps.index
  );
});

export { OptimizedDependencyCard };
export type { OptimizedDependencyCardProps };