import { memo } from "react";

type CurrentByDesiredCellProps = {
  cellValue: string;
};


const CurrentByDesiredCell = memo(function ({ cellValue }: CurrentByDesiredCellProps) {
  const valueArray = cellValue.split('/');
  const isReady = valueArray[0] === valueArray[1];
  return (

    <div className="">
      <span className={`text-sm truncate text-gray-600 dark:text-gray-400 px-3 ${isReady ? 'text-emerald-400' :'text-red-400'}`}>
        {cellValue}
      </span>
    </div>
  );
});

export {
  CurrentByDesiredCell
};