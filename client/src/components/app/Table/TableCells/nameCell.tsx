import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type NameCellProps = {
  cellValue: string;
  link: string;
};


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