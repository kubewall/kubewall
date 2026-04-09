"use client";

import * as React from "react";

import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/types";
import { cn } from "@/lib/utils";

export function ComboboxDemo({ data, setValue, value, placeholder }: Combobox) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between !mt-1 shadow-none"
        >
          <span className="flex items-center gap-2 truncate">
            {(() => {
              const selected = data.find(item => item.value === value);
              if (!selected) return placeholder;
              const Icon = selected.icon;
              return (
                <>
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {selected.label}
                </>
              );
            })()}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-none" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-9" id="comboboxSearch"/>
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {data.map((selection) => (
                <CommandItem
                  key={selection.value}
                  value={selection.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {selection.icon && <selection.icon className="h-4 w-4 shrink-0" />}
                    {selection.label}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto",
                      selection.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
