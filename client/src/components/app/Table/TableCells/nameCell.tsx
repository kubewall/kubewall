import { Link } from "@tanstack/react-router";
import { memo } from "react";

type NameCellProps = {
  cellValue: string;
  link: string;
};


const NameCell = memo(function ({ cellValue, link}: NameCellProps) {

  return (
    <div className="flex py-0.5">
      <Link
        to={`/${link}`}
      >
        <span title={cellValue} className="max-w-[750px] text-sm truncate text-blue-600 dark:text-blue-500 hover:underline px-3">
          {cellValue}
        </span>
      </Link>
    </div>

  );
});

export {
  NameCell
};