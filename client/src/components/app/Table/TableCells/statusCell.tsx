import { Badge } from "@/components/ui/badge";

type StatusCellProps = {
  cellValue: string;
};


function StatusCell({ cellValue }: StatusCellProps) {
  return (
    <span className="px-3">
    {
      cellValue === 'Running' || cellValue === 'Active' || cellValue === 'Created' || cellValue === 'True' ?
      <Badge variant="default">{cellValue}</Badge>
      : cellValue === 'Failed' || cellValue === 'Killing' || cellValue === 'False'?
      <Badge className="px-4" variant="destructive">{cellValue}</Badge>
      : <Badge variant="outline">{cellValue}</Badge>
    }
    </span>
  );
}

export {
  StatusCell
};