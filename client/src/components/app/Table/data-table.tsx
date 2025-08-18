import './index.css';

import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useEffect, useRef, useState } from "react";

import { DataTableToolbar } from "@/components/app/Table/TableToolbar";
import { RootState } from "@/redux/store";

import { useAppSelector } from "@/redux/hooks";
import { CUSTOM_RESOURCES_LIST_ENDPOINT } from "@/constants";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableWidthCss: string;
  showNamespaceFilter: boolean;
  showPodFilters?: boolean;
  showStatusFilter?: boolean;
  showNodeFilters?: boolean;
  instanceType: string;
  showToolbar?: boolean;
  loading?: boolean;
  isEventTable?: boolean;
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting' | 'error';
}

declare global {
  interface Window {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    safari:any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    lastSelectedRow: any;
  }
}


// eslint-disable-next-line  @typescript-eslint/no-explicit-any
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const rowValue = row.getValue(columnId) as string;

  const isMatch = rowValue.toLowerCase().includes(value.toLowerCase());

  addMeta({
    isMatch,
  });

  return isMatch;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  tableWidthCss,
  showNamespaceFilter,
  showPodFilters = false,
  showStatusFilter = false,
  showNodeFilters = false,
  instanceType,
  showToolbar = true,
  loading = false,
  isEventTable = false,
  connectionStatus = 'connected',
}: DataTableProps<TData, TValue>) {

  // --- Manual row virtualization (fixed-height rows) ---
  // Keeps table semantics while rendering only visible rows
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(600);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const rowHeight = 44; // px; keep in sync with table row CSS
  const overscan = 10;

  const {
    searchString
  } = useAppSelector((state: RootState) => state.listTableFilter);
  const {
    selectedNamespace
  } = useAppSelector((state: RootState) => state.listTableNamesapce);
  const {
    selectedNodes
  } = useAppSelector((state: RootState) => state.listTableNode);
  const {
    selectedStatuses
  } = useAppSelector((state: RootState) => state.listTableStatus);
  const {
    selectedQos
  } = useAppSelector((state: RootState) => state.listTableQos);
  const {
    selectedArchitectures
  } = useAppSelector((state: RootState) => state.listTableNodeArchitecture);
  const {
    selectedConditions
  } = useAppSelector((state: RootState) => state.listTableNodeCondition);
  const {
    selectedOperatingSystems
  } = useAppSelector((state: RootState) => state.listTableNodeOperatingSystem);

  const getDefaultValue = () => {
    const filters = [];
    if (selectedNamespace.length > 0) {
      filters.push({
        id: 'Namespace',
        value: Array.from(selectedNamespace)
      });
    }
    if (selectedNodes.length > 0) {
      filters.push({
        id: 'Node',
        value: Array.from(selectedNodes)
      });
    }
    if (selectedStatuses.length > 0) {
      filters.push({
        id: 'Status',
        value: Array.from(selectedStatuses)
      });
    }
    if (selectedQos.length > 0) {
      filters.push({
        id: 'QoS',
        value: Array.from(selectedQos)
      });
    }
    if (selectedArchitectures.length > 0) {
       filters.push({
         id: 'architecture',
         value: Array.from(selectedArchitectures)
       });
     }
     if (selectedConditions.length > 0) {
       filters.push({
         id: 'conditionStatus',
         value: Array.from(selectedConditions)
       });
     }
     if (selectedOperatingSystems.length > 0) {
       filters.push({
         id: 'operatingSystem',
         value: Array.from(selectedOperatingSystems)
       });
     }
    return filters;
  };
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState(searchString);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(getDefaultValue());
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const table = useReactTable({
    data,
    state: {
      globalFilter,
      columnFilters,
      columnVisibility,
      rowSelection
    },
    columns,
    enableRowSelection: true,
    globalFilterFn: fuzzyFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: row => row?.uid || row?.metadata?.uid,
  });

  // Measure container height and subscribe to scroll/resize
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleResize = () => {
      setContainerHeight(el.clientHeight || 600);
    };
    const handleScroll = () => {
      setScrollTop(el.scrollTop || 0);
    };

    handleResize();
    el.addEventListener('scroll', handleScroll, { passive: true });

    const ro = new ResizeObserver(() => handleResize());
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll as EventListener);
      ro.disconnect();
    };
  }, []);

  // Virtualization calculations
  const allRows = table.getRowModel().rows;
  const totalRows = allRows.length;
  const shouldVirtualize = !loading && totalRows > 150; // threshold
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0;
  const visibleCount = shouldVirtualize ? Math.ceil(containerHeight / rowHeight) + overscan * 2 : totalRows;
  const endIndex = shouldVirtualize ? Math.min(totalRows, startIndex + visibleCount) : totalRows;
  const visibleRows = shouldVirtualize ? allRows.slice(startIndex, endIndex) : allRows;
  const topPadding = shouldVirtualize ? startIndex * rowHeight : 0;
  const bottomPadding = shouldVirtualize ? Math.max(0, (totalRows - endIndex) * rowHeight) : 0;

  const getIdAndSetClass = (shouldSetClass: boolean, id: string) => {
    const safeId = typeof id === 'string' ? id : '';
    if (shouldSetClass && safeId) {
      setTimeout(() => {
        document.getElementById(safeId)?.classList.remove("table-row-bg");
      }, 2000);
      document.getElementById(safeId)?.classList.add("table-row-bg");
    }
    return safeId;
  };
  useEffect(() => {
    setRowSelection({});
  }, [instanceType]);

  const emptyMessage = instanceType === CUSTOM_RESOURCES_LIST_ENDPOINT
    ? 'No resources found for this Custom Resource Definition.'
    : 'No results.';

  return (
    <>
      {
        showToolbar
        && <DataTableToolbar loading={loading} table={table} globalFilter={globalFilter} setGlobalFilter={setGlobalFilter} showNamespaceFilter={showNamespaceFilter} showPodFilters={showPodFilters} showStatusFilter={showStatusFilter} showNodeFilters={showNodeFilters} podData={data} helmReleasesData={data} nodeData={data} connectionStatus={connectionStatus} />
      }
      {
         
        window.safari !== undefined && 
        <div className='flex bg-red-500 dark:bg-red-900 items-center justify-between text-xs font-light px-2 py-1'>
        <span className='text-xs text-white'>We detected you are on Safari browser and are using http. For seemless expereince switch over to chrome/firefox. More details <a className='underline' href='https://github.com/Facets-cloud/kube-dash' target='blank'>here</a></span>
      </div>
      }
      
      <div className={`border border-x-0 list-table-container ${tableWidthCss}`}>
        <div className="list-table-scrollable" ref={scrollContainerRef}>
          <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan} className={index === 0 ? 'w-px' : ''}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows?.length ? (
              <>
                {shouldVirtualize && topPadding > 0 && (
                  <TableRow aria-hidden>
                    <TableCell colSpan={columns.length} style={{ height: topPadding, padding: 0, border: 0 }} />
                  </TableRow>
                )}
                {visibleRows.map((row) => (
                  <TableRow
                    key={row.id}
                    id={getIdAndSetClass(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (row.original as any)?.hasUpdated,
                      // Prefer metadata.name for objects that don't have top-level name
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (row.original as any)?.name || (row.original as any)?.metadata?.name || ''
                    )}
                    data-state={row.getIsSelected() && 'selected'}
                    style={shouldVirtualize ? { height: rowHeight } : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {shouldVirtualize && bottomPadding > 0 && (
                  <TableRow aria-hidden>
                    <TableCell colSpan={columns.length} style={{ height: bottomPadding, padding: 0, border: 0 }} />
                  </TableRow>
                )}
              </>
            ) : (
              <TableRow className={isEventTable ? 'empty-table-events' : 'empty-table'}>
                <TableCell
                  colSpan={columns.length}
                  className="text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </>
  );
}