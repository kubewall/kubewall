import { useEffect, useState } from "react";

import { getDisplayTime } from "@/utils";

type TimeCellProps = {
  cellValue: string;
};


function TimeCell({ cellValue }: TimeCellProps) {
  const [currentTime, setCurrentTime] = useState((new Date()).getTime() - (new Date(cellValue)).getTime());
  const [timerId, setTimerId] = useState<NodeJS.Timeout>();

  useEffect(() => {
    clearTimeout(timerId);
    const timeCellId = setInterval(() => {

      setCurrentTime((currentTime) => currentTime + 500);
    }, 1000);
    setTimerId(timeCellId);
    return () => {
      clearTimeout(timerId);
    };
  }, []);
  return (
    <div className="px-3">
      <span title={cellValue} className="text-sm text-gray-700 dark:text-gray-100">
        {getDisplayTime(Number(currentTime))}
      </span>
    </div>
  );
}

export {
  TimeCell
};