import { Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { createEventStreamQueryObject, getEventStreamUrl } from "./utils";

import { NAMESPACES_ENDPOINT } from "./constants";
import { NamespacesResponse } from "./types";
import { Sidebar } from "@/components/app/Sidebar";
import { updateNamspaces } from "./data/Clusters/Namespaces/NamespacesSlice";
import { useAppDispatch } from "./redux/hooks";
import { useEventSource } from "./components/app/Common/Hooks/EventSource";
import { toast } from "sonner";

export function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const router = useRouterState();
  const pathname = router.location.pathname;
  const configName = pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';

  const sendMessage = (message: NamespacesResponse[]) => {
    dispatch(updateNamspaces(message));
  };

  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  useEventSource({
    url: getEventStreamUrl(
      NAMESPACES_ENDPOINT,
      createEventStreamQueryObject(
        configName,
        clusterName
      )),
    sendMessage,
    onConfigError: handleConfigError,
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
