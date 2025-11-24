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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useEffect, useState } from "react";

import { AiChat } from '../kwAI';
import { DataTableToolbar } from "@/components/app/Table/TableToolbar";
import { RootState } from "@/redux/store";
import { useAppSelector } from "@/redux/hooks";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableWidthCss: string;
  showNamespaceFilter: boolean;
  instanceType: string;
  showToolbar?: boolean;
  loading?: boolean;
  isEventTable?: boolean;
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
  showToolbar = true,
  loading = false,
  isEventTable = false,
  setShowChat,
  showChat
}: DataTableProps<TData, TValue>) {

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


  const [fullScreen, setFullScreen] = useState(false);
  const onChatClose = () => {
    setShowChat(false);
    setFullScreen(false);
  };

  return (
    <>
      {
        showToolbar
        && <DataTableToolbar loading={loading} table={table} globalFilter={globalFilter} setGlobalFilter={setGlobalFilter} showNamespaceFilter={showNamespaceFilter} showChat={showChat} setShowChat={setShowChat} />
      }
      {

        window.safari !== undefined &&
        <div className='flex bg-red-500 dark:bg-red-900 items-center justify-between text-xs font-light px-2 py-1'>
          <span className='text-xs text-white'>We detected you are on Safari browser and are using http. For seemless expereince switch over to chrome/firefox. More details <a className='underline' href='https://github.com/kubewall/kubewall/wiki/FAQ#https' target='blank'>here</a></span>
        </div>
      }
      <ResizablePanelGroup
        direction="horizontal"
      >
        {
          !fullScreen &&
          <ResizablePanel id="table" order={1} defaultSize={showChat ? 55 : 100}>
            <div className={`border border-x-0 overflow-auto ${tableWidthCss} `}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
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
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row, index) => (
                      <TableRow
                        key={index}
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
                    ))
                  ) : (
                    <TableRow className={isEventTable ? 'empty-table-events' : 'empty-table'}>
                      <TableCell
                        colSpan={columns.length}
                        className="text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ResizablePanel>
        }


        {
          showChat &&
          <>
            {!fullScreen && <ResizableHandle withHandle />}
            <ResizablePanel id="ai-chat" order={2} minSize={30} defaultSize={fullScreen ? 100 : 45}>
              {/* <div className="flex h-full items-center justify-center p-6">
                <span className="font-semibold">Sidebar</span>
              </div> */}
              <AiChat customHeight='chatbot-height' isFullscreen={fullScreen} onClose={onChatClose} onToggleFullscreen={() => setFullScreen(!fullScreen)} />
            </ResizablePanel>
          </>
        }

      </ResizablePanelGroup>


    </>
  );
} 