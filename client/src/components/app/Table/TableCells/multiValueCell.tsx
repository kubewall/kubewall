import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { memo } from "react";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type MultiValueCellProps = {
  cellValue: string;
  truncate?: boolean;
};

type MultiValueItemProps = {
  value: string;
  truncate: boolean;
};

// A hook is needed per value, and the number of comma-separated values
// varies per row - pulled into its own component since hooks can't run
// inside the .map() below.
const MultiValueItem = memo(function ({ value, truncate }: MultiValueItemProps) {
  const [ref, isTruncated] = useIsTruncated<HTMLSpanElement>(value);

  return (
    <ConditionalTooltip show={isTruncated} content={value}>
      <span ref={ref} className={`block text-sm text-gray-700 dark:text-gray-100 ${truncate ? 'truncate' : ''}`}>
        {value}
      </span>
    </ConditionalTooltip>
  );
});

const MultiValueCell = memo(function ({ cellValue, truncate = true }: MultiValueCellProps) {
  return (
    <div className="min-w-0">
      {
        cellValue.split(',').map((value) => (
          <MultiValueItem key={value} value={value} truncate={truncate} />
        ))
      }

    </div>
  );
});

export {
  MultiValueCell
};
