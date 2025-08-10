import { Check, CirclePlus, Pencil, Star, Trash2Icon, X } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { TooltipWrapper } from "@/components/app/Common/TooltipWrapper";
import { cn } from "@/lib/utils";
import { kwAIStoredModels } from "@/types/kwAI/addConfiguration";

type ListConfigurationsProps = {
  setSelectedUUId: (uuid: string) => void;
  setKwAIStoredModelsCollection: Dispatch<SetStateAction<kwAIStoredModels>>;
  isDetailsPage?: boolean;
  setShowAddConfiguration: React.Dispatch<React.SetStateAction<boolean>>;
};

const ListConfigurations = ({ setSelectedUUId, setKwAIStoredModelsCollection, isDetailsPage, setShowAddConfiguration }: ListConfigurationsProps) => {
  const kwAIStoredModels = JSON.parse(localStorage.getItem('kwAIStoredModels') || '{}') as kwAIStoredModels;
  const [data, setData] = useState(kwAIStoredModels);
  const [deletingRowIds, setDeletingRowIds] = useState<Set<string>>(new Set());


  const confirmDelete = (uuid: string) => {
    setData(prev => {
      const { providerCollection, defaultProvider } = prev;
      // eslint-disable-next-line  @typescript-eslint/no-unused-vars
      const { [uuid]: _, ...restProviders } = providerCollection;
      const isDefault = defaultProvider === uuid;

      return {
        ...prev,
        defaultProvider: isDefault ? '' : defaultProvider,
        providerCollection: restProviders,

      };
    });

    setDeletingRowIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(uuid);
      return newSet;
    });

    deleteKwAIStoredModels(uuid);
  };

  const cancelDelete = (uuid: string) => {
    setDeletingRowIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(uuid);
      return newSet;
    });
  };

  const requestDelete = (id: string) => {
    setDeletingRowIds((prev) => new Set(prev).add(id));
  };

  const deleteKwAIStoredModels = (uuid: string) => {
    const storedKwAIModel = localStorage.getItem('kwAIStoredModels');
    if (storedKwAIModel) {
      const kwAIModelCollection = JSON.parse(storedKwAIModel) as kwAIStoredModels;
      delete kwAIModelCollection.providerCollection[uuid];
      setKwAIStoredModelsCollection(kwAIModelCollection);
      localStorage.setItem('kwAIStoredModels', JSON.stringify(kwAIModelCollection));
    }
  };

  const updateDefaultProvider = (uuid: string) => {
    const storedKwAIModel = localStorage.getItem('kwAIStoredModels');
    if (storedKwAIModel) {
      const kwAIModelCollection = JSON.parse(storedKwAIModel) as kwAIStoredModels;
      kwAIModelCollection.defaultProvider = uuid;
      setKwAIStoredModelsCollection(kwAIModelCollection);
      localStorage.setItem('kwAIStoredModels', JSON.stringify(kwAIModelCollection));
      setData((prev) => {
        const cluster = prev;
        cluster.defaultProvider = uuid;
        return {
          ...prev,
          ...cluster
        };
      });
    }
  };

  return (
    !data?.providerCollection || Object.keys(data.providerCollection).length === 0 ?
      <div className={cn("flex items-center justify-center", isDetailsPage ? 'chatbot-details-inner-container' : 'chatbot-list-inner-container')}>
        <p className="w-3/4 p-4 rounded text-center text-muted-foreground">
          <span>Looks like you haven't added a provider yet.</span>
          <br />
          <span>Click
            <span className="text-blue-600/100 dark:text-sky-400/100 cursor-pointer" onClick={() => setShowAddConfiguration(true)}> here </span>
            or use the button <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => setShowAddConfiguration(true)}>
              <CirclePlus className="h-4 w-4" />
            </Button> at the top, to go to Configuration add your first one.</span>
        </p>
      </div>
      :
      <div className="overflow-auto p-2 pt-0">
        <Table className="border">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Alias</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="overflow-auto">
            {
              data?.providerCollection ?
                Object.keys(data.providerCollection).map((uuid) => {
                  const isDeleting = deletingRowIds.has(uuid);
                  const currentRow = data.providerCollection[uuid];
                  return (
                    <TableRow key={uuid}>
                      {
                        isDeleting ? (
                          <>
                            <TableCell colSpan={4} className="text-sm italic">
                              <div className="flex justify-between">
                                <span>
                                  Confirm delete <strong>{currentRow.alias}</strong>?
                                </span>
                                <div>
                                  <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-6 w-6 shadow-none"
                                          onClick={() => confirmDelete(uuid)}
                                        >
                                          <Check className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="px-1.5">
                                        Confirm
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-6 w-6 ml-1 shadow-none"
                                          onClick={() => cancelDelete(uuid)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="px-1.5">
                                        Cancel
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                </div>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium truncate max-w-[10rem]">
                              <TooltipWrapper tooltipString={currentRow.alias} className="truncate" side="bottom" />
                            </TableCell>
                            <TableCell className="truncate max-w-[8rem]">
                              <TooltipWrapper tooltipString={currentRow.provider} className="truncate" side="bottom" />
                            </TableCell>
                            <TableCell className="truncate max-w-[20rem]">
                              <TooltipWrapper tooltipString={currentRow.model} className="truncate" side="bottom" />
                            </TableCell>
                            <TableCell className="text-right">
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-6 w-6 shadow-none" onClick={() => updateDefaultProvider(uuid)}>
                                      <Star className={cn(
                                        "h-3 w-3 transition-colors",
                                        data.defaultProvider === uuid
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-muted-foreground hover:fill-yellow-400 hover:text-yellow-400"
                                      )} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="px-1.5">
                                    {data.defaultProvider === uuid ? 'Default' : 'Set Default'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-6 w-6 ml-1 shadow-none" onClick={() => setSelectedUUId(uuid)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="px-1.5">
                                    Edit
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-6 w-6 ml-1 shadow-none" onClick={() => requestDelete(uuid)}>
                                      <Trash2Icon className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="px-1.5">
                                    Delete
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                            </TableCell>
                          </>
                        )
                      }

                    </TableRow>
                  );
                })
                :
                <TableRow className='empty-table-events'>
                  <TableCell
                    colSpan={4}
                    className="text-center"
                  >
                    No saved configuration found.
                  </TableCell>
                </TableRow>
            }

          </TableBody>
        </Table>
      </div>
  );
};

export {
  ListConfigurations
};