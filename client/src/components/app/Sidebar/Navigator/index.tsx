import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { CubeIcon, EnterIcon } from "@radix-ui/react-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { Input } from "@/components/ui/input";
import { NAVIGATION_ROUTE } from "@/constants";
import { RootState } from "@/redux/store";
import { SearchIcon } from "lucide-react";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { useSidebar } from "@/components/ui/sidebar";

type SidebarNavigator = {
  setOpenMenus: (value: React.SetStateAction<Record<string, boolean>>) => void
}

const SidebarNavigator = memo(function ({ setOpenMenus }: SidebarNavigator) {
  const dispatch = useAppDispatch();
  const {
    customResourcesNavigation
  } = useAppSelector((state: RootState) => state.customResources);

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouterState();
  const configName = router.location.pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';
  const { open: isSidebarOpen } = useSidebar();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const onSelectResources = (routeValue: string, route: string) => {
    dispatch(resetListTableFilter());
    navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=${routeValue}` });
    setOpen((open) => !open);
    setOpenMenus((prev) => ({
      ...prev,
      [route]: true,
    }));
  };

  const onSelectCustomResources = (routeValue: string, route: string) => {
    dispatch(resetListTableFilter());
    navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=customresources&${routeValue}` });
    setOpen((open) => !open);
    setOpenMenus((prev) => ({
      ...prev,
      [route]: true,
    }));
  };

  return (
    <>
      {
        isSidebarOpen ?
          <Input
            className="h-8 mt-2 shadow-none"
            placeholder="Open... (⌘K)"
            onClick={() => setOpen((open) => !open)}
          /> :
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="!mt-1 flex items-center justify-center">
                <SearchIcon width={16} onClick={() => setOpen((open) => !open)} />

              </div>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
            >Open... (⌘K)</TooltipContent>
          </Tooltip>
      }

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {
            Object.keys(NAVIGATION_ROUTE).map((route) => {
              return (
                <CommandGroup heading={route} key={route}>
                  {
                    NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => {
                      return (
                        <CommandItem key={routeValue} className="group cursor-pointer" onSelect={() => onSelectResources(routeValue, route)}>
                          <CubeIcon className="mr-2 h-4 w-4" />
                          <span>
                            {name}
                          </span>
                          <CommandShortcut className="invisible group-aria-[selected=true]:visible"><EnterIcon /></CommandShortcut>
                        </CommandItem>
                      );
                    })
                  }
                </CommandGroup>
              );
            })
          }
          {
            <CommandGroup heading='Custom Resource'>
              {
                Object.keys(customResourcesNavigation).map((customResourceGroup) => {
                  return (
                    customResourcesNavigation[customResourceGroup].resources.map((customResource) => {
                      return (
                        <CommandItem
                          key={customResource.name}
                          className="group cursor-pointer"
                          onSelect={() => onSelectCustomResources(customResource.route, customResourceGroup)}
                        >
                          <CubeIcon className="mr-2 h-4 w-4" />
                          <span>
                            {customResource.name} <span className="text-xs">({customResourceGroup})</span>
                          </span>
                          <CommandShortcut className="invisible group-aria-[selected=true]:visible"><EnterIcon /></CommandShortcut>
                        </CommandItem>
                      );
                    })
                  );
                })
              }
            </CommandGroup>
          }
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    </>
  );
});

export {
  SidebarNavigator
};