import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dispatch, SetStateAction, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { PodDetailsSpec } from "@/types";
import { PopoverProps } from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { getCssColorForContainerName } from "@/utils";

type PresetSelectorProps = {
  podDetailsSpec: PodDetailsSpec;
  selectedContainer: string;
  setSelectedContainer: Dispatch<SetStateAction<string>>;
} & PopoverProps;

export function CotainerSelector({ podDetailsSpec, selectedContainer, setSelectedContainer, ...props }: PresetSelectorProps) {
  const [open, setOpen] = useState(false);

  const allContainers = [...podDetailsSpec.containers, ...(podDetailsSpec?.initContainers || [])];

  const selectedColor = selectedContainer
    ? getCssColorForContainerName(selectedContainer, podDetailsSpec)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="All Containers"
          aria-expanded={open}
          className="flex items-center gap-2 h-10 px-3 text-xs font-medium hover:bg-accent transition-colors min-w-[140px] max-w-[220px]"
        >
          {selectedColor ? (
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedColor }} />
          ) : (
            <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-muted-foreground/30" />
          )}
          <span className="truncate flex-1 text-left">{selectedContainer || 'All Containers'}</span>
          <CaretSortIcon className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0">
        <Command>
          <CommandInput className="text-xs font-medium" placeholder="Search container..." />
          <CommandEmpty>No containers found</CommandEmpty>
          <CommandGroup>
            <CommandItem
              key="all-containers"
              onSelect={() => {
                setSelectedContainer('');
                setOpen(false);
              }}
              className="text-xs font-medium gap-2"
            >
              <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-muted-foreground/30" />
              All Containers
              <CheckIcon className={cn("ml-auto h-4 w-4", selectedContainer === '' ? "opacity-100" : "opacity-0")} />
            </CommandItem>
            {allContainers.map(({ name }) => {
              const dotColor = getCssColorForContainerName(name, podDetailsSpec);
              return (
                <CommandItem
                  key={name}
                  onSelect={() => {
                    setSelectedContainer(name);
                    setOpen(false);
                  }}
                  className="text-xs font-medium gap-2"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  {name}
                  <CheckIcon className={cn("ml-auto h-4 w-4", selectedContainer === name ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
