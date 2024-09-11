import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { PodDetailsSpec } from "@/types";
import { PopoverProps } from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { setSelectedContainer } from "@/data/Workloads/Pods/PodLogsSlice";
import { useAppDispatch } from "@/redux/hooks";
import { useState } from "react";

type PresetSelectorProps = {
  podDetailsSpec: PodDetailsSpec;
  selectedContainer: string;
} & PopoverProps;

export function CotainerSelector({podDetailsSpec,  selectedContainer, ...props }: PresetSelectorProps) {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();

  const updateSelectedContainer = (containerName: string) => {
    dispatch(setSelectedContainer(containerName));
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild className="font-medium text-xs">
        <Button
          variant="outline"
          role="combobox"
          aria-label="All Containers"
          aria-expanded={open}
          className="flex-1 justify-between md:max-w-[200px] lg:max-w-[300px] shadow-none h-8 text-[muted]"
        >
          {selectedContainer ? selectedContainer : "All Containers"}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput className=" font-medium text-xs" placeholder="Search Container..." />
          <CommandEmpty>No Containers found</CommandEmpty>
          <CommandGroup heading="">
            <CommandItem
              key='all-containers'
              onSelect={() => {
                updateSelectedContainer('');
                setOpen(false);
              }}
              className=" font-medium text-xs"
            >
              All Containers
              <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedContainer === ''
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
            </CommandItem>
            {podDetailsSpec.containers.map(({name}) => (
              <CommandItem
                key={name}
                onSelect={() => {
                  updateSelectedContainer(name);
                  setOpen(false);
                }}
                className=" font-medium text-xs"
              >
                {name}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedContainer === name
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}