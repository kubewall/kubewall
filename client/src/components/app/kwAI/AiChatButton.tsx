import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Sparkles } from "lucide-react";

type AiChatButtonProps = {
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
}

export function AiChatButton({ showChat, setShowChat }: AiChatButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="ml-2 relative inline-block cursor-pointer" onClick={() => setShowChat(!showChat)}>
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-600 to-blue-500 rounded-sm blur-[4px] animate-pulse"></div>
            <div className="relative inline-flex i gap-[0.125rem] w-12 h-8 bg-background rounded-md flex items-center justify-center border border-gray-200 dark:border-none shadow-sm hover:bg-accent hover:text-accent-foreground">
              <Sparkles className="w-4 h-4" />
              <span className='text-xs'>AI</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          kwAI Chat
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
