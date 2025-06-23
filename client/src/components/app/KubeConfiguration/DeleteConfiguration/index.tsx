import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { deleteConfig } from "@/data/KwClusters/DeleteConfigSlice";
import { useAppDispatch } from "@/redux/hooks";
import { useState } from "react";
import { Trash2Icon, XIcon } from "lucide-react";

type DeleteConfigurationProps = {
  configId: string
};

const DeleteConfiguration = ({ configId }: DeleteConfigurationProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const dispatch = useAppDispatch();

  const deleteCurrentConfig = () => {
    dispatch(deleteConfig({ configId }));
    setModalOpen(false);
  };

  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <svg
                onClick={() => setModalOpen(true)}
                xmlns="http://www.w3.org/2000/svg"
                cursor="pointer"
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(var(--destructive))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-trash-2 p-2 group/edit invisible group-hover/item:visible"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Delete Configuration
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Config</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this config?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline"><XIcon className="h-4 w-4" />Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="destructive" onClick={deleteCurrentConfig}><Trash2Icon className="h-4 w-4" />Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export {
  DeleteConfiguration
};
