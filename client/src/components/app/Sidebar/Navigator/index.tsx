import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { CubeIcon, EnterIcon } from "@radix-ui/react-icons";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { Input } from "@/components/ui/input";
import { NAVIGATION_ROUTE } from "@/constants";
import { RootState } from "@/redux/store";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";

const SidebarNavigator = memo(function () {
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

  const onSelectResources = (route: string) => {
    dispatch(resetListTableFilter());
    navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=${route}` });
    setOpen((open) => !open);
  };

  const onSelectCustomResources = (route: string) => {
    dispatch(resetListTableFilter());
    navigate({ to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=customresources&${route}` });
    setOpen((open) => !open);
  };

  return (
    <>
      <Input
        className="h-8 mt-2 shadow-none"
        placeholder="Open... (⌘K)"
        onClick={() => setOpen((open) => !open)}
      />
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
                        <CommandItem key={routeValue} className="group cursor-pointer" onSelect={() => onSelectResources(routeValue)}>
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
                          onSelect={() => onSelectCustomResources(customResource.route)}
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