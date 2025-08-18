import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  className?: string;
  showMultipleCards?: boolean;
  cardCount?: number;
}

const LoadingState = memo<LoadingStateProps>(function LoadingState({
  className,
  showMultipleCards = true,
  cardCount = 2,
}) {
  const SkeletonCard = ({ delay = 0 }: { delay?: number }) => (
    <Card className="shadow-none rounded-lg border-border/50 bg-card/30">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-8 rounded-full" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-3">
          {/* Skeleton for search bar */}
          <div className="relative">
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          
          {/* Skeleton for resource items */}
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between p-4 border border-border/30 rounded-lg bg-card/20",
                "animate-pulse"
              )}
              style={{
                animationDelay: `${delay + index * 100}ms`,
                animationDuration: '1.5s'
              }}
            >
              <div className="flex flex-col space-y-2 flex-1">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-1 w-1 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="ml-4">
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("mt-4", className)}>
      <Card className="shadow-none rounded-lg border-border/50 bg-card/30">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-3 w-48" />
            </div>
            
            {showMultipleCards ? (
              <div className="space-y-4">
                {[...Array(cardCount)].map((_, index) => (
                  <SkeletonCard key={index} delay={index * 200} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-4 border border-border/30 rounded-lg bg-card/20",
                      "animate-pulse"
                    )}
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animationDuration: '1.5s'
                    }}
                  >
                    <div className="flex flex-col space-y-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-1 w-1 rounded-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export { LoadingState };
export type { LoadingStateProps };