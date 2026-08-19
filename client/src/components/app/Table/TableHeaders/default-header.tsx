import {
  CaretDownIcon,
  CaretUpIcon,
  CaretSortIcon,
} from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import { Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DefaultHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 min-w-0 max-w-full pl-3 pr-1", className)}
      >
        <span className="truncate">{title}</span>
      </Button>
    );
  }

  const handleSort = () => {
    const currentSort = column.getIsSorted();
    if (currentSort === "asc") {
      column.toggleSorting(true);
    } else if (currentSort === "desc") {
      column.clearSorting();
    } else {
      column.toggleSorting(false);
    }
  };

  return (
    <div className={cn("flex min-w-0 items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 max-w-full pl-3 pr-1 hover:bg-accent"
        onClick={handleSort}
      >
        <span className="truncate">{title}</span>
        {column.getIsSorted() === "desc" ? (
          <CaretDownIcon className="ml-2 h-4 w-4 shrink-0" />
        ) : column.getIsSorted() === "asc" ? (
          <CaretUpIcon className="ml-2 h-4 w-4 shrink-0" />
        ) : (
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0" />
        )}
      </Button>
    </div>
  );
}
