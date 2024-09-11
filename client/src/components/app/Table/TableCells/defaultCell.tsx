import { memo } from "react";

type DefaultCellProps = {
  cellValue: string;
  truncate?: boolean;
};


const DefaultCell = memo(function ({ cellValue, truncate=true }: DefaultCellProps) {
  return (
    <div className="flex">
      <span title={cellValue} className={`max-w-[750px] text-sm text-gray-600 dark:text-gray-400 px-3 ${truncate && 'truncate'}`}>
        {cellValue}
      </span>
    </div>
  );
});

export {
  DefaultCell
};