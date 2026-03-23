import { useEffect, useState } from "react";

import { getDisplayTime } from "@/utils";

type TimeCellProps = {
  cellValue: string;
};

function TimeCell({ cellValue }: TimeCellProps) {
  const startMs = new Date(cellValue).getTime();
  const [elapsed, setElapsed] = useState(() => Date.now() - startMs);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - startMs);
    }, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return (
    <div className="px-3">
      <span title={cellValue} className="text-sm text-gray-700 dark:text-gray-100">
        {getDisplayTime(elapsed)}
      </span>
    </div>
  );
}

export {
  TimeCell
};
