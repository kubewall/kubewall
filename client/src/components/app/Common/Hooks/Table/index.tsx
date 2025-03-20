import { ClusterDetails, HeaderList } from "@/types";
import { defaultSkeletonRow, getEventStreamUrl } from "@/utils";

import { ActionCreatorWithPayload } from "@reduxjs/toolkit";
import { DataTable } from "@/components/app/Table";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/redux/hooks";
import { useEventSource } from "../EventSource";
import useGenerateColumns from "../TableColumns";
import { useSidebar } from "@/components/ui/sidebar";

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

  const { open } = useSidebar();

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
          tableWidthCss={cn('list-table-max-height', 'h-screen', open ? 'list-table-max-width-expanded' : 'list-table-max-width-collapsed')}
          instanceType={instanceType}
          loading={loading}
        />
      </div>
    </div>
  );
};

export { CreateTable };
