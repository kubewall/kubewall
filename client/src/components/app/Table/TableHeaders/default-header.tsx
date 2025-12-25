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
        className={cn("h-8", className)}
      >
        {title}
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
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 hover:bg-accent"
        onClick={handleSort}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <CaretDownIcon className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "asc" ? (
          <CaretUpIcon className="ml-2 h-4 w-4" />
        ) : (
          <CaretSortIcon className="ml-2 h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
