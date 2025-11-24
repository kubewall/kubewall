import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { Button } from "@/components/ui/button";
import { Cross2Icon } from "@radix-ui/react-icons";
import { DataTableFacetedFilter } from "@/components/app/Table/TableFacetedFilter";
import { DataTableViewOptions } from "@/components/app/Table/TableViewOptions";
import { DebouncedInput } from "@/components/app/Common/DeboucedInput";
import { Kbd } from "@/components/ui/kbd";
import { RootState } from "@/redux/store";
import { Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Sparkles } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { ThemeModeSelector } from "@/components/app/Common/ThemeModeSelector";
import { namespacesFilter } from "@/utils";
import { resetFilterNamespace } from "@/data/Misc/ListTableNamesapceSlice";
import { updateListTableFilter } from "@/data/Misc/ListTableFilterSlice";

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  globalFilter: string;
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>;
  showNamespaceFilter: boolean;
  loading?: boolean;
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
  showNamespaceFilter,
  loading = true,
  showChat,
  setShowChat,
}: DataTableToolbarProps<TData>) {
  const {
    namespaces
  } = useAppSelector((state: RootState) => state.namespaces);
  const dispatch = useAppDispatch();
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between px-2 py-2">
      <div className="flex flex-1 items-center space-x-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 ml-1 data-[orientation=vertical]:h-4" />
        <div className="relative w-full basis-7/12">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <DebouncedInput
            placeholder="Type / to search..."
            value={globalFilter ?? ''}
            onChange={(value) => {
              setGlobalFilter(String(value));
              dispatch(updateListTableFilter(String(value)));
            }}
            className="h-8 w-full shadow-none pl-8 pr-10" // add pr-10 to make space for kbd
          />

          <Kbd inline={false}>/</Kbd>
        </div>
        {showNamespaceFilter && !loading && namespaces && namespaces.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("Namespace")}
            title="Namespaces"
            options={namespacesFilter(namespaces)}
          />
        )}
        {isFiltered && showNamespaceFilter && !loading && namespaces && namespaces.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => { table.resetColumnFilters(); dispatch(resetFilterNamespace()); }}
            className="h-8 px-2 lg:px-3 shadow-none"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
        {!loading &&
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center mr-5 border px-3 text-xs font-medium rounded-md h-8 cursor-default">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="pl-2">{table.getFilteredRowModel().rows.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Total count
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      </div>
      <DataTableViewOptions table={table} />
      <ThemeModeSelector />

      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="ml-2 relative inline-block cursor-pointer" onClick={() => setShowChat(!showChat)}>
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-600 to-blue-500 rounded-sm blur-[4px] animate-pulse"></div>
              <div className="relative inline-flex i gap-[0.125rem] w-12 h-8 bg-background rounded-md flex items-center justify-center border border-gray-200 dark:border-none shadow-sm hover:bg-accent hover:text-accent-foreground">
                <Sparkles className="w-4 h-4" />
                <span className='text-xs'>AI</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            kwAI Chat
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
