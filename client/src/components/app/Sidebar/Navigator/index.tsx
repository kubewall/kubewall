import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { memo, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { resetListTableFilter } from "@/data/Misc/ListTableFilterSlice";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { Archive, ArrowRightLeft, Bell, Box, Boxes, BriefcaseBusiness, CalendarClock, Component, CopyPlus, Cpu, EthernetPort, FileBox, FileClock, FileCog, Gauge, Globe, HardDrive, HeartPulse, IdCard, KeyRound, Layers3, Link2, ListOrdered, LucideIcon, Network, Plug, Rocket, Ruler, Server, ServerCog, ShieldAlert, ShieldCheck, ShieldHalf, ShieldPlus, SlidersHorizontal, SquareStack, TrendingUp } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { NAVIGATION_ROUTE } from "@/constants";
import { cn } from "@/lib/utils";
import { RootState } from "@/redux/store";
import { SearchIcon } from "lucide-react";
import { SvgRenderer } from '../../Common/SvgRenderer';
import { useIsMac } from "@/hooks/use-is-mac";
import { useSidebar } from "@/components/ui/sidebar";

// One icon per resource kind, not per group. The palette previously reused the
// group's glyph for every row inside it, so seven Workloads entries all showed
// the same mark - repetition that cost vertical space without helping anyone
// find a row. Keyed by the same route value the nav config uses.
const RESOURCE_ICONS: Record<string, LucideIcon> = {
  // Cluster
  nodes: Server,
  namespaces: Boxes,
  leases: FileClock,
  events: Bell,
  // Workloads
  pods: Box,
  deployments: Rocket,
  daemonsets: Layers3,
  statefulsets: SquareStack,
  replicasets: CopyPlus,
  jobs: BriefcaseBusiness,
  cronjobs: CalendarClock,
  // Configuration
  secrets: KeyRound,
  configmaps: FileCog,
  horizontalpodautoscalers: TrendingUp,
  limitranges: Ruler,
  resourcequotas: Gauge,
  priorityclasses: ListOrdered,
  runtimeclasses: Cpu,
  poddisruptionbudgets: HeartPulse,
  // Access Control
  serviceaccounts: IdCard,
  roles: ShieldCheck,
  rolebindings: ShieldPlus,
  clusterroles: ShieldHalf,
  clusterrolebindings: Link2,
  // Network
  services: Network,
  ingresses: Globe,
  endpoints: EthernetPort,
  networkpolicies: ShieldAlert,
  portforwards: ArrowRightLeft,
  // Storage
  persistentvolumeclaims: FileBox,
  persistentvolumes: HardDrive,
  storageclasses: Archive,
  csidrivers: Plug,
  csinodes: ServerCog,
  volumeattributesclasses: SlidersHorizontal,
};

const getResourceIcon = (route: string) => RESOURCE_ICONS[route] ?? Component;

// A bare 16px glyph in a fixed slot rather than a bordered tile: a column of
// chips reads as heavier than the text it labels.
const ROW_ICON_CLASS = "size-4 shrink-0 text-muted-foreground/70 transition-colors group-aria-[selected=true]:text-foreground";

// Only the highlighted row advertises Enter - showing it on all of them turns the
// right edge into noise.
const EnterHint = () => (
  <CommandShortcut className="opacity-0 transition-opacity group-aria-[selected=true]:opacity-100">
    <Kbd square className="bg-background">↵</Kbd>
  </CommandShortcut>
);

const CurrentTag = () => (
  <span className="shrink-0 rounded border border-border/70 bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
    current
  </span>
);

const META_CLASS = "min-w-0 shrink truncate text-[11.5px] text-muted-foreground/60";

type SidebarNavigatorProps = {
  setOpenMenus: (value: React.SetStateAction<Record<string, boolean>>) => void;
};

const SidebarNavigator = memo(function SidebarNavigator({ setOpenMenus }: SidebarNavigatorProps) {
  const dispatch = useAppDispatch();
  const { customResourcesNavigation } = useAppSelector((state: RootState) => state.customResources);
  const { clusters } = useAppSelector((state: RootState) => state.clusters);

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Narrow selector (shallow-compared) so this component only re-renders
  // when pathname/search actually change, not on every router state transition.
  const { pathname, search } = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, search: state.location.search }),
  });
  const configName = pathname.split("/")[1];
  const queryParams = new URLSearchParams(search);
  const clusterName = queryParams.get("cluster") || "";
  const activeResourceKind = queryParams.get("resourcekind") || "";
  const { open: isSidebarOpen, openMobile } = useSidebar();
  const isMac = useIsMac();

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
    navigate({
      to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=${routeValue}`,
    });
    setOpen(false);
    setOpenMenus((prev) => ({
      ...prev,
      [route]: true,
    }));
  };

  const onSelectCustomResources = (routeValue: string, route: string) => {
    navigate({
      to: `/${configName}/list?cluster=${encodeURIComponent(clusterName)}&resourcekind=customresources&${routeValue}`,
    });
    setOpen(false);
    setOpenMenus((prev) => ({
      ...prev,
      [route]: true,
    }));
  };

  const onSelectCluster = (config: string, name: string) => {
    dispatch(resetListTableFilter());
    navigate({ to: `/${config}/list?cluster=${encodeURIComponent(name)}&resourcekind=pods` });
    setOpen(false);
  };

  return (
    <>
      {isSidebarOpen || openMobile ? (
        <button
          type="button"
          onClick={() => setOpen((open) => !open)}
          className="mt-2 flex h-8 w-full items-center gap-2 rounded-md border bg-muted/50 px-2 text-sm text-muted-foreground shadow-none transition-colors hover:bg-muted"
        >
          <SearchIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1 truncate text-left">Search resources...</span>
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            <Kbd className="bg-background">{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd square className="bg-background">K</Kbd>
          </span>
        </button >
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="!mt-1 mx-auto flex size-8 items-center justify-center">
              <SearchIcon width={16} onClick={() => setOpen((open) => !open)} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            Search resources {isMac ? "⌘" : "Ctrl"} K
          </TooltipContent>
        </Tooltip>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a resource or cluster..." />
        <CommandList>
          <CommandEmpty className="py-0">
            <div className="flex flex-col items-center gap-2 py-8">
              <span className="flex size-9 items-center justify-center rounded-full border border-dashed text-muted-foreground/60">
                <SearchIcon className="h-4 w-4" />
              </span>
              <span className="text-[13px] text-muted-foreground">No matches found</span>
            </div>
          </CommandEmpty>

          {Object.keys(NAVIGATION_ROUTE).map((route) => (
            <CommandGroup heading={route} key={route}>
              {NAVIGATION_ROUTE[route].map(({ name, route: routeValue }) => (
                <CommandItem
                  key={routeValue}
                  value={`${name} ${route}`}
                  className="group cursor-pointer"
                  onSelect={() => onSelectResources(routeValue, route)}
                >
                  {(() => { const Icon = getResourceIcon(routeValue); return <Icon className={ROW_ICON_CLASS} />; })()}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {activeResourceKind === routeValue && <CurrentTag />}
                  <EnterHint />
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {Object.keys(customResourcesNavigation).length > 0 && (
            <CommandGroup heading="Custom Resources">
              {Object.keys(customResourcesNavigation).map((customResourceGroup) =>
                customResourcesNavigation[customResourceGroup].resources.map((customResource) => (
                  <CommandItem
                    key={`${customResourceGroup}::${customResource.name}`}
                    value={`${customResource.name} ${customResourceGroup}`}
                    className="group cursor-pointer"
                    onSelect={() => onSelectCustomResources(customResource.route, customResourceGroup)}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <SvgRenderer
                        name={customResourcesNavigation[customResourceGroup].resources[0].icon}
                        className="size-4 object-contain"
                        minWidth={16}
                        fallback={<Component className={ROW_ICON_CLASS} />}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{customResource.name}</span>
                    <span className={META_CLASS}>{customResourceGroup}</span>
                    <EnterHint />
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}

          {clusters?.kubeConfigs && Object.keys(clusters.kubeConfigs).length > 0 && (
            <>
              <CommandSeparator className="my-1" />
              <CommandGroup heading="Clusters">
                {Object.keys(clusters.kubeConfigs).map((config) =>
                  Object.keys(clusters.kubeConfigs[config].clusters).map((key) => {
                    const { name, connected } = clusters.kubeConfigs[config].clusters[key];
                    const isActive = config === configName && name === clusterName;
                    return (
                      <CommandItem
                        key={`${config}::${name}`}
                        value={`${config}::${name}`}
                        className="group cursor-pointer"
                        onSelect={() => onSelectCluster(config, name)}
                      >
                        <Server className={ROW_ICON_CLASS} />
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            connected ? "bg-emerald-500" : "bg-muted-foreground/40"
                          )}
                        />
                        <span className={META_CLASS}>{config}</span>
                        {isActive && <CurrentTag />}
                        <EnterHint />
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog >
    </>
  );
});

export { SidebarNavigator };
