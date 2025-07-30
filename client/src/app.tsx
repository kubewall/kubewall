import { Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { createEventStreamQueryObject, getEventStreamUrl } from "./utils";
import { useRef, useEffect } from "react";

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
  const hasRedirectedRef = useRef(false);

  const sendMessage = (message: NamespacesResponse[]) => {
    dispatch(updateNamspaces(message));
  };

  const handleConfigError = () => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current) {
      return;
    }
    
    hasRedirectedRef.current = true;
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

  // Reset the redirect flag when the config changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [configName]);

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
