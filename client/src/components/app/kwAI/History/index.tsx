import { Check, Pencil, Trash2Icon, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { TooltipWrapper } from "@/components/app/Common/TooltipWrapper";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { kwAIStoredChatHistory } from "@/types/kwAI/addConfiguration";
import { useState } from "react";

type ChatHistoryProps = {
  resumeChat: (chatKey: string) => void;
  cluster: string;
  config: string;
  isDetailsPage?: boolean
}

const ChatHistory = ({ cluster, config, isDetailsPage, resumeChat }: ChatHistoryProps) => {
  const kwAIStoredChatHistory = JSON.parse(localStorage.getItem('kwAIStoredChatHistory') || '{}') as kwAIStoredChatHistory;
  const clusterConfigKey = `cluster=${cluster}&config=${config}`;
  const [chatHistory, setChatHistory] = useState(kwAIStoredChatHistory);
  const [deletingRowIds, setDeletingRowIds] = useState<Set<string>>(new Set());

  const deleteKwAIStoredChatHistory = (uuid: string) => {
    const kwAIStoredChatHistory = localStorage.getItem('kwAIStoredChatHistory');
    if (kwAIStoredChatHistory) {
      const kwAIStoredChatHistoryCollection = JSON.parse(kwAIStoredChatHistory) as kwAIStoredChatHistory;
      if (kwAIStoredChatHistoryCollection[clusterConfigKey][uuid]) {
        delete kwAIStoredChatHistoryCollection[clusterConfigKey][uuid];
      }
      localStorage.setItem('kwAIStoredChatHistory', JSON.stringify(kwAIStoredChatHistoryCollection));
    }
  };

  const confirmDelete = (uuid: string) => {
    setChatHistory(prev => {
      const cluster = prev[clusterConfigKey];
      if (!cluster) return prev;
      // eslint-disable-next-line  @typescript-eslint/no-unused-vars
      const { [uuid]: _, ...restChatHistory } = prev[clusterConfigKey];
      return {
        ...prev,
        [clusterConfigKey]: {
          ...restChatHistory
        }
      };
    });

    setDeletingRowIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(uuid);
      return newSet;
    });

    deleteKwAIStoredChatHistory(uuid);
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

  return (
    <div className="flex flex-col h-full">
      {
        (!chatHistory[clusterConfigKey] || Object.keys(chatHistory[clusterConfigKey]).length === 0) ?
          <div className={cn("flex items-center justify-center", isDetailsPage ? 'chatbot-details-inner-container' : 'chatbot-list-inner-container')}>
            <p className="w-3/4 p-4 rounded text-center text-muted-foreground">
              <span>Once you have some chats, they will appear here.</span>
              <br />
            </p>
          </div> :
          <>
            <div className="p-4">
              <h3 className="text-lg font-medium pb-1">kwAI Chat History</h3>
              <p className="text-sm text-muted-foreground">
                Past chats for the current cluster
              </p>
            </div>
            <div className="overflow-auto p-2 pt-0">
              <Table className="border rounded">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="overflow-auto">
                  {
                    chatHistory[clusterConfigKey] ?
                      Object.keys(chatHistory[clusterConfigKey]).reverse().map((uuid) => {
                        const isDeleting = deletingRowIds.has(uuid);
                        const currentRow = chatHistory[clusterConfigKey][uuid].messages.findIndex(({ role }) => role == "user");
                        const visibleMessage = chatHistory[clusterConfigKey][uuid].messages[currentRow === -1 ? 0 : currentRow];
                        return (
                          <TableRow key={uuid}>
                            {
                              isDeleting ? (
                                <>
                                  <TableCell colSpan={4} className="text-sm italic">
                                    <div className="flex justify-between">
                                      <span>
                                        Confirm delete <strong>{visibleMessage.content}</strong>?
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
                                  <TableCell className="truncate max-w-[20rem]">
                                    <TooltipWrapper tooltipString={visibleMessage.content} className="truncate" side="bottom" />
                                  </TableCell>
                                  <TableCell className="truncate">
                                    <TooltipWrapper
                                      tooltipContent={new Date(visibleMessage.timestamp).toISOString()}
                                      tooltipString={formatDistanceToNow(new Date(visibleMessage.timestamp), { addSuffix: true })}
                                      side="bottom" />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <TooltipProvider>
                                      <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                          <Button variant="outline" size="icon" className="h-6 w-6 ml-1 shadow-none" onClick={() => resumeChat(uuid)}>
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
                          colSpan={3}
                          className="text-center"
                        >
                          No saved configuration found.
                        </TableCell>
                      </TableRow>
                  }

                </TableBody>
              </Table>
            </div>
          </>
      }
    </div>
  );
};

export {
  ChatHistory
};