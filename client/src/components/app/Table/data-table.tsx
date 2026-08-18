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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Button } from "@/components/ui/button";
import { DataTableToolbar, getSearchTarget } from "@/components/app/Table/TableToolbar";
import { Loader } from '@/components/app/Loader';
import { RootState } from "@/redux/store";
import { Separator } from '@/components/ui/separator';
import { TableDelete } from './TableDelete';
import { useFittedColumnWidths } from "@/hooks/use-fitted-column-widths";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { X } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Rows are single-line and fairly uniform; this is just a starting estimate -
// useVirtualizer corrects it per-row once each one is actually measured.
const ESTIMATED_ROW_HEIGHT = 40;

// kwAI pulls in every LLM provider SDK plus the markdown/highlight pipeline;
// load it only when the chat panel is actually opened.
const AiChat = lazy(() => import('../kwAI').then((m) => ({ default: m.AiChat })));

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableWidthCss: string;
  showNamespaceFilter: boolean;
  instanceType: string;
  kind?: string;
  showToolbar?: boolean;
  loading?: boolean;
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
}

declare global {
  interface Window {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    safari: any;
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
  instanceType,
  kind,
  showToolbar = true,
  loading = false,
  setShowChat,
  showChat
}: DataTableProps<TData, TValue>) {

  const dispatch = useAppDispatch();
  const {
    searchString
  } = useAppSelector((state: RootState) => state.listTableFilter);
  const {
    selectedNamespace
  } = useAppSelector((state: RootState) => state.listTableNamesapce);

  const getDefaultValue = () => {
    if (selectedNamespace.length > 0) {
      return [{
        id: 'Namespace',
        value: Array.from(selectedNamespace)
      }];
    }
    return [];
  };
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState(searchString);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(getDefaultValue());

  useEffect(() => {
    setGlobalFilter(searchString);
  }, [searchString]);
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

  const { rows } = table.getRowModel();

  // Measured off `data` (the unfiltered list) rather than the filtered rows so these
  // columns fit every value they can ever show and hold still while searching. Which
  // columns get fitted is the hook's call; the rest keep their static size.
  const fittedColumnWidths = useFittedColumnWidths(data, table.getAllLeafColumns());

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  const getIdAndSetClass = (shouldSetClass: boolean, id: string) => {
    if (shouldSetClass) {
      setTimeout(() => {
        document.getElementById(id)?.classList.remove("table-row-bg");
      }, 2000);
      document.getElementById(id)?.classList.add("table-row-bg");
    }
    return id;
  };
  useEffect(() => {
    setRowSelection({});
  }, [instanceType]);


  const selectedCount = Object.keys(rowSelection).length;
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!selectedCount) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Let an open dialog/menu (e.g. the delete confirmation) take Escape first,
      // and don't hijack it from a field that clears on Escape.
      if (document.querySelector('[data-state="open"][role="dialog"],[data-state="open"][role="menu"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      setRowSelection({});
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCount]);
  const onChatClose = () => {
    setShowChat(false);
    setFullScreen(false);
  };

  const handleClearSearch = () => {
    setGlobalFilter('');
    dispatch(resetListTableFilter());
  };

  return (
    <>
      {
        showToolbar
        && <DataTableToolbar loading={loading} table={table} globalFilter={globalFilter} setGlobalFilter={setGlobalFilter} showNamespaceFilter={showNamespaceFilter} showChat={showChat} setShowChat={setShowChat} instanceType={instanceType} kind={kind} />
      }
      {

        window.safari !== undefined &&
        <div className='flex bg-red-500 dark:bg-red-900 items-center justify-between text-xs font-light px-2 py-1'>
          <span className='text-xs text-white'>We detected you are on Safari browser and are using http. For seemless expereince switch over to HTTPS or chrome/firefox. More details <a className='underline' href='https://github.com/kubewall/kubewall/wiki/FAQ#https' target='blank'>here</a></span>
        </div>
      }
      <ResizablePanelGroup
        direction="horizontal"
      >
        {
          !fullScreen &&
          <ResizablePanel id="table" order={1} defaultSize={showChat ? 55 : 100}>
            <div className="relative h-full">
            <div ref={tableContainerRef} className={`border border-x-0 overflow-auto ${tableWidthCss} `}>
              <TooltipProvider delayDuration={0}>
              <Table style={{ tableLayout: 'fixed' }}>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        // table-layout: fixed - the header cell is what sizes the column.
                        const width = fittedColumnWidths[header.column.id] ?? header.getSize();
                        return (
                          <TableHead
                            key={header.id}
                            colSpan={header.colSpan}
                            style={{ width: `${width}px` }}
                          >
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
                  {rows.length ? (
                    <>
                      {paddingTop > 0 && (
                        <tr>
                          <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                        </tr>
                      )}
                      {virtualRows.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                          <TableRow
                            key={row.id}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            id={getIdAndSetClass(row.original.hasUpdated, row.original.name)}
                            data-state={row.getIsSelected() && 'selected'}
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
                        );
                      })}
                      {paddingBottom > 0 && (
                        <tr>
                          <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                        </tr>
                      )}
                    </>
                  ) : null}
                </TableBody>
              </Table>
              {!rows.length && (
                <div className="absolute inset-x-0 top-10 bottom-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-center pointer-events-auto">
                    {globalFilter ? (
                      <>
                        <p>No results found for search term &quot;{globalFilter}&quot;</p>
                        <p className="text-sm text-muted-foreground">Check the spelling, or try a shorter search term.</p>
                        <Button
                          variant="secondary"
                          onClick={handleClearSearch}
                          className="mt-1 h-8 gap-1.5 px-3"
                        >
                          Clear Search
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <p>No {getSearchTarget(instanceType, kind)} found in cluster.</p>
                    )}
                  </div>
                </div>
              )}
              </TooltipProvider>
            </div>
            {
              selectedCount > 0 &&
              <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-end px-4">
                <div className="pointer-events-auto flex items-center gap-2 rounded-xl border bg-background p-1.5 pl-3 shadow-lg">
                  <span className="whitespace-nowrap text-sm tabular-nums">{selectedCount} selected</span>
                  <Separator orientation="vertical" className="h-5" />
                  <TableDelete selectedRows={table.getSelectedRowModel().rows} toggleAllRowsSelected={table.resetRowSelection} />
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 text-sm" onClick={() => table.resetRowSelection()}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            }
            </div>
          </ResizablePanel>
        }


        {
          showChat &&
          <>
            { !fullScreen && <ResizableHandle withHandle/> }
            <ResizablePanel id="ai-chat" order={2} minSize={30} defaultSize={fullScreen ? 100 : 45}>
              <Suspense fallback={<Loader />}>
                <AiChat customHeight='chatbot-height' isFullscreen={fullScreen} onClose={onChatClose} onToggleFullscreen={() => setFullScreen(!fullScreen)} />
              </Suspense>
            </ResizablePanel>
          </>
        }

      </ResizablePanelGroup>


    </>
  );
} 