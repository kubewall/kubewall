import { Table } from '@tanstack/react-table';
import { IndeterminateCheckbox } from '../TableCells/selectCell';
import React from 'react';

interface SelectAllHeaderProps<TData> {
  table: Table<TData>;
}

export function SelectAllHeader<TData>({
  table,
}: SelectAllHeaderProps<TData>) {
  const isAllSelected = table.getIsAllPageRowsSelected();
  const isSomeSelected = table.getIsSomePageRowsSelected();
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    table.getToggleAllPageRowsSelectedHandler()(event);
  };

  return (
    <div className="pl-2">
      <IndeterminateCheckbox
        checked={isAllSelected || isSomeSelected}
        data-indeterminate={isSomeSelected && !isAllSelected}
        onClick={handleClick}
        aria-label="Select all rows"
      />
    </div>
  );
}