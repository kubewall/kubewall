import { ClusterDetails, HeaderList, TableColumns } from '@/types';

import { ColumnDef } from '@tanstack/react-table';
import { DefaultHeader } from '@/components/app/Table';
import { TableCells } from '@/components/app/Table/TableCells';
import { useMemo } from 'react';

// Static, content-type-driven widths for table-layout: fixed. Virtualization only
// keeps a window of rows in the DOM, so the browser's native "auto" table layout
// (which sizes columns from whichever rows are currently mounted) makes column
// widths visibly shift as different rows scroll in. Fixed widths sidestep that
// entirely - they don't depend on which rows are mounted, or on measuring actual
// cell content at all, so they can't jitter and can't go stale as SSE pushes live
// updates into the table. Grouped by the same content type TableCells already
// dispatches on (Name/Status/Age/etc.), not by literal column title, since that
// shape (link, pill, relative time, ...) - not the title - is what determines how
// much width a column actually needs.
const CHECKBOX_COLUMN_WIDTH = 40;
const NAME_COLUMN_WIDTH = 280;
const READY_COLUMN_WIDTH = 70;
const STATUS_PILL_COLUMN_WIDTH = 140;
const CONDITIONS_COLUMN_WIDTH = 180;
const TIME_COLUMN_WIDTH = 90;
const MULTI_VALUE_COLUMN_WIDTH = 200;
const DEFAULT_COLUMN_WIDTH = 140;

function getColumnWidth(title: string): number {
  switch (title) {
    case 'Select':
      return CHECKBOX_COLUMN_WIDTH;
    case 'Name':
    case 'Namespace':
    case 'Node':
      return NAME_COLUMN_WIDTH;
    case 'Ready':
    case 'Current':
      return READY_COLUMN_WIDTH;
    case 'Status':
    case 'reason':
    case 'Condition Status':
      return STATUS_PILL_COLUMN_WIDTH;
    case 'Conditions':
      return CONDITIONS_COLUMN_WIDTH;
    case 'Container Runtime Version':
      return 200;
    case 'Age':
    case 'Duration':
    case 'eventTime':
    case 'firstTimestamp':
    case 'lastTimestamp':
    case 'Last Restart':
      return TIME_COLUMN_WIDTH;
    case 'Rules':
    case 'Ports':
    case 'Bindings':
    case 'Roles':
    case 'Keys':
    case 'External IP':
      return MULTI_VALUE_COLUMN_WIDTH;
    default:
      return DEFAULT_COLUMN_WIDTH;
  }
}

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
          size: getColumnWidth(headerList.title),
          cell: ({ row, getValue, table }) => (
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
