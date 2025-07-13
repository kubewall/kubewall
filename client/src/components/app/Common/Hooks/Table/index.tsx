import { ClusterDetails, HeaderList } from "@/types";
import { defaultSkeletonRow, getEventStreamUrl } from "@/utils";

import { ActionCreatorWithPayload } from "@reduxjs/toolkit";
import { DataTable } from "@/components/app/Table";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/redux/hooks";
import { useEventSource } from "../EventSource";
import useGenerateColumns from "../TableColumns";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarSize } from "@/hooks/use-get-sidebar-size";
import { useState } from "react";

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
}: CreateTableProps<T, C>) => {

  const dispatch = useAppDispatch();
  const sendMessage = (message: object[]) => {
    dispatch(dispatchMethod(message));
  };

  useEventSource({
    url: getEventStreamUrl(endpoint, queryParmObject),
    sendMessage,
  });

  const { isMobile } = useSidebar();
  const [showChat, setShowChat] = useState(false);
  const leftSize = useSidebarSize("left-sidebar");
  const getMaxWidth = () => {
    if(isMobile) {
      return 48;
    } else {
      return 47 + leftSize.width;
    }
  };

  return (
    <div className="col-span-7">
      <div className="h-full" style={{width: `calc(100vw - ${(getMaxWidth())}px)`}}>
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
          tableWidthCss={cn('list-table-max-height', 'h-screen')}
          instanceType={instanceType}
          loading={loading}
          showChat={showChat}
          setShowChat={setShowChat}
        />
      </div>
    </div>
  );
};

export { CreateTable };
