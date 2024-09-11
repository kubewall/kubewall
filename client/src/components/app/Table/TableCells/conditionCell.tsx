import { Badge } from "@/components/ui/badge";
import { memo } from "react";

type ConditionCellProps = {
  cellValue: string;
};


const ConditionCell = memo(function ({ cellValue }: ConditionCellProps) {

  return (

    <span className="px-3">
    {
      cellValue.split(',').map((val) => {
       return  val === 'Available' || val === 'Complete'?
        <Badge  className="ml-1" key={val} variant="default">{val}</Badge> :
        val  === 'Failed'?
        <Badge className="ml-1" key={val} variant="destructive">{val}</Badge>
        : <Badge  className="ml-1" key={val} variant="outline">{val}</Badge>;
      })
    }
    </span>

  );
});

export {
  ConditionCell
};