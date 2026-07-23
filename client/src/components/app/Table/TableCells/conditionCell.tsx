import { Badge } from "@/components/ui/badge";
import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { memo } from "react";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type ConditionCellProps = {
  cellValue: string;
};

type ConditionBadgeProps = {
  value: string;
};

// A hook is needed per badge, and the number of comma-separated conditions
// varies per row - pulled into its own component since hooks can't run
// inside the .map() below.
const ConditionBadge = memo(function ({ value }: ConditionBadgeProps) {
  const [ref, isTruncated] = useIsTruncated<HTMLDivElement>(value);

  return (
    <ConditionalTooltip show={isTruncated} content={value}>
      {
        value === 'Available' || value === 'Complete' ?
        <Badge ref={ref} className="min-w-0 max-w-full truncate block" variant="default">{value}</Badge> :
        value === 'Failed' ?
        <Badge ref={ref} className="min-w-0 max-w-full truncate block" variant="destructive">{value}</Badge>
        : <Badge ref={ref} className="min-w-0 max-w-full truncate block" variant="outline">{value}</Badge>
      }
    </ConditionalTooltip>
  );
});

const ConditionCell = memo(function ({ cellValue }: ConditionCellProps) {

  return (

    <span className="px-3 flex flex-wrap gap-1">
    {
      cellValue.split(',').map((val) => <ConditionBadge key={val} value={val} />)
    }
    </span>

  );
});

export {
  ConditionCell
};