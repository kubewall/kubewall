import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteResources, resetDeleteResource } from "@/data/Misc/DeleteResourceSlice";
import { kwDetails, kwList, appRoute } from "@/routes";
import { kwDetailsSearch, kwListSearch } from "@/types";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { Row } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import kwFetch from "@/data/kwFetch";
import { bumpListRefresh } from "@/data/Misc/ListTableRefreshSlice";
import { useNavigate } from "@tanstack/react-router";
import { API_VERSION } from "@/constants";

type TableDeleteProps = {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  selectedRows: Row<any>[];
  toggleAllRowsSelected?: (value: boolean) => void;
  postDeleteCallback?: () => void;
}

const TableDelete = ({ selectedRows, toggleAllRowsSelected, postDeleteCallback }: TableDeleteProps) => {
  // const router = useRouterState();
  let paramList = {} as kwListSearch & kwDetailsSearch;
  let config = '';
  let isListPage = true;
  if (window.location.pathname.split('/')[2].toLowerCase() === 'list') {
    config = appRoute.useParams().config;
    paramList = kwList.useSearch();
  } else {
    isListPage = false;
    config = appRoute.useParams().config;
    paramList = kwDetails.useSearch();
  }

  const { cluster = '', resourcekind = '', group = '', kind = '', resource = '', version = '' } = paramList;
  const {
    loading,
    error,
    message
  } = useAppSelector((state: RootState) => state.deleteResources);
  const [modalOpen, setModalOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [canDelete, setCanDelete] = useState<boolean>(true);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);
  const [forceDelete, setForceDelete] = useState<boolean>(false);

  useEffect(() => {
    if (message?.failures?.length === 0 && !error) {
      toast.success("Success", {
        description: 'Resource/s marked for temination.',
      });
      setModalOpen(false);
      dispatch(resetDeleteResource());
      // Trigger list refresh
      dispatch(bumpListRefresh());
      toggleAllRowsSelected && toggleAllRowsSelected(true);
      postDeleteCallback && postDeleteCallback();
      if (!isListPage) {
        const listSearch: Record<string, string> = { cluster, resourcekind } as Record<string, string>;
        const ns = (paramList as any)?.namespace || '';
        if (ns) listSearch.namespace = ns;
        if (resourcekind === 'customresources') {
          if (group) listSearch.group = group;
          if (kind) listSearch.kind = kind;
          if (resource) listSearch.resource = resource;
          if (version) listSearch.version = version;
        }
        navigate({ to: `/${config}/list?${new URLSearchParams(listSearch).toString()}` });
      }
    } else if (message?.failures?.length > 0) {
      toast.error(
        <>
          {
            <div className="max-h-[200px] overflow-auto ">
              <h4 className="font-bold mb-2">{message.failures.length} failed to delete</h4>
              {
                message.failures.map(({ name, message }) => (
                  <div className="space-y-2 max-w-md">
                    <div className="p-1 rounded-md">
                      <div className="flex items-start space-x-2">
                        <span className="">•</span>
                        <div className="font-medium">
                          {name}
                        </div>
                      </div>
                      <div className="pl-4 mt-1 font-light">
                        {message}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          }
        </>
      );
      setModalOpen(false);
      dispatch(resetDeleteResource());
      // Partial failures might still remove some items; refresh list
      dispatch(bumpListRefresh());
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      setModalOpen(false);
      dispatch(resetDeleteResource());
    }
  }, [message, error]);

  const listSelectedNamespace = useAppSelector((state: RootState) => (state as any).listTableNamesapce?.selectedNamespace);
  const namespaceForCheck = useMemo(() => {
    if (isListPage) {
      if (Array.isArray(listSelectedNamespace) && listSelectedNamespace.length === 1) {
        return Array.from(listSelectedNamespace)[0] as string;
      }
      return '';
    }
    // On details page, use namespace from params (if any)
    return (paramList as any)?.namespace || '';
  }, [listSelectedNamespace, isListPage, paramList]);

  useEffect(() => {
    const checkPermission = async () => {
      if (!config || !cluster || !resourcekind) return;
      setCheckingPermission(true);
      try {
        const qp: Record<string, string> = { config, cluster, resourcekind, verb: 'delete' };
        if (resourcekind === 'customresources') {
          if (group) qp['group'] = group;
          if (resource) qp['resource'] = resource;
        }
        if (namespaceForCheck) {
          qp['namespace'] = namespaceForCheck;
        }
        const url = `${API_VERSION}/permissions/check?${new URLSearchParams(qp).toString()}`;
        const res = await kwFetch(url, { method: 'GET' });
        setCanDelete(Boolean((res as any)?.allowed));
      } catch (_) {
        setCanDelete(false);
      } finally {
        setCheckingPermission(false);
      }
    };
    checkPermission();
  }, [config, cluster, resourcekind, group, resource, namespaceForCheck]);

  const deleteResource = () => {
    // Build payload from selected rows on list page or from details params
    let data: Array<{ name: string; namespace?: string }>; 
    if (isListPage) {
      data = selectedRows.map(({ original }) => ({
        name: (original as any).name || (original as any).metadata.name,
        namespace: (original as any).namespace || (original as any).metadata?.namespace,
      }));
    } else {
      data = [{ name: (paramList as any)?.resourcename, namespace: (paramList as any)?.namespace }];
    }
    const queryParamsObj: Record<string, string> = { config, cluster };
    // Only for pods, allow force delete with grace period 0
    if (resourcekind === 'pods' && forceDelete) {
      queryParamsObj['force'] = 'true';
    }
    if (resourcekind === 'customresources') {
      queryParamsObj['group'] = group;
      queryParamsObj['kind'] = kind;
      queryParamsObj['resource'] = resource;
      queryParamsObj['version'] = version;
    }

    // Use bulk endpoint for 5+ items, regular endpoint for smaller batches
    const useBulkEndpoint = data.length >= 5;
    
    if (useBulkEndpoint) {
      // Use bulk delete endpoint with enhanced payload structure
      dispatch(deleteResources({
        data: {
          items: data,
          batchSize: Math.min(10, Math.ceil(data.length / 3)) // Dynamic batch size
        },
        resourcekind,
        queryParams: new URLSearchParams(queryParamsObj).toString(),
        useBulkEndpoint: true
      }));
    } else {
      // Use regular delete endpoint
      dispatch(deleteResources({
        data,
        resourcekind,
        queryParams: new URLSearchParams(queryParamsObj).toString()
      }));
    }
    
    // Close dialog immediately after confirming
    setModalOpen(false);
  };

  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {/* Wrap disabled button to allow tooltip on hover */}
            {(() => {
              const isDisabled = checkingPermission || !canDelete || (isListPage && selectedRows.length === 0);
              const buttonEl = (
                <Button
                  variant={isListPage ? 'destructive' : 'destructive'}
                  size={isListPage ? 'sm' : 'sm'}
                  className="ml-2"
                  onClick={() => setModalOpen(true)}
                  disabled={isDisabled}
                >
                  {loading ? (
                    <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
                  ) : (
                    <div className="flex items-center gap-1">
                      <Trash2Icon className="h-4 w-4" />
                      <span className='text-xs'>Delete</span>
                    </div>
                  )}
                </Button>
              );
              // If disabled, wrap in span so tooltip still works
              return isDisabled ? (
                <span className="ml-2 inline-flex" role="button" aria-disabled tabIndex={0}>
                  {buttonEl}
                </span>
              ) : (
                <DialogTrigger asChild>
                  {buttonEl}
                </DialogTrigger>
              );
            })()}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {checkingPermission
              ? 'Checking permissions...'
              : (!canDelete)
                ? "You don't have permission to delete"
                : isListPage
                  ? `Delete Resource${selectedRows.length > 1 ? 's' : ''}`
                  : 'Delete Resource'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Resource{selectedRows.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {selectedRows.length > 1 ? `${selectedRows.length} resources` : '1 resource'}?
            {selectedRows.length >= 5 && (
              <div className="mt-2 text-sm text-muted-foreground">
                ⚡ Using optimized bulk delete for large selections
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {resourcekind === 'pods' && (
          <div className="mt-2 flex items-center space-x-2">
            <Checkbox id="force-delete" checked={forceDelete} onCheckedChange={(v) => setForceDelete(Boolean(v))} />
            <Label htmlFor="force-delete" className="text-sm">
              Force delete (set grace period to 0s)
            </Label>
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          <Button
            className="md:w-2/4 w-full"
            type="submit"
            onClick={() => setModalOpen(false)}
          >No</Button>
          <Button
            onClick={() => deleteResource()}
            className="md:w-2/4 w-full"
            type="submit"
          >Yes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TableDelete;