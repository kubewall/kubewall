import { Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { createEventStreamQueryObject, getEventStreamUrl } from "./utils";

import { NAMESPACES_ENDPOINT } from "./constants";
import { NamespacesResponse } from "./types";
import { Sidebar } from "@/components/app/Sidebar";
import { updateNamspaces } from "./data/Clusters/Namespaces/NamespacesSlice";
import { useAppDispatch } from "./redux/hooks";
import { useEventSource } from "./components/app/Common/Hooks/EventSource";

export function App() {
  const dispatch = useAppDispatch();
  const router = useRouterState();
  const pathname = router.location.pathname;
  const configName = pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';

  const sendMessage = (message: NamespacesResponse[]) => {
    dispatch(updateNamspaces(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      NAMESPACES_ENDPOINT,
      createEventStreamQueryObject(
        configName,
        clusterName
      )),
    sendMessage
  });

  return (
    <>
      <SidebarProvider >
        <Sidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>

      </SidebarProvider>
    </>
  );
}