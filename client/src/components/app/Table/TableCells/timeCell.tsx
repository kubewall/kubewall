import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { getDisplayTime } from "@/utils";
import { useNow } from "@/hooks/use-now";

type TimeCellProps = {
  cellValue: string;
};

function TimeCell({ cellValue }: TimeCellProps) {
  const now = useNow();
  const startMs = new Date(cellValue).getTime();

  return (
    <div className="px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-gray-700 dark:text-gray-100">
            {getDisplayTime(now - startMs)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {cellValue}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export {
  TimeCell
};
