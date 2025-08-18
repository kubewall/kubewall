import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoCircledIcon, ReloadIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
  };
  className?: string;
  type?: "no-dependencies" | "no-results" | "error";
}

const EmptyState = memo<EmptyStateProps>(function EmptyState({
  title = "Dependencies",
  message,
  description,
  icon,
  action,
  className,
  type = "no-dependencies",
}) {
  const getDefaultContent = () => {
    switch (type) {
      case "no-results":
        return {
          icon: <MagnifyingGlassIcon className="h-8 w-8 text-muted-foreground/60" />,
          message: "No results found",
          description: "Try adjusting your search criteria or clearing filters to see more results.",
        };
      case "error":
        return {
          icon: <InfoCircledIcon className="h-8 w-8 text-destructive/60" />,
          message: "Unable to load dependencies",
          description: "There was an error loading the dependency information. Please try again.",
        };
      default:
        return {
          icon: (
            <div className="relative">
              <div className="h-8 w-8 rounded-lg border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                <div className="h-3 w-3 rounded-sm bg-muted-foreground/30" />
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-muted-foreground/20" />
            </div>
          ),
          message: "No workloads are currently using this secret",
          description: "When workloads reference this secret, they will appear here with details about their usage.",
        };
    }
  };

  const defaultContent = getDefaultContent();
  const displayIcon = icon || defaultContent.icon;
  const displayMessage = message || defaultContent.message;
  const displayDescription = description || defaultContent.description;

  return (
    <div className={cn("mt-4", className)}>
      <Card className="shadow-none rounded-lg border-border/50 bg-card/30">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-6">
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            {/* Icon */}
            <div className="flex items-center justify-center">
              {displayIcon}
            </div>
            
            {/* Main message */}
            <div className="space-y-2 max-w-md">
              <h3 className="text-sm font-medium text-foreground">
                {displayMessage}
              </h3>
              
              {displayDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {displayDescription}
                </p>
              )}
            </div>
            
            {/* Action button */}
            {action && (
              <div className="pt-2">
                <Button
                  variant={action.variant || "outline"}
                  size="sm"
                  onClick={action.onClick}
                  className="text-xs h-8"
                >
                  {action.variant === "default" && type === "error" && (
                    <ReloadIcon className="h-3 w-3 mr-1" />
                  )}
                  {action.label}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

// Preset components for common use cases
const NoDependenciesState = memo(function NoDependenciesState({
  resourceType = "secret",
  className,
}: {
  resourceType?: string;
  className?: string;
}) {
  return (
    <EmptyState
      type="no-dependencies"
      message={`No workloads are currently using this ${resourceType}`}
      description={`When workloads reference this ${resourceType}, they will appear here with details about their usage and relationships.`}
      className={className}
    />
  );
});

const NoSearchResultsState = memo(function NoSearchResultsState({
  searchQuery,
  onClearSearch,
  className,
}: {
  searchQuery: string;
  onClearSearch: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="no-results"
      message={`No results found for "${searchQuery}"`}
      description="Try adjusting your search terms or clearing the search to see all dependencies."
      action={{
        label: "Clear search",
        onClick: onClearSearch,
        variant: "outline",
      }}
      className={className}
    />
  );
});

const ErrorState = memo(function ErrorState({
  onRetry,
  className,
}: {
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="error"
      action={
        onRetry
          ? {
              label: "Try again",
              onClick: onRetry,
              variant: "default",
            }
          : undefined
      }
      className={className}
    />
  );
});

export { EmptyState, NoDependenciesState, NoSearchResultsState, ErrorState };
export type { EmptyStateProps };