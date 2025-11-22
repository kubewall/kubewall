import './index.css';

import { HistoryIcon, Maximize2, Minimize2, Sparkles, SquarePen, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { kwAIStoredChatHistory } from '@/types/kwAI/addConfiguration';
import { kwDetails, kwList } from '@/routes';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useEffect, useState } from 'react';

import { Button } from "@/components/ui/button";
import { ChatHistory } from './History';
import { ChatWindow } from '@/components/app/kwAI/Chat';
import { TabsContent } from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { fetchKwAiTools } from '@/data/KwAi/KwAiToolsSlice';
import { useSidebarSize } from '@/hooks/use-get-sidebar-size';

interface AiChatProps {
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  customHeight: string
  isDetailsPage?: boolean
  onClose?: () => void
}

export function AiChat({ isFullscreen = false, onToggleFullscreen, customHeight, onClose, isDetailsPage = false }: AiChatProps) {
  const [activeView, setActiveView] = useState("chat");
  const kwAiChatWindow = useSidebarSize("kwai-chat");
  const [selectedModel, setSelectedModel] = useState<string>("");
  
  // Function to save selected model to local storage
  const saveSelectedModel = (model: string) => {
    if (model) {
      localStorage.setItem(`kwAI_selectedModel`, model);
    }
  };
  
  // Custom setter that also saves to local storage
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  };
  const dispatch = useAppDispatch();
  let config = '';
  let cluster = '';
  if (!isDetailsPage) {
    config = kwList.useParams().config;
    cluster = kwList.useSearch().cluster;
  } else {
    config = kwDetails.useParams().config;
    cluster = kwDetails.useSearch().cluster;
  }
  const {
    clusters,
  } = useAppSelector((state) => state.clusters);
  const clusterConfigKey = `cluster=${cluster}&config=${config}`;
  const getLatestChat = () => {
    const kwAIStoredChatHistory = JSON.parse(localStorage.getItem('kwAIStoredChatHistory') || '{}') as kwAIStoredChatHistory;
    if (kwAIStoredChatHistory && kwAIStoredChatHistory[clusterConfigKey]) {
      const lastKey = Object.keys(kwAIStoredChatHistory[clusterConfigKey]).at(-1);
      if (lastKey) {
        return lastKey;
      }
      return new Date().getTime().toString();
    }
    return new Date().getTime().toString();
  };
  const [currentChatKey, setCurrentChatKey] = useState<string>(getLatestChat);

  // Load selected model from local storage on component mount
  useEffect(() => {
    const savedModel = localStorage.getItem(`kwAI_selectedModel`);
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, [clusterConfigKey]);

  useEffect(() => {
    dispatch(fetchKwAiTools({isDev: clusters.version === 'dev', config, cluster}));
  }, []);


  const containerClass = `${customHeight} flex flex-col`;
  const navigationItems = [
    { id: "chat", icon: Sparkles, label: "Chat" },
    { id: "history", icon: HistoryIcon, label: "History" },
  ];

  const resetChat = () => {
    setCurrentChatKey(new Date().getTime().toString());
  };

  const resumeChat = (chatKey: string) => {
    setCurrentChatKey(chatKey);
    setActiveView("chat");
  };

  return (
    <div id="kwai-chat" className={cn(!isDetailsPage && 'border-t', containerClass)}>
      <Tabs value={activeView} onValueChange={setActiveView}>
        <div className={cn('flex items-center justify-between px-2 py-2 border-b', isDetailsPage && 'pt-0')}>
          <div className="flex items-center gap-1">
            <TabsList className="h-8">
              {
                navigationItems.map((item) => (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <div>
                          <TabsTrigger value={item.id} >
                            <div className="flex items-center justify-between">
                              <item.icon className="h-4 w-4" />
                              {kwAiChatWindow.width > 800 && <span className='ml-2'>{item.label}</span>}
                            </div>
                          </TabsTrigger>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" hidden={kwAiChatWindow.width > 800}>
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))
              }
            </TabsList>
          </div>
          <span className="font-semibold">
            kwAI
            <span className="text-xs align-text-bottom text-gray-500"> (beta)</span>
          </span>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={resetChat} className="h-8 w-8">
                    <SquarePen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-1.5">
                  New Chat
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {!isFullscreen && onToggleFullscreen && (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onToggleFullscreen} className="h-8 w-8">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="px-1.5">
                    Expand
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

            )}
            {isFullscreen && (
              <>
                {onToggleFullscreen && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onToggleFullscreen} className="h-8 w-8">
                          <Minimize2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="px-1.5">
                        Collapsed
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>


                )}
              </>
            )}
            {onClose && (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="px-1.5">
                    Close chat
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

            )}
          </div>
        </div>
        <TabsContent value='chat' className={cn(isDetailsPage ? 'chatbot-details-inner-container' : 'chatbot-list-inner-container')}>
          <ChatWindow
            currentChatKey={currentChatKey || ''}
            cluster={cluster}
            config={config}
            isDetailsPage={isDetailsPage}
            selectedModel={selectedModel}
            setSelectedModel={handleModelChange}
            resetChat={resetChat}
          />
        </TabsContent>
        <TabsContent value="history" className={cn(isDetailsPage ? 'chatbot-details-inner-container' : 'chatbot-list-inner-container')}>
          <ChatHistory resumeChat={resumeChat} cluster={cluster} config={config} isDetailsPage={isDetailsPage} />
        </TabsContent>
      </Tabs>
    </div>
  );

}
