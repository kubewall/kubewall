import { Badge } from "@/components/ui/badge";
import { ConditionalTooltip } from "@/components/app/Common/ConditionalTooltip";
import { useIsTruncated } from "@/hooks/use-is-truncated";

type StatusCellProps = {
  cellValue: string;
};


function StatusCell({ cellValue }: StatusCellProps) {
  const [ref, isTruncated] = useIsTruncated<HTMLDivElement>(cellValue);

  return (
    <span className="px-3 flex">
      <ConditionalTooltip show={isTruncated} content={cellValue}>
        {
          cellValue === 'Running' || cellValue === 'Active' || cellValue === 'Created' || cellValue === 'True' ?
          <Badge ref={ref} className="min-w-0 max-w-full truncate block" variant="default">{cellValue}</Badge>
          : cellValue === 'Failed' || cellValue === 'Killing' || cellValue === 'False'?
          <Badge ref={ref} className="min-w-0 max-w-full truncate block px-4" variant="destructive">{cellValue}</Badge>
          : <Badge ref={ref} className="min-w-0 max-w-full truncate block" variant="outline">{cellValue}</Badge>
        }
      </ConditionalTooltip>
    </span>
  );
}

export {
  StatusCell
};