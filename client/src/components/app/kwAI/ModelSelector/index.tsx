import { useEffect, useState } from "react";
import { kwAIModel } from "@/types/kwAI/addConfiguration";
import { kwAiModels } from "@/data/KwClusters/kwAiModelsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarSize } from "@/hooks/use-get-sidebar-size";

type ModelSelectorProps = {
  cluster: string;
  config: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isDetailsPage?: boolean;
}

const ModelSelector = ({ cluster, config, selectedModel, setSelectedModel }: ModelSelectorProps) => {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<kwAIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const kwAiChatWindow = useSidebarSize("kwai-chat");
  
  const {
    kwAiModel,
    loading: modelsLoading
  } = useAppSelector((state) => state.kwAiModels);

  useEffect(() => {
    // Fetch models from Anthropic
    const queryParams = `provider=anthropic&cluster=${cluster}&config=${config}`;
    const apiKey = ""; // No API key needed as we're using the proxy
    
    dispatch(kwAiModels({ apiKey, queryParams }));
    
    // Set loading to false after a short delay if it's taking too long
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [dispatch, cluster, config, loading]);

  useEffect(() => {
    if (kwAiModel && kwAiModel.length > 0) {
      setModels(kwAiModel);
      setLoading(false);
      
      // Set the first model as selected if none is selected
      if (!selectedModel && kwAiModel.length > 0) {
        setSelectedModel(kwAiModel[0].value);
      }
    } else if (!loading && !modelsLoading) {
      // If no models are available and we're not loading, show empty state
      setModels([]);
      setLoading(false);
    }
  }, [kwAiModel, selectedModel, setSelectedModel, loading, modelsLoading]);

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[15rem] justify-between shadow-none truncate py-1 px-2"
            disabled={loading || modelsLoading}
          >
            <span className='truncate text-xs'>
              {loading || modelsLoading 
                ? 'Loading models...' 
                : models.find(model => model.value === selectedModel)?.label || 'Select Model...'}
            </span>
            <ChevronsUpDown className="opacity-50 h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={`p-0 min-w-[--radix-popover-trigger-width] w-auto`} style={{ 'maxWidth': kwAiChatWindow.width - 50 }} align="start">
          <Command>
            <CommandInput placeholder='Search Models' className="h-9" id="modelSearch" />
            <CommandList>
              <CommandEmpty>No models found.</CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model.value}
                    value={model.value}
                    onSelect={(value) => {
                      setSelectedModel(value);
                      setOpen(false);
                    }}
                  >
                    <div>
                      <span>{model.label}</span>
                    </div>
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4",
                        model.value === selectedModel ? "opacity-100" : "opacity-0"
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
  );
};

export { ModelSelector };