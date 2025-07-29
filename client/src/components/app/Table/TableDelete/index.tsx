import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteResources, resetDeleteResource } from "@/data/Misc/DeleteResourceSlice";
import { kwDetails, kwList, appRoute } from "@/routes";
import { kwDetailsSearch, kwListSearch } from "@/types";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Loader } from "../../Loader";
import { RootState } from "@/redux/store";
import { Row } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => {
    if (message?.failures?.length === 0 && !error) {
      toast.success("Success", {
        description: 'Resource/s marked for temination.',
      });
      dispatch(resetDeleteResource());
      toggleAllRowsSelected && toggleAllRowsSelected(true);
      postDeleteCallback && postDeleteCallback();
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
      dispatch(resetDeleteResource());
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetDeleteResource());
    }
  }, [message, error]);

  const deleteResource = () => {
    const data = selectedRows.map(({ original }) => {
      return {
        'name': original.name || original.metadata.name,
        'namespace': original.namespace || original.metadata?.namespace
      };
    });
    const queryParamsObj: Record<string, string> = { config, cluster };
    if (resourcekind === 'customresources') {
      queryParamsObj['group'] = group;
      queryParamsObj['kind'] = kind;
      queryParamsObj['resource'] = resource;
      queryParamsObj['version'] = version;
    }
    dispatch(deleteResources({
      data,
      resourcekind,
      queryParams: new URLSearchParams(queryParamsObj).toString()
    }));
  };

  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant={isListPage ? 'destructive' : 'ghost'}
                size="icon"
                className={`right-0 mt-1 rounded z-10 border w-9 ${isListPage && 'absolute mr-10 bottom-12 w-20'}`}
                onClick={() => setModalOpen(true)}

              > {
                  loading ?
                    <Loader className='w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                    <Trash2Icon className={`h-4 w-4 ${isListPage && `mr-1`}`} />
                }
                {isListPage && <span className='text-xs'>Delete</span>}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Delete Resource{selectedRows.length > 1 ? 's' : ''}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Resource</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {selectedRows.length > 1 ? `${selectedRows.length} resources` : '1 resource'} ?
          </DialogDescription>
        </DialogHeader>

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

export {
  TableDelete
};