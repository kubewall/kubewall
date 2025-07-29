import { useEffect, useState } from "react";

import { intervalToDuration } from "date-fns";
import { mathFloor } from "@/utils";

type TimeCellProps = {
  cellValue: string;
};


function TimeCell({ cellValue }: TimeCellProps) {
  // Validate the date string before creating Date object
  const parseDate = (dateString: string) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return new Date(); // Return current date if invalid
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date; // Return current date if invalid
  };
  
  const [currentTime, setCurrentTime] = useState((new Date()).getTime() - parseDate(cellValue).getTime());
  const [timerId, setTimerId] = useState<NodeJS.Timeout>();
  const getDisplayTime = (ts: number) => {
    const duration = intervalToDuration({ start: 0, end: ts });
    if(ts < 60000){
      return `${mathFloor(duration.seconds)}s`;
    } else if(ts < 3600000) {
      return `${mathFloor(duration.minutes)}m:${mathFloor(duration.seconds)}s`;
    } else if (ts < 86400000) {
      return `${mathFloor(duration.hours)}h:${mathFloor(duration.minutes)}m`;
    } else if (ts < 604800000) {
      return `${mathFloor(duration.days)}d:${mathFloor(duration.hours)}h`;
    } else if (ts < 2628000000 && duration.days) {
      const weeks = duration.days / 7 ;
      const days = duration.days % 7 ;
      return `${mathFloor(weeks)}w:${mathFloor(days)}d`;
    } else if (ts < 31540000000) {
      let weeks = 0;
      if(duration.days) {
        weeks = duration.days / 7 ;
      }
      return `${mathFloor(duration.months)}M:${mathFloor(weeks)}w`;
    } else {
      return `${mathFloor(duration.years)}y:${mathFloor(duration.months)}M`;
    }
  };


  useEffect(() => {
    clearTimeout(timerId);
    const timeCellId = setInterval(() => {

      setCurrentTime((currentTime) => currentTime + 500);
    },1000);
    setTimerId(timeCellId);
    return () => {
      clearTimeout(timerId);
    };
  },[]);
  return (
    <div className="px-3">
      <span title={cellValue} className="text-sm text-gray-700 dark:text-gray-400">
        {getDisplayTime(Number(currentTime))}
      </span>
    </div>
  );
}

export {
  TimeCell
};