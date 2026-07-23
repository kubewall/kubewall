import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ConditionalTooltipProps = {
  show: boolean;
  content: React.ReactNode;
  children: React.ReactElement;
};

// Wraps children in a Tooltip only when show is true, so cells that aren't
// actually truncated never pay for mounting Tooltip/Trigger/Content at all -
// relevant at 1000+ rows even with virtualization capping how many are ever
// mounted at once.
function ConditionalTooltip({ show, content, children }: ConditionalTooltipProps) {
  if (!show) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export {
  ConditionalTooltip
};
