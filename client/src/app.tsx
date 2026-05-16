import { Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { createEventStreamQueryObject, getEventStreamUrl } from "./utils";

import { NAMESPACES_ENDPOINT } from "./constants";
import { NamespacesResponse } from "./types";
import { Sidebar } from "@/components/app/Sidebar";
import addons from "@/addons";
import capabilities from "@/capabilities";
import { updateNamspaces } from "./data/Clusters/Namespaces/NamespacesSlice";
import { useAppDispatch, useAppSelector } from "./redux/hooks";
import { useEventSource } from "./components/app/Common/Hooks/EventSource";

const COLLAPSED_BAR_PX = 36;
const DEFAULT_EXPANDED_PX = 320;

// Resolve the TerminalContainer from the addon registry.
// Null in the free/community build — the slot simply renders nothing.
const { TerminalContainer } = addons.terminal ?? {};

export function App() {
  const dispatch = useAppDispatch();
  const router = useRouterState();
  const pathname = router.location.pathname;
  const configName = pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';

  // Terminal state lives in the addon's reducer (injected dynamically).
  // When the terminal addon is absent the selector returns undefined and
  // terminalHeightPx stays 0 — no layout impact.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const terminalState = useAppSelector((s: any) => s.terminal);
  const isVisible   = terminalState?.isVisible   ?? false;
  const isExpanded  = terminalState?.isExpanded  ?? false;
  const panelHeight = terminalState?.panelHeight ?? DEFAULT_EXPANDED_PX;

  const terminalEnabled = capabilities.terminal.enabled && !!TerminalContainer;

  const terminalHeightPx = !terminalEnabled || !isVisible
    ? 0
    : isExpanded
      ? panelHeight
      : COLLAPSED_BAR_PX;

  const sendMessage = (message: NamespacesResponse[]) => {
    dispatch(updateNamspaces(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      NAMESPACES_ENDPOINT,
      createEventStreamQueryObject(configName, clusterName)
    ),
    sendMessage,
  });

  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="overflow-hidden h-screen">
        <div
          className="flex flex-col h-full"
          style={{ '--terminal-height': `${terminalHeightPx}px` } as React.CSSProperties}
        >
          {/* Page content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </div>

          {/* Terminal addon slot — renders nothing when addon is absent */}
          {terminalEnabled && configName && clusterName && (
            <div
              className="shrink-0 overflow-hidden"
              style={{ height: terminalHeightPx }}
            >
              <TerminalContainer
                configName={configName}
                clusterName={clusterName}
              />
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
