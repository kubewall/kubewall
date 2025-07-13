import { Check, Pencil, Star, Trash2Icon, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { TooltipWrapper } from "@/components/app/Common/TooltipWrapper";
import { cn } from "@/lib/utils";
import { kwAIStoredModels } from "@/types/kwAI/addConfiguration";
import { useState } from "react";

type ListConfigurationsProps = {
  setSelectedUUId: (uuid: string) => void;
};

const ListConfigurations = ({ setSelectedUUId }: ListConfigurationsProps) => {
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
      localStorage.setItem('kwAIStoredModels', JSON.stringify(kwAIModelCollection));
    }
  };

  const updateDefaultProvider = (uuid: string) => {
    const storedKwAIModel = localStorage.getItem('kwAIStoredModels');
    if (storedKwAIModel) {
      const kwAIModelCollection = JSON.parse(storedKwAIModel) as kwAIStoredModels;
      kwAIModelCollection.defaultProvider = uuid;
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
    <div className="overflow-auto p-2 pt-0">
      <Table>
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
            data ?
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