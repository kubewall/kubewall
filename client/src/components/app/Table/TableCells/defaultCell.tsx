import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { memo } from "react";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type DefaultCellProps = {
  cellValue: string;
  truncate?: boolean;
};


// Namespace renders through here, and DataTable sizes that column to fit its longest
// value, so this cell's horizontal padding is baked into CELL_HORIZONTAL_SPACE in
// use-fitted-column-widths - keep the two in step.
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