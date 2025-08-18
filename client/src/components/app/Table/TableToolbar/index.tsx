import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startTransition } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect } from "react";

import { AddResource } from "@/components/app/Common/AddResource";
import { Button } from "@/components/ui/button";
import { Cross2Icon } from "@radix-ui/react-icons";
import { DataTableFacetedFilter } from "@/components/app/Table/TableFacetedFilter";
import { DataTableGenericFacetedFilter } from "@/components/app/Table/TableGenericFacetedFilter";
import { DataTableViewOptions } from "@/components/app/Table/TableViewOptions";
import { DebouncedInput } from "@/components/app/Common/DeboucedInput";
import { RootState } from "@/redux/store";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table } from "@tanstack/react-table";
import { namespacesFilter, nodesFilter, statusFilter, qosFilter, helmReleasesStatusFilter, nodeArchitectureFilter, nodeConditionFilter, nodeOperatingSystemFilter } from "@/utils";
import { resetFilterNamespace } from "@/data/Misc/ListTableNamesapceSlice";
import { resetFilterNode, updateFilterNode } from "@/data/Misc/ListTableNodeSlice";
import { resetFilterStatus, updateFilterStatus } from "@/data/Misc/ListTableStatusSlice";
import { resetFilterQos, updateFilterQos } from "@/data/Misc/ListTableQosSlice";
import { resetFilterNodeArchitecture, updateFilterNodeArchitecture } from "@/data/Misc/ListTableNodeArchitectureSlice";
import { resetFilterNodeCondition, updateFilterNodeCondition } from "@/data/Misc/ListTableNodeConditionSlice";
import { resetFilterNodeOperatingSystem, updateFilterNodeOperatingSystem } from "@/data/Misc/ListTableNodeOperatingSystemSlice";
import { updateListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { Kbd } from "@/components/ui/kbd";
import { ConnectionStatusDot } from "@/components/app/Common/ConnectionStatus";
import TableDelete from "@/components/app/Table/TableDelete";
import { useRouterState } from "@tanstack/react-router";
import { getEventStreamUrl, createEventStreamQueryObject } from "@/utils/MiscUtils";
import { NAMESPACES_ENDPOINT } from "@/constants/ApiConstants";
import { updateNamspaces } from "@/data/Clusters/Namespaces/NamespacesSlice";

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  globalFilter: string;
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>;
  showNamespaceFilter: boolean;
  showPodFilters?: boolean;
  showStatusFilter?: boolean;
  showNodeFilters?: boolean;
  podData?: any[];
  helmReleasesData?: any[];
  nodeData?: any[];
  loading?: boolean;
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting' | 'error';
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
  showNamespaceFilter,
  showPodFilters = false,
  showStatusFilter = false,
  showNodeFilters = false,
  podData = [],
  helmReleasesData = [],
  nodeData = [],
  loading = true,
  connectionStatus = 'connected',
}: DataTableToolbarProps<TData>) {
  const dispatch = useAppDispatch();
  const router = useRouterState();
  const {
    namespaces
  } = useAppSelector((state: RootState) => state.namespaces);
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
  
  // Extract config and cluster from URL
  const configName = router.location.pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';
  
  // Fetch namespaces when namespace filter is needed but data is not available
  useEffect(() => {
    if (showNamespaceFilter && configName && clusterName && (!namespaces || namespaces.length === 0)) {
      // Fetch namespaces using a simple fetch request instead of EventSource
      // since we only need the initial data, not real-time updates
      const fetchNamespaces = async () => {
        try {
          const queryParams = createEventStreamQueryObject(configName, clusterName);
          const url = getEventStreamUrl(NAMESPACES_ENDPOINT, queryParams).replace('/api/v1/stream/', '/api/v1/');
          
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            dispatch(updateNamspaces(data));
          }
        } catch (error) {
          console.error('Failed to fetch namespaces:', error);
        }
      };
      
      fetchNamespaces();
    }
  }, [showNamespaceFilter, configName, clusterName, namespaces, dispatch]);
  
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between px-2 py-2">
      <div className="flex flex-1 items-center space-x-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4 ml-1" />
        <div className="relative w-full basis-7/12">
          <DebouncedInput
            placeholder="Search..."
            value={globalFilter ?? ''}
            onChange={(value) => {
              startTransition(() => {
                setGlobalFilter(String(value));
                dispatch(updateListTableFilter(String(value)));
              });
            }}
            className="h-8 w-full shadow-none pr-10 pl-2" // add pr-10 to make space for kbd
          />

          <Kbd inline={false}>/</Kbd>
        </div>
        {showNamespaceFilter && !loading && namespaces && Array.isArray(namespaces) && namespaces.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("Namespace")}
            title="Namespaces"
            options={namespacesFilter(namespaces)}
          />
        )}
        {showStatusFilter && !loading && helmReleasesData && Array.isArray(helmReleasesData) && helmReleasesData.length > 0 && (
          <DataTableGenericFacetedFilter
            column={table.getColumn("Status")}
            title="Status"
            options={helmReleasesStatusFilter(helmReleasesData)}
            selectedValues={selectedStatuses}
            onSelectionChange={(values) => dispatch(updateFilterStatus(values))}
            onReset={() => dispatch(resetFilterStatus())}
          />
        )}
        {showPodFilters && !loading && podData && Array.isArray(podData) && podData.length > 0 && (
          <>
            <DataTableGenericFacetedFilter
              column={table.getColumn("Node")}
              title="Nodes"
              options={nodesFilter(podData)}
              selectedValues={selectedNodes}
              onSelectionChange={(values) => dispatch(updateFilterNode(values))}
              onReset={() => dispatch(resetFilterNode())}
            />
            <DataTableGenericFacetedFilter
              column={table.getColumn("Status")}
              title="Status"
              options={statusFilter(podData)}
              selectedValues={selectedStatuses}
              onSelectionChange={(values) => dispatch(updateFilterStatus(values))}
              onReset={() => dispatch(resetFilterStatus())}
            />
            <DataTableGenericFacetedFilter
              column={table.getColumn("QOS")}
              title="QoS"
              options={qosFilter(podData)}
              selectedValues={selectedQos}
              onSelectionChange={(values) => dispatch(updateFilterQos(values))}
              onReset={() => dispatch(resetFilterQos())}
            />
          </>
        )}
        {showNodeFilters && !loading && nodeData && Array.isArray(nodeData) && nodeData.length > 0 && (
          <>
            <DataTableGenericFacetedFilter
              column={table.getColumn("architecture")}
              title="Architecture"
              options={nodeArchitectureFilter(nodeData)}
              selectedValues={selectedArchitectures}
              onSelectionChange={(values) => dispatch(updateFilterNodeArchitecture(values))}
              onReset={() => dispatch(resetFilterNodeArchitecture())}
            />
            <DataTableGenericFacetedFilter
              column={table.getColumn("conditionStatus")}
              title="Condition"
              options={nodeConditionFilter(nodeData)}
              selectedValues={selectedConditions}
              onSelectionChange={(values) => dispatch(updateFilterNodeCondition(values))}
              onReset={() => dispatch(resetFilterNodeCondition())}
            />
            <DataTableGenericFacetedFilter
              column={table.getColumn("operatingSystem")}
              title="Operating System"
              options={nodeOperatingSystemFilter(nodeData)}
              selectedValues={selectedOperatingSystems}
              onSelectionChange={(values) => dispatch(updateFilterNodeOperatingSystem(values))}
              onReset={() => dispatch(resetFilterNodeOperatingSystem())}
            />
          </>
        )}
        {isFiltered && (showNamespaceFilter || showPodFilters || showStatusFilter || showNodeFilters) && !loading && (
          <Button
            variant="ghost"
            onClick={() => { 
              table.resetColumnFilters(); 
              if (showNamespaceFilter) dispatch(resetFilterNamespace());
              if (showStatusFilter) dispatch(resetFilterStatus());
              if (showPodFilters) {
                dispatch(resetFilterNode());
                dispatch(resetFilterStatus());
                dispatch(resetFilterQos());
              }
              if (showNodeFilters) {
                dispatch(resetFilterNodeArchitecture());
                dispatch(resetFilterNodeCondition());
                dispatch(resetFilterNodeOperatingSystem());
              }
            }}
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
                <div className="flex items-center mr-8 border px-3 text-xs font-medium rounded-md h-8 cursor-default">
                  <ConnectionStatusDot status={connectionStatus} />
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
      {!loading && <Separator orientation="vertical" className="h-6 mx-3" />}
      {/* Place delete next to view options (top-right); show only when rows are selected */}
      <DataTableViewOptions table={table} />
      {table.getSelectedRowModel().rows.length > 0 && (
        <TableDelete
          // eslint-disable-next-line  @typescript-eslint/no-explicit-any
          selectedRows={table.getSelectedRowModel().rows as any}
          toggleAllRowsSelected={(value: boolean) => table.toggleAllPageRowsSelected(!value)}
        />
      )}
      <AddResource />
    </div>
  );
}
