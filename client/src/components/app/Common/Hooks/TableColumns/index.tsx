import { ClusterDetails, HeaderList, TableColumns } from '@/types';

import { ColumnDef } from '@tanstack/react-table';
import { DefaultHeader } from '@/components/app/Table';
import { TableCells } from '@/components/app/Table/TableCells';
import { useMemo } from 'react';

function GenerateColumns<T extends ClusterDetails, C extends HeaderList>({
  count,
  clusterName,
  configName,
  loading,
  headersList,
  instanceType,
  queryParams
}: TableColumns & { headersList: C[] }): ColumnDef<T,C>[] {
  return useMemo<ColumnDef<T,C>[]>(
    () =>
      headersList.map((headerList) => {
        return {
          header: ({ column }) => <DefaultHeader column={column} title={headerList.title === 'Select' ? '' : headerList.title} />,
          accessorKey: headerList.accessorKey,
          id: headerList.title,
          cell: ({ row, getValue }) => (
            <TableCells
              clusterName={clusterName}
              configName={configName}
              instanceType={instanceType}
              loading={loading}
              // eslint-disable-next-line  @typescript-eslint/no-explicit-any
              namespace={ (row.original as any).metadata ? ((row.original as any).metadata).namespace : (row.original as any).namespace}
              type={headerList.title}
              value={String(getValue())}
              queryParams={queryParams}
              row={row}
            />
          ),
          filterFn: (row, id, value) => {
            return value.includes(row.getValue(id));
          },
          enableSorting: headerList.enableSorting ?? true,
          enableGlobalFilter: !!headerList.enableGlobalFilter
        };
      }),
    [count,
      clusterName,
      configName,
      loading,
      headersList,
      instanceType,
      queryParams]
  );
}

export default GenerateColumns;
