import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resetFilterNamespace, updateFilterNamespace } from "@/data/Misc/ListTableNamesapceSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@radix-ui/react-icons";
import { Column } from "@tanstack/react-table";
import { ListFilterIcon } from "lucide-react";
import { RootState } from "@/redux/store";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type DataTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string,
    value: string,
    icon?: React.ComponentType<{ className?: string }>,
  }[];
};

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const {
    selectedNamespace
  } = useAppSelector((state: RootState) => state.listTableNamesapce);
  const dispatch = useAppDispatch();
  const facets = column?.getFacetedUniqueValues();

  // Single select: get the first value or undefined
  const selectedValue = selectedNamespace?.[0];

  // Apply the filter on mount if there's a selected namespace
  useEffect(() => {
    if (selectedValue && column) {
      column.setFilterValue(selectedValue);
    }
  }, [selectedValue, column]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shadow-none gap-0">
          <ListFilterIcon className="mr-2 h-4 w-4" />
          {title}
          {selectedValue && (
            <>
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {options.find((option) => option.value === selectedValue)?.label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValue === option.value;
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      // Single select logic: toggle selection
                      const newValue = isSelected ? undefined : option.value;

                      // Update Redux state
                      dispatch(updateFilterNamespace(newValue ? [newValue] : []));

                      // Update column filter
                      column?.setFilterValue(newValue);
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <CheckIcon className={cn("h-4 w-4")} />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValue && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      column?.setFilterValue(undefined);
                      dispatch(resetFilterNamespace());
                    }}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
