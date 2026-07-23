import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { memo } from "react";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type DefaultCellProps = {
  cellValue: string;
  truncate?: boolean;
};


const DefaultCell = memo(function ({ cellValue, truncate = true }: DefaultCellProps) {
  const [ref, isTruncated] = useIsTruncated<HTMLSpanElement>(cellValue);

  return (
    <div className="flex">
      <ConditionalTooltip show={isTruncated} content={cellValue}>
        <span ref={ref} className={`text-sm text-gray-700 dark:text-gray-100 px-3 ${truncate ? 'truncate' : ''}`}>
          {cellValue}
        </span>
      </ConditionalTooltip>
    </div>
  );
});

export {
  DefaultCell
};