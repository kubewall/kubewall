import { ClusterDetails, HeaderList } from "@/types";
import { defaultSkeletonRow, getEventStreamUrl } from "@/utils";

import { ActionCreatorWithPayload } from "@reduxjs/toolkit";
import { DataTable } from "@/components/app/Table";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/redux/hooks";
import { useEventSource } from "../EventSource";
import useGenerateColumns from "../TableColumns";
import { useSidebar } from "@/components/ui/sidebar";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type CreateTableProps<T, C extends HeaderList> = {
  clusterName: string;
  configName: string;
  loading: boolean;
  headersList: C[];
  instanceType: string;
  count: number;
  data: T[];
  endpoint: string;
  queryParmObject: Record<string, string>;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  dispatchMethod: ActionCreatorWithPayload<any, string>;
  showNamespaceFilter: boolean;
  setLoading?: (loading: boolean) => void;
};

const CreateTable = <T extends ClusterDetails, C extends HeaderList>({
  clusterName,
  configName,
  loading,
  headersList,
  count,
  instanceType,
  data,
  endpoint,
  queryParmObject,
  dispatchMethod,
  showNamespaceFilter,
  setLoading,
}: CreateTableProps<T, C>) => {

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  
  const sendMessage = (message: any[]) => {
    dispatch(dispatchMethod(message));
  };

  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  useEventSource<any[]>({
    url: getEventStreamUrl(endpoint, queryParmObject),
    sendMessage,
    onConnectionStatusChange: setConnectionStatus,
    onConfigError: handleConfigError,
    setLoading,
  });

  const { open, isMobile } = useSidebar();

  const getTableClasses = () => {
    if(isMobile) {
        return 'list-table-max-width-collapsed-mobile';
    } else {
      if (open) {
        return 'list-table-max-width-expanded';
      }
      return 'list-table-max-width-collapsed';
    }
  };

  return (
    <div className="col-span-7">
      <div className="h-full">
        <DataTable<T, C>
          columns={useGenerateColumns<T, C>({
            clusterName,
            configName,
            loading,
            headersList,
            instanceType,
            count,
            queryParams: new URLSearchParams(queryParmObject).toString()
          })}
          data={loading ? defaultSkeletonRow() : data}
          showNamespaceFilter={showNamespaceFilter}
          tableWidthCss={cn('list-table-max-height', 'h-screen', getTableClasses())}
          instanceType={instanceType}
          loading={loading}
          connectionStatus={connectionStatus}
        />
      </div>
    </div>
  );
};

export { CreateTable };
