import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { memo } from "react";
import { cn } from "@/lib/utils";

export interface DependencyResource {
  name: string;
  namespace: string;
  status?: string;
  lastUpdated?: string;
}

interface DependencyCardProps {
  resource: DependencyResource;
  resourceType: string;
  onNavigate: (resourceType: string, resourceName: string, resourceNamespace: string) => void;
  className?: string;
  showStatus?: boolean;
  showLastUpdated?: boolean;
}

const DependencyCard = memo<DependencyCardProps>(function DependencyCard({
  resource,
  resourceType,
  onNavigate,
  className,
  showStatus = false,
  showLastUpdated = false,
}) {
  const handleNavigate = () => {
    onNavigate(resourceType, resource.name, resource.namespace);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate();
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between p-2 border border-border/50 rounded-md",
        "bg-card/50 hover:bg-card transition-all duration-200 ease-in-out",
        "hover:border-border hover:shadow-sm cursor-pointer min-h-[60px]",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Navigate to ${resourceType} ${resource.name} in namespace ${resource.namespace}`}
    >
      <div className="flex flex-col space-y-1 min-w-0 flex-1 pr-2">
        <div className="flex items-center space-x-1">
          <span className="font-medium text-xs text-foreground truncate" title={resource.name}>
            {resource.name}
          </span>
          {showStatus && resource.status && (
            <Badge 
              variant={resource.status === 'Running' ? 'default' : 'secondary'}
              className="text-xs px-1.5 py-0.5 text-[10px] leading-none"
            >
              {resource.status}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <span className="truncate text-[11px]" title={`Namespace: ${resource.namespace}`}>
            {resource.namespace}
          </span>
          {showLastUpdated && resource.lastUpdated && (
            <>
              <span className="text-muted-foreground/50 text-[10px]">•</span>
              <span className="truncate text-[10px]" title={`Updated: ${resource.lastUpdated}`}>
                {resource.lastUpdated}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 w-6 p-0 opacity-60 group-hover:opacity-100",
                  "transition-opacity duration-200 hover:bg-accent",
                  "focus:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-1"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate();
                }}
                aria-label={`View details for ${resource.name}`}
              >
                <ExternalLinkIcon className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              <p>View {resourceType} details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Subtle visual indicator for interactivity */}
      <div className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </div>
  );
});

export { DependencyCard };
export type { DependencyCardProps };