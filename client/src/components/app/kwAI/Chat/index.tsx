import './index.css';

import { API_VERSION, MCP_SERVER_ENDPOINT } from '@/constants';
import { ArrowUp, ChartNoAxesCombined, ChevronRight, Download, Lightbulb, OctagonX, ShieldAlert, SquarePen, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatMessage, kwAIStoredChatHistory } from "@/types/kwAI/addConfiguration";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { stepCountIs, streamText } from "ai";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ModelSelector } from '../ModelSelector';
import Markdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { TooltipWrapper } from "@/components/app/Common/TooltipWrapper";
import { cn } from '@/lib/utils';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getFullTools } from '@/data/KwAi/KwAiToolsSlice';
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
import { useAppSelector } from "@/redux/hooks";

type ChatWindowProps = {
  currentChatKey: string;
  cluster: string;
  config: string;
  isDetailsPage: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  resetChat: () => void
}

const ChatWindow = ({ currentChatKey, cluster, config, isDetailsPage, selectedModel, setSelectedModel, resetChat }: ChatWindowProps) => {
  const clusterConfigKey = `cluster=${cluster}&config=${config}`;
  const abortControllerRef = useRef<AbortController | null>(null);
  const kwAIStoredChatHistory = JSON.parse(localStorage.getItem('kwAIStoredChatHistory') || '{}') as kwAIStoredChatHistory;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [input, setInput] = useState("");
  const isThinkingRef = useRef<boolean>(false);
  
  const getAnthropicProvider = () => {
    return createAnthropic({
      apiKey: "", // No API key needed as we're using the proxy
      baseURL: `${API_VERSION}${MCP_SERVER_ENDPOINT}`,
      headers: {
        'HTTP-Referer': 'https://kubewall.com',
        'X-Title': 'Kubewall',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Anthropic-Version': '2023-06-01'
      },
      fetch: (url, options) => {
        console.log('Fetching from Anthropic API:', url);
        return fetch(url, options);
      }
    });
  };

  const [isLoading, setIsLoading] = useState(false);
  const {
    yamlData,
  } = useAppSelector((state) => state.yaml);

  const generateStreamText = async () => {
    const anthropicProvider = getAnthropicProvider();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(() => true);
    if (!input.trim()) return;
    
    // If no model is selected, show an error message
    if (!selectedModel) {
      setMessages((prev) => [
        ...prev,
        {
          id: new Date().getTime().toString(),
          content: "No model selected. Please select a model from the dropdown to continue.",
          role: "assistant",
          timestamp: new Date(),
          error: true,
        }
      ]);
      setIsLoading(false);
      return;
    }

    const systemMessage = `You are "kubewall-ai", an intelligent Kubernetes assistant capable of operating, analyzing, and performing actions against Kubernetes clusters using tools on behalf of the user. Your job is to help with Kubernetes-related queries, analysis manifests, related manifests with one another, find issues, and ensure configurations are accurate and complete.
        You reason like a seasoned DevOps engineer, act with the precision of a policy-enforcing agent, and think like a systems architect.

        ## Instructions:
        1. Use available tools autonomously. You may invoke one or multiple tools as needed to gather necessary information.
        2. Analyze tool responses (in JSON format), along with prior reasoning steps and observations.
        3. Reflect on 5-7 different ways to solve the given query or task. Think carefully about each solution before picking the best one. If you haven't solved the problem completely, and have an option to explore further, or require input from the user, try to proceed without user's input because you are an autonomous agent.
        4. Decide on the next action: use a tool or provide a final answer and respond in the following Markdown format.
        5. Don't share the name of tool that is used until asked by the user, avoid adding tool name that is called.
        6. Link related resources (e.g., Deployments ↔ Services ↔ PVCs ↔ ConfigMaps) and validate their cohesion.
        7. Detect and warn about potential misconfigurations, deprecated APIs, or security risks (e.g., overly permissive RBAC).
        8. Chain and coordinate tool responses to form a complete picture before acting.
        9. Collect namespace (or suggest from existing), verify container images/tags and registry access, identify container ports and service type (check for conflicts), gather CPU/memory/storage/node requirements, extract env vars/configs/secrets/RBAC needs, and check dependencies including network policies, CRDs, and referenced resources

        ### STRICT Rules:
        - **NEVER** skip the information gathering phase.
        - **NEVER** generate manifests with assumed defaults.
        - **NEVER** rely on default assumptions, explicit is better than implicit.
        - **NEVER** suggest kubectl command to get list or yaml details, rather call the tool to gather information.
        - **NEVER** suggest tool name that can be used next rather invoke it and gather more information.
        - **ALWAYS** ask specific questions about unclear requirements.
        - **ALWAYS** try to respond markdown table format about list if possible.
        - **ALWAYS** show available options (namespaces, storage classes, etc.).
        - **ALWAYS** call multiple tools if required.
        - **ALWAYS** Link related resources (e.g., Deployments ↔ Services ↔ PVCs ↔ ConfigMaps) and validate their cohesion.
        - **ALWAYS** output the final answer in MARKDOWN FORMAT.

        ## Remember:
        - Fetch current state of kubernetes resources relevant to user's query.
        - For creating new resources, try to create the resource using the tools available. DO NOT ask the user to create the resource.
        - Use tools when you need more information. Do not respond with the instructions on how to use the tools or what commands to run, instead just use the tool.
        - Do not add tool name in response in final answer.
        - Can call multiple tools and related data with with that one another.
        - **CRITICAL**: Always gather specific resource details BEFORE generating any manifests.
        - **NEVER generate manifests without asking the user for missing specifications first**
        - Provide a final answer only when you're confident you have sufficient information.
        - Provide clear, concise, and accurate responses.
        - Feel free to respond with emojis where appropriate.
        - Provide a final answer in MARKDOWN FORMAT.`
      ;

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
    try {
      const { fullStream, usage } = streamText({
        model: anthropicProvider(selectedModel),
        messages: [...messages, ...userMessage],
        system: systemMessage,
        stopWhen: stepCountIs(500),
        tools: getFullTools(),
        abortSignal: abortControllerRef.current.signal,
      });

      const id = new Date().getTime();
      setMessages((prev) => [
        ...prev,
        {
          id: id.toString(),
          content: "",
          role: "assistant",
          timestamp: new Date(),
          reasoning: ""
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
                  isReasoning: false,
                  error: true
                } : p
              ))
            ]);
          }
          else if ((textPart.error as any).statusCode === 401) {
            setMessages((prev) => [
              ...prev.map((p) => (
                p.id === id.toString() ? {
                  ...p,
                  content: p.content + (textPart.error as any).responseBody,
                  isReasoning: false,
                  error: true
                } : p
              ))
            ]);
          } else {
            setMessages((prev) => [
              ...prev.map((p) => (
                p.id === id.toString() ? {
                  ...p,
                  content: p.content + JSON.stringify((textPart.error as any)?.responseBody || (textPart.error as any)?.lastError?.responseBody || textPart),
                  isReasoning: false,
                  error: true
                } : p
              ))
            ]);
          }
          setIsLoading(false);
        }

        if (textPart.type === "reasoning-delta") {
          setMessages((prev) => [
            ...prev.map((p) => (
              p.id === id.toString() ? {
                ...p,
                reasoning: p.reasoning + textPart.text,
                isReasoning: true,
                error: false
              } : p
            ))
          ]);
        }
        if (textPart.type === 'text-delta') {
          let delta = textPart.text;
          let contentDelta = '';
          let reasoningDelta = '';

          while (delta.length > 0) {
            if (!isThinkingRef.current) {
              // Look for opening <think> or <thinking> tag
              const openTagMatch = delta.match(/<(think|thinking)>/i);
              if (openTagMatch && openTagMatch.index !== undefined) {
                // Add text before tag to content
                contentDelta += delta.slice(0, openTagMatch.index);
                // Enter thinking mode
                isThinkingRef.current = true;
                // Remove up to and including the opening tag
                delta = delta.slice(openTagMatch.index + openTagMatch[0].length);
              } else {
                // No opening tag, all goes to content
                contentDelta += delta;
                delta = '';
              }
            } else {
              // We're inside a thinking block
              const closeTagMatch = delta.match(/<\/(think|thinking)>/i);
              if (closeTagMatch && closeTagMatch.index !== undefined) {
                // Add up to the closing tag to the buffer
                reasoningDelta += delta.slice(0, closeTagMatch.index);
                // Exit thinking mode
                isThinkingRef.current = false;
                // Remove up to and including the closing tag
                delta = delta.slice(closeTagMatch.index + closeTagMatch[0].length);
              } else {
                // No closing tag yet, buffer everything
                reasoningDelta += delta;
                delta = '';
              }
            }
          }

          setMessages((prev) => [
            ...prev.map((p) => {
              if (p.id === id.toString()) {
                return {
                  ...p,
                  content: p.content + contentDelta,
                  reasoning: p.reasoning + reasoningDelta,
                  isReasoning: isThinkingRef.current,
                  error: false
                };
              }
              return p;
            })
          ]);
        }
      }

      const { outputTokens, inputTokens, totalTokens } = await usage;
      setMessages((prev) => [
        ...prev.map((p) => (
          p.id === id.toString() ? {
            ...p,
            content: p.content || "Received Empty response from LLM",
            completionTokens: outputTokens,
            promptTokens: inputTokens,
            totalTokens: totalTokens,
          } : p
        ))
      ]);
      setIsLoading(false);
    }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    catch (error: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isReasoning: false
        };
        return [
          ...updated,
          {
            id: new Date().getTime().toString(),
            content: JSON.stringify(error?.message || error),
            role: "assistant",
            timestamp: new Date(),
            error: true,
          }
        ];
      });
      setIsLoading(false);
    }

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

      // Always use Anthropic as the provider
      const provider = "anthropic";
      
      // Initialize if this cluster/config combination doesn't exist
      if (!kwAIChatHistory[clusterConfigKey]) {
        kwAIChatHistory[clusterConfigKey] = {
          [key]: {
            messages: [],
            provider
          }
        };
      }
      
      // Update the chat history
      kwAIChatHistory = {
        ...kwAIChatHistory,
        [clusterConfigKey]: {
          ...kwAIChatHistory[clusterConfigKey],
          [key]: {
            messages: messages,
            provider
          }
        }
      };
      
      localStorage.setItem('kwAIStoredChatHistory', JSON.stringify(kwAIChatHistory));
      console.log('Chat history saved successfully');
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };
  useEffect(() => {
    scrollToBottom();
    currentChatKey && messages.length && storeToChatHistory(currentChatKey);
  }, [messages]);

  useEffect(() => {
    const currentContext = kwAIStoredChatHistory[clusterConfigKey]?.[currentChatKey];
    if (currentContext?.messages) {
      setMessages(currentContext?.messages);
    } else {
      setMessages([]);
    }
  }, [currentChatKey]);

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  /* eslint-disable  @typescript-eslint/no-unused-vars */
  const getOverriddenComponents = () => {
    return {
      table: ({ node, ...props }: any) => <div className="w-full overflow-x-auto my-4"><table className="w-full text-sm border-collapse border border-border rounded-lg" {...props} /></div>,
      thead: ({ node, ...props }: any) => <thead className="[&_tr]:border-b bg-muted/50" {...props} />,
      tbody: ({ node, ...props }: any) => <tbody className="[&_tr:last-child]:border-0" {...props} />,
      tr: ({ node, ...props }: any) => <tr className="border-b border-border transition-colors hover:bg-muted/50" {...props} />,
      th: ({ node, ...props }: any) => <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider" {...props} />,
      td: ({ node, ...props }: any) => <td className="px-3 py-2 align-middle text-sm" {...props} />,
      h1: ({ node, ...props }: any) => <h1 className="text-2xl font-semibold text-foreground mt-2 mb-2 first:mt-0" {...props} />,
      h2: ({ node, ...props }: any) => <h2 className="text-xl font-semibold text-foreground mt-2 mb-2 first:mt-0" {...props} />,
      h3: ({ node, ...props }: any) => <h3 className="text-lg font-medium text-foreground mt-2 mb-2" {...props} />,
      h4: ({ node, ...props }: any) => <h4 className="text-base font-medium text-foreground mt-2 mb-2" {...props} />,
      h5: ({ node, ...props }: any) => <h5 className="text-sm font-medium text-foreground mt-2 mb-1" {...props} />,
      h6: ({ node, ...props }: any) => <h6 className="text-sm font-medium text-muted-foreground mt-2 mb-1" {...props} />,
      p: ({ node, ...props }: any) => <p className="leading-7 [&:not(:first-child)]:mt-2" {...props} />,
      a: ({ node, ...props }: any) => <a className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors" {...props} />,
      ul: ({ node, ...props }: any) => <ul className="my-1 ml-2 space-y-1 text-sm [&>li]:relative [&>li]:pl-4" {...props} />,
      ol: ({ node, ...props }: any) => <ol className="my-1 ml-2 space-y-1 text-sm list-decimal [&>li]:pl-1" {...props} />,
      li: ({ node, ...props }: any) => {
        const isInOrderedList = props.className?.includes("list-decimal");
        return <li className={`text-sm leading-relaxed ${!isInOrderedList ? 'before:content-["•"] before:absolute before:left-0 before:text-muted-foreground' : ""}`} {...props} />;
      },
      code: ({ node, ...props }: any) => {
        const { inline, children, className } = props;
        if (inline) {
          return <code className="relative rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground border">{children}</code>;
        }
        return <code className={`${className} font-mono text-xs leading-relaxed `} {...props}>{children}</code>;
      },
      pre: ({ node, ...props }: any) => <pre className="my-1 overflow-x-auto rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed border" {...props} />,
      hr: ({ node, ...props }: any) => <hr className="my-4 border-t border-border" {...props} />,
      img: ({ node, ...props }: any) => <img className="rounded-md border border-border shadow-sm my-1 max-w-full h-auto" {...props} />,
      strong: ({ node, ...props }: any) => <strong className="font-semibold text-foreground" {...props} />,
      em: ({ node, ...props }: any) => <em className="italic text-foreground" {...props} />,
      del: ({ node, ...props }: any) => <del className="line-through text-muted-foreground" {...props} />,
      blockquote: ({ node, ...props }: any) => <blockquote className="my-1 border-l-4 border-border pl-4 text-sm text-muted-foreground italic" {...props} />,
    };
  };
  /* eslint-enable  @typescript-eslint/no-unused-vars */
  /* eslint-enable  @typescript-eslint/no-explicit-any */
  const stopStream = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const IconCollapsibleCard = ({ icon: Icon, children, isReasoning }: any) => {
    const [copen, setCOpen] = useState(isReasoning);
    useEffect(() => {
      if (!isReasoning) {
        setCOpen(false);
      }
    }, [isReasoning]);
    return (
      <Collapsible open={copen} onOpenChange={setCOpen}>
        <CollapsibleTrigger asChild>
          <Card className={cn("cursor-pointer shadow-none transition-all duration-200 border-dashed rounded-md", copen ? "rounded-b-none" : "rounded-0")}>
            <CardHeader className="p-3">
              <div className="flex items-center space-x-3">
                <Icon className={cn("h-4 w-4 text-primary", isReasoning ? "animate-flashorange" : "text-orange-500")} />
                <div className="flex-1">
                  <CardTitle className="text-default font-medium tracking-tight">{isReasoning ? "Thinking..." : "Reasoning..."}</CardTitle>
                  <CardDescription className="text-xs"></CardDescription>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${copen ? 'rotate-90' : ''}`} />
              </div>
            </CardHeader>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className='transition-all duration-200'>
          <CardContent className="p-3 pt-2 border rounded-b-md border-t-0 border-dashed text-muted-foreground/95">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollAreaRef} className="flex-1 p-2 space-y-4 overflow-y-auto">
        <div>
          {messages.map((message) => (
            !(message.role === "system") &&
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end pt-4 pb-1" : "justify-start"}`}>
              <Card
                className={`max-w-[98%] p-3 pb-0 ${message.role === "user" ? "bg-primary text-primary-foreground" : message.error ? "w-[98%] border-red-100 border-none shadow-none" : "w-[98%] border-none shadow-none"}`}
              >
                {
                  messageLoading && message.content === "" && !message.reasoning ?
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    :
                    <>
                      <div className={`text-sm overflow-x-auto  ${message.error ? "" : ""}`}>
                        {
                          message.reasoning &&
                          <IconCollapsibleCard
                            icon={Lightbulb}
                            title="General Settings"
                            description="Configure your app preferences"
                            isReasoning={message.isReasoning}
                          >
                            <Markdown
                              remarkPlugins={[remarkGfm, rehypeFormat, remarkRehype, rehypeSanitize, remarkFrontmatter, remarkMath, remarkParse, remarkRehype, rehypeRaw, rehypeStringify, rehypeHighlight]}
                              components={getOverriddenComponents()}
                            >
                              {message.reasoning}
                            </Markdown>
                          </IconCollapsibleCard>
                        }
                        {
                          message.error && <div className="flex items-center gap-2 text-red-500"><ShieldAlert className="h-4 w-4" /> An error occured, please check the below details.</div>
                        }

                        <Markdown
                          remarkPlugins={[remarkGfm, rehypeFormat, remarkRehype, rehypeSanitize, remarkFrontmatter, remarkMath, remarkParse, remarkRehype, rehypeRaw, rehypeStringify, rehypeHighlight]}
                          components={getOverriddenComponents()}
                        >
                          {message.content}
                        </Markdown>
                      </div>
                    </>
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
            placeholder="Ask anything about current cluster..!!"
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
              <ModelSelector 
                cluster={cluster}
                config={config}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                isDetailsPage={isDetailsPage}
              />
              <Button variant="outline" size="default" onClick={resetChat}>
                <SquarePen className="h-4 w-4" />
                <span className='text-xs'>New Chat</span>
              </Button>
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
                disabled={isLoading || !input.trim() || !selectedModel}
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
