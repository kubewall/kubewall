import './index.css';

import { API_VERSION, MCP_SERVER_ENDPOINT } from '@/constants';
import { ArrowUp, ChartNoAxesCombined, CheckIcon, ChevronsUpDown, Download, OctagonX, Upload } from "lucide-react";
import { ChatMessage, kwAIStoredChatHistory, kwAIStoredModel, kwAIStoredModels } from "@/types/kwAI/addConfiguration";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Markdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { TooltipWrapper } from "@/components/app/Common/TooltipWrapper";
import { cn } from '@/lib/utils';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createCerebras } from '@ai-sdk/cerebras';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createFireworks } from '@ai-sdk/fireworks';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOllama } from 'ollama-ai-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createXai } from '@ai-sdk/xai';
import rehypeFormat from 'rehype-format';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { streamText } from "ai";
import { useAppSelector } from "@/redux/hooks";
import { useSidebarSize } from '@/hooks/use-get-sidebar-size';

type ChatWindowProps = {
  currentChatKey: string;
  cluster: string;
  config: string;
  isDetailsPage: boolean;
  kwAIStoredModels: kwAIStoredModels
}

const ChatWindow = ({ currentChatKey, cluster, config, isDetailsPage, kwAIStoredModels }: ChatWindowProps) => {
  const clusterConfigKey = `cluster=${cluster}&config=${config}`;
  const abortControllerRef = useRef<AbortController | null>(null);
  const kwAIStoredChatHistory = JSON.parse(localStorage.getItem('kwAIStoredChatHistory') || '{}') as kwAIStoredChatHistory;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [input, setInput] = useState("");
  const [providerList, setProviderList] = useState<{ [uuid: string]: kwAIStoredModel }>({});
  const [selectedProvider, setSelectedProvider] = useState('');
  const [open, setOpen] = useState(false);
  const kwAiChatWindow = useSidebarSize("kwai-chat");
  const getCurrentProvider = () => {
    const providerData = providerList[selectedProvider];
    switch (providerData.provider) {
      case "xai":
        return createXai({ apiKey: providerData.apiKey });
      case "openai":
        return createOpenAI({ apiKey: providerData.apiKey });
      case "azure":
        return createAzure({ apiKey: providerData.apiKey });
      case "anthropic":
        return createAnthropic({ apiKey: providerData.apiKey });
      // case "amazon-bedrock":
      //   return createAmazonBedrock({ apiKey: providerData.apiKey });
      case "groq":
        return createGroq({ apiKey: providerData.apiKey });
      case "deepinfra":
        return createDeepInfra({ apiKey: providerData.apiKey });
      // case "google-vertex":
      //   return createVertex({ apiKey: providerData.apiKey });
      case "mistral":
        return createMistral({ apiKey: providerData.apiKey });
      case "togetherai":
        return createTogetherAI({ apiKey: providerData.apiKey });
      case "cohere":
        return createCohere({ apiKey: providerData.apiKey });
      case "fireworks":
        return createFireworks({ apiKey: providerData.apiKey });
      case "deepseek":
        return createDeepSeek({ apiKey: providerData.apiKey });
      case "cerebras":
        return createCerebras({ apiKey: providerData.apiKey });
      case "ollama":
        return createOllama({
          baseURL: `${providerData.url}/`, fetch: (url, options) => {
            const newUrl = `${API_VERSION}${MCP_SERVER_ENDPOINT}/${url.toString().replace('v1', 'api')}?${clusterConfigKey}`;
            return fetch(newUrl, options);
          }
        });
      case "lmstudio":
        return createOpenAICompatible({
          name: 'lmstudio',
          baseURL: `${providerData.url}/`, fetch: (url, options) => {
            const newUrl = `${API_VERSION}${MCP_SERVER_ENDPOINT}/${url}?${clusterConfigKey}`;
            return fetch(newUrl, options);
          }
        });
      case "openrouter":
        return createOpenRouter({ apiKey: providerData.apiKey });
      default:
        return '';
    }
  };


  useEffect(() => {
    if (kwAIStoredModels) {
      setProviderList(kwAIStoredModels.providerCollection);
      setSelectedProvider(kwAIStoredModels.defaultProvider);
    }
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const {
    tools
  } = useAppSelector((state) => state.kwAiTools);
  const {
    yamlData,
  } = useAppSelector((state) => state.yaml);

  const generateStreamText = async () => {
    const currentProvider = getCurrentProvider();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    if (!input.trim() || !currentProvider) return;

    const userMessage: ChatMessage[] = [{
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    }];

    if (isDetailsPage && messages.length === 0) {
      const markdown = '```yaml\n' + yamlData.replace(/\\n/g, '\n') + '\n```';
      userMessage.unshift({
        id: Date.now().toString(),
        content: markdown,
        role: "user",
        timestamp: new Date(),
        isNotVisible: true
      });
    }
    setMessages((prev) => [...prev, ...userMessage]);
    setInput('');
    setMessageLoading(true);
    const { fullStream, usage } = streamText({
      model: currentProvider(providerList[selectedProvider].model),
      messages: [...messages, ...userMessage],
      maxSteps: 500,
      toolChoice: "auto",
      tools,
      abortSignal: abortControllerRef.current.signal
    });

    const id = new Date().getTime();
    setMessages((prev) => [
      ...prev,
      {
        id: id.toString(),
        content: "",
        role: "assistant",
        timestamp: new Date(),
      }
    ]);

    for await (const textPart of fullStream) {
      if (textPart.type === "error") {

        if ((textPart.error as Error).name === "AbortError") {
          setMessages((prev) => [
            ...prev.map((p) => (
              p.id === id.toString() ? {
                ...p,
                content: p.content + 'Request Stopped',
                error: false
              } : p
            ))
          ]);
        } else {
          setMessages((prev) => [
            ...prev.map((p) => (
              p.id === id.toString() ? {
                ...p,
                content: p.content + JSON.stringify(textPart),
                error: true
              } : p
            ))
          ]);
        }
        setIsLoading(false);
      }

      if (textPart.type === 'text-delta') {
        setMessages((prev) => [
          ...prev.map((p) => (
            p.id === id.toString() ? {
              ...p,
              content: p.content + textPart.textDelta,
              error: false
            } : p
          ))
        ]);
      }
    }

    const { completionTokens, promptTokens, totalTokens } = await usage;
    setMessages((prev) => [
      ...prev.map((p) => (
        p.id === id.toString() ? {
          ...p,
          content: p.content || "Received Epmty response from LLM",
          ...(!isNaN(completionTokens) && { completionTokens }),
          ...(!isNaN(promptTokens) && { promptTokens }),
          ...(!isNaN(totalTokens) && { totalTokens }),
        } : p
      ))
    ]);
    setIsLoading(false);
  };
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };
  const storeToChatHistory = (key: string) => {
    try {
      const kwAIStoredChatHistory = localStorage.getItem('kwAIStoredChatHistory') || '{}';
      let kwAIChatHistory = JSON.parse(kwAIStoredChatHistory) as kwAIStoredChatHistory;

      if (!kwAIChatHistory[clusterConfigKey]) {
        kwAIChatHistory[clusterConfigKey] = {
          [key]: {
            messages: []
          }
        };
      }
      kwAIChatHistory = {
        ...kwAIChatHistory,
        [clusterConfigKey]: {
          ...kwAIChatHistory[clusterConfigKey],
          [key]: {
            messages: messages
          }
        }
      };
      localStorage.setItem('kwAIStoredChatHistory', JSON.stringify(kwAIChatHistory));
    } catch (error) {
      console.log('error', error);
    }
  };
  useEffect(() => {
    scrollToBottom();
    currentChatKey && messages.length && storeToChatHistory(currentChatKey);
  }, [messages]);

  useEffect(() => {
    const currentContextMessages = kwAIStoredChatHistory[clusterConfigKey]?.[currentChatKey]?.messages;
    if (currentContextMessages) {
      setMessages(currentContextMessages);
    } else {
      setMessages([]);
    }

  }, [currentChatKey]);

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  const getOverridenComponents = () => {
    return {
      table: (props: any) => (
        <table className="w-full caption-bottom text-sm border border-collapse rounded-sm mr-4" {...props} />
      ),
      thead: (props: any) => (
        <thead className="[&_tr]:border-b bg-muted/50" {...props} />
      ),
      tbody: (props: any) => (
        <tbody className="[&_tr:last-child]:border-0" {...props} />
      ),
      tr: (props: any) => (
        <tr className="border-b transition-colors hover:bg-muted/50" {...props} />
      ),
      th: (props: any) => (
        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0" {...props} />
      ),
      td: (props: any) => (
        <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0" {...props} />
      ),
    };
  };
  /* eslint-enable  @typescript-eslint/no-explicit-any */
  const stopStream = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollAreaRef} className="flex-1 p-2 space-y-4 overflow-y-auto">
        <div>
          {messages.map((message) => (
            !message.isNotVisible &&
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end pt-4 pb-1" : "justify-start"}`}>
              <Card
                className={`max-w-[95%] p-3 pb-0 ${message.role === "user" ? "bg-primary text-primary-foreground" : message.error ? "border-red-100" : ""}`}
              >
                {
                  messageLoading && message.content === "" ? <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div> :
                    <div className={`text-sm overflow-x-auto  ${message.error ? "text-destructive" : ""}`}>
                      <Markdown
                        remarkPlugins={[remarkGfm, rehypeFormat, remarkRehype, rehypeSanitize, remarkFrontmatter, remarkMath, remarkParse, remarkRehype, rehypeRaw, rehypeStringify, rehypeHighlight]}
                        components={getOverridenComponents()}
                      >
                        {message.content}
                      </Markdown>
                    </div>
                }

                <p className="text-xs opacity-70 pt-1 pb-1 flex justify-end">
                  {
                    <TooltipWrapper
                      side="top"
                      tooltipString={new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      tooltipContent={new Date(message.timestamp).toISOString()} />
                  }
                  {
                    message.role === "assistant" &&
                    <>
                      {
                        message.promptTokens &&
                        <div className='ml-2 flex items-center justify-between'>
                          <Upload className="h-3 w-3" />
                          <TooltipWrapper
                            side="top"
                            tooltipContent={`Prompt Token: ${message.promptTokens}`}
                            tooltipString={message.promptTokens} />
                        </div>
                      }
                      {
                        message.completionTokens &&
                        <div className='ml-2 flex items-center justify-between'>
                          <Download className="h-3 w-3" />
                          <TooltipWrapper
                            side="top"
                            tooltipContent={`Completion Token: ${message.completionTokens}`}
                            tooltipString={message.completionTokens} />
                        </div>

                      }
                      {
                        message.totalTokens &&
                        <div className='ml-2 flex items-center justify-between'>
                          <ChartNoAxesCombined className="h-3 w-3" />
                          <TooltipWrapper
                            side="top"
                            tooltipContent={`Total Token: ${message.totalTokens}`}
                            tooltipString={message.totalTokens} />
                        </div>

                      }

                    </>
                  }
                </p>
              </Card>
            </div>
          ))}
        </div>

      </div>
      <div className="p-2">
        <div className="relative border border-border rounded-lg bg-background/50 backdrop-blur-sm">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateStreamText();
              }
            }
            }
            className=" shadow-none min-h-[60px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60"
            style={{ height: "auto" }}
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[15rem] justify-between shadow-none truncate py-1 px-2"
                  >
                    <span className='truncate text-xs'>{providerList[selectedProvider]?.alias || 'Select Provider...'}</span>

                    <ChevronsUpDown className="opacity-50 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={`p-0 min-w-[--radix-popover-trigger-width] w-auto`} style={{ 'maxWidth': kwAiChatWindow.width - 50 }} align="start">
                  <Command>
                    <CommandInput placeholder='Search Provider' className="h-9" id="comboboxSearch" />
                    <CommandList>
                      <CommandEmpty>No match found.</CommandEmpty>
                      <CommandGroup>
                        {Object.keys(providerList).map((uuid) => (
                          <CommandItem
                            key={uuid}
                            value={uuid}
                            onSelect={(currentValue) => {
                              setSelectedProvider(currentValue);
                              setOpen(false);
                            }}
                          >
                            <div>
                              <span>{providerList[uuid].alias}</span>
                              <span className="block text-xs text-muted-foreground">{providerList[uuid].model}</span>
                            </div>
                            <CheckIcon
                              className={cn(
                                "ml-auto h-4 w-4",
                                uuid === selectedProvider ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {isLoading ? (
              <Button
                onClick={stopStream}
                size="icon"
                className="h-8 w-8 bg-foreground hover:bg-foreground/90 text-background"
              >
                <OctagonX className="h-4 w-4" />
                <span className="sr-only">Stop generation</span>
              </Button>
            ) : (
              <Button
                onClick={generateStreamText}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-8 w-8 bg-foreground hover:bg-foreground/90 text-background disabled:bg-muted disabled:text-muted-foreground"
              >
                <ArrowUp className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export {
  ChatWindow
};