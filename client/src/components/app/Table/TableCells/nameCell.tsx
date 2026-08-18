import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type NameCellProps = {
  cellValue: string;
  link: string;
};


// DataTable sizes the Name column to fit the longest name in the list, so the
// horizontal padding used here is baked into CELL_HORIZONTAL_SPACE in
// use-fitted-column-widths - keep the two in step. `truncate` is then only reached
// by names past that hook's maximum width, which is what the tooltip is left for.
const NameCell = memo(function ({ cellValue, link}: NameCellProps) {
  const [ref, isTruncated] = useIsTruncated<HTMLSpanElement>(cellValue);

  return (
    <div className="flex py-0.5">
      <Link
        to={`/${link}`}
        className="min-w-0 flex-1"
      >
        <ConditionalTooltip show={isTruncated} content={cellValue}>
          <span ref={ref} className="block truncate text-sm text-blue-600 dark:text-blue-500 hover:underline px-3">
            {cellValue}
          </span>
        </ConditionalTooltip>
      </Link>
    </div>

  );
});

export {
  NameCell
};