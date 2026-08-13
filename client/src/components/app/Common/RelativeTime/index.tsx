import { defaultOrValue, getDisplayTime } from "@/utils";

import { TooltipWrapper } from "@/components/app/Common/TooltipWrapper";
import { useNow } from "@/hooks/use-now";

type RelativeTimeProps = {
  timestamp?: string | null;
};

// Renders a timestamp the way the Age column does - "3h21m" that ticks along with
// the shared clock, with the absolute value kept on the tooltip. Falls back to the
// raw value when there is nothing parseable to count from.
function RelativeTime({ timestamp }: RelativeTimeProps) {
  const now = useNow();
  const parsed = timestamp ? Date.parse(timestamp) : NaN;

  if (Number.isNaN(parsed)) {
    return <>{defaultOrValue(timestamp)}</>;
  }

  return (
    <TooltipWrapper
      side="bottom"
      tooltipString={getDisplayTime(now - parsed)}
      tooltipContent={timestamp as string}
    />
  );
}

export {
  RelativeTime
};
