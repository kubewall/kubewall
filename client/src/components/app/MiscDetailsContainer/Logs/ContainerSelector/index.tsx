import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { PodDetailsSpec } from "@/types";
import { PopoverProps } from "@radix-ui/react-popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getCssColorForContainerName } from "@/utils/Workloads/PodUtils";
import { useState } from "react";

type ContainerSelectorProps = {
  podDetailsSpec: PodDetailsSpec;
  /** Empty means every container. */
  selectedContainers: Set<string>;
  setSelectedContainers: (next: Set<string>) => void;
} & PopoverProps;

export function CotainerSelector({
  podDetailsSpec, selectedContainers, setSelectedContainers, ...props
}: ContainerSelectorProps) {
  const [open, setOpen] = useState(false);

  const allContainers = [
    ...(podDetailsSpec?.containers ?? []),
    ...(podDetailsSpec?.initContainers ?? []),
  ];

  const showingAll = selectedContainers.size === 0;

  const toggle = (name: string) => {
    const next = new Set(selectedContainers);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    // Every container ticked is the same view as none ticked; keep the simpler state.
    if (next.size === allContainers.length) next.clear();
    setSelectedContainers(next);
  };

  // A single container is named; anything else is counted, including "all".
  const shownCount = showingAll ? allContainers.length : selectedContainers.size;
  const label = selectedContainers.size === 1
    ? [...selectedContainers][0]
    : `${shownCount} container${shownCount === 1 ? '' : 's'}`;

  const dots = (showingAll ? allContainers.map((c) => c.name) : [...selectedContainers]).slice(0, 3);

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
          type="button"
          role="combobox"
          aria-label="Filter containers"
          aria-expanded={open}
          className="flex items-center gap-2 h-10 px-3 text-xs font-medium hover:bg-accent transition-colors min-w-[140px] max-w-[220px]"
        >
          {dots.length ? (
            <span className="flex shrink-0 -space-x-1">
              {dots.map((name) => (
                <span
                  key={name}
                  className="inline-block w-2 h-2 rounded-full ring-1 ring-background"
                  style={{ backgroundColor: getCssColorForContainerName(name, podDetailsSpec) }}
                />
              ))}
            </span>
          ) : (
            <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-muted-foreground/30" />
          )}
          <span className="truncate flex-1 text-left">{label}</span>
          <CaretSortIcon className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {showingAll
            ? 'Showing every container — click to pick one or more'
            : `Showing ${[...selectedContainers].join(', ')} — click to change`}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-[260px] p-0">
        <Command>
          <CommandInput className="text-xs font-medium" placeholder="Search container..." />
          <CommandEmpty>No containers found</CommandEmpty>
          <CommandGroup>
            <CommandItem
              key="all-containers"
              value="All Containers"
              onSelect={() => setSelectedContainers(new Set())}
              className="text-xs font-medium gap-2"
            >
              <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-muted-foreground/30" />
              All Containers
              <CheckIcon className={cn("ml-auto h-4 w-4", showingAll ? "opacity-100" : "opacity-0")} />
            </CommandItem>
            {allContainers.map(({ name }) => (
              <CommandItem
                key={name}
                value={name}
                onSelect={() => toggle(name)}
                className="text-xs font-medium gap-2"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getCssColorForContainerName(name, podDetailsSpec) }}
                />
                {name}
                <CheckIcon
                  className={cn("ml-auto h-4 w-4", selectedContainers.has(name) ? "opacity-100" : "opacity-0")}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
