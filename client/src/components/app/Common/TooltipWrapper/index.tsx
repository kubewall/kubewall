import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type TooltipWrapperProps = {
  tooltipString: string | number;
  side: "bottom" | "top" | "right" | "left";
  tooltipContent?: string | number;
  className?: string;
}
const TooltipWrapper = ({ tooltipString, tooltipContent, className, side = "bottom" }: TooltipWrapperProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <span className={className}>{tooltipString}</span>
        </TooltipTrigger>
        <TooltipContent side={side} className="px-1.5 truncate">
          {tooltipContent || tooltipString}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {
  TooltipWrapper
};
