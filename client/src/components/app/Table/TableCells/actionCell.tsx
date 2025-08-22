import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlayIcon, PauseIcon } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";

type ActionCellProps = {
  name: string;
  namespace: string;
  suspend: boolean;
  configName: string;
  clusterName: string;
  onSuspendToggle?: (newSuspendState: boolean) => void;
};

const ActionCell = memo(function ({ 
  name, 
  namespace, 
  suspend, 
  configName, 
  clusterName,
  onSuspendToggle 
}: ActionCellProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentSuspendState, setCurrentSuspendState] = useState(suspend);

  const handleSuspendToggle = async () => {
    setIsLoading(true);
    const newSuspendState = !currentSuspendState;
    
    try {
      const queryParams = new URLSearchParams({
        config: configName,
        cluster: clusterName,
      }).toString();
      
      const url = `${API_VERSION}/cronjobs/${namespace}/${name}/suspend?${queryParams}`;
      
      const response = await kwFetch(url, {
        method: 'PATCH',
        body: JSON.stringify({ suspend: newSuspendState }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = response as any;
      setCurrentSuspendState(newSuspendState);
      onSuspendToggle?.(newSuspendState);
      
      toast.success(result.message || `CronJob ${newSuspendState ? 'suspended' : 'resumed'} successfully`);
    } catch (error) {
      console.error('Error toggling cronjob suspend state:', error);
      toast.error(`Failed to ${newSuspendState ? 'suspend' : 'resume'} CronJob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonText = currentSuspendState ? 'Resume' : 'Suspend';
  const buttonVariant = currentSuspendState ? 'default' : 'secondary';
  const Icon = currentSuspendState ? PlayIcon : PauseIcon;
  const tooltipText = currentSuspendState 
    ? 'Resume this CronJob to allow scheduled executions' 
    : 'Suspend this CronJob to prevent scheduled executions';

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant={buttonVariant}
              size="sm"
              onClick={handleSuspendToggle}
              disabled={isLoading}
              className="h-7 px-2 text-xs"
            >
              <Icon className="h-3 w-3 mr-1" />
              {isLoading ? 'Loading...' : buttonText}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});

export { ActionCell };