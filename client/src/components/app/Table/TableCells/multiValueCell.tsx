import { Fragment, memo } from "react";

type MultiValueCellProps = {
  cellValue: string;
  truncate?: boolean;
};


const MultiValueCell = memo(function ({ cellValue, truncate = true }: MultiValueCellProps) {
  return (
    <div className="">
      {
        cellValue.split(',').map((value) => {
          return (
            <Fragment key={value}>
            <span title={value} className={`max-w-[750px] text-sm text-gray-600 dark:text-gray-400 ${truncate && 'truncate'}`}>
              {value}
            </span>
            <br />
            </Fragment>
          );
        })
      }

    </div>
  );
});

export {
  MultiValueCell
};