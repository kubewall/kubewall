import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";

export function SystemConfigIndicator() {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Lock className="h-4 w-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          System config - managed outside Kubewall
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
