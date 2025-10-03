import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2Icon, XIcon } from "lucide-react";
import { deleteResources, resetDeleteResource } from "@/data/Misc/DeleteResourceSlice";
import { kwDetails, kwList } from "@/routes";
import { kwDetailsSearch, kwListSearch } from "@/types";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Loader } from "../../Loader";
import { PORT_FORWARDING_ENDPOINT } from "@/constants";
import { RootState } from "@/redux/store";
import { Row } from "@tanstack/react-table";
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
    config = kwList.useParams().config;
    paramList = kwList.useSearch();
  } else {
    isListPage = false;
    config = kwDetails.useParams().config;
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
      if(resourcekind === PORT_FORWARDING_ENDPOINT) {
        return {
          'id': original.id,
        }
      }
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
                className={`right-0 z-10 border w-8 h-8 ${isListPage && 'absolute mr-10 bottom-12 w-20'}`}
                onClick={() => setModalOpen(true)}
              > {
                  loading ?
                    <Loader className='w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                    <Trash2Icon className="h-4 w-4" />
                }
                {isListPage && <span className='text-xs'>Delete</span>}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
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

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline"><XIcon className="h-4 w-4" />Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="destructive" onClick={() => deleteResource()}><Trash2Icon className="h-4 w-4" />Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export {
  TableDelete
};