import { ClusterDetails, HeaderList, TableColumns } from '@/types';

import { ColumnDef } from '@tanstack/react-table';
import { DefaultHeader } from '@/components/app/Table';
import { SelectAllHeader } from '@/components/app/Table/TableHeaders/select-all-header';
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
          header: ({ column, table }) => 
            headerList.title === 'Select' 
              ? <SelectAllHeader table={table} />
              : <DefaultHeader column={column} title={headerList.title} />,
          accessorKey: headerList.accessorKey,
          id: headerList.title,
          cell: ({ row, getValue, table }) => (
            <TableCells
              clusterName={clusterName}
              configName={configName}
              instanceType={instanceType}
              loading={loading}
              // Use metadata.namespace when present; fall back to top-level namespace
              // eslint-disable-next-line  @typescript-eslint/no-explicit-any
              namespace={ (row.original as any)?.metadata?.namespace ?? (row.original as any)?.namespace ?? ''}
              type={headerList.title}
              value={(() => {
                try {
                  const v = getValue();
                  if (v === undefined || v === null) return '';
                  if (typeof v === 'string') return v;
                  return String(v);
                } catch {
                  return '';
                }
              })()}
              queryParams={queryParams}
              row={row}
              table={table}
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
