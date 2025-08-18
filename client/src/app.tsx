import { Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { useRef, useEffect } from "react";

import { Sidebar } from "@/components/app/Sidebar";
import { useAppDispatch, useAppSelector } from "./redux/hooks";
import { PermissionErrorPage } from "./components/app/Common/PermissionErrorPage";
import { RootState } from "./redux/store";
import { clearPermissionError } from "./data/PermissionErrors/PermissionErrorsSlice";
import { ThemeModeSelector } from "@/components/app/Common/ThemeModeSelector";

export function App() {
  const dispatch = useAppDispatch();
  const router = useRouterState();
  const pathname = router.location.pathname;
  const configName = pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const resourceKind = queryParams.get('resourcekind') || '';
  const hasRedirectedRef = useRef(false);

  // Get permission error state
  const { currentError, isPermissionErrorVisible } = useAppSelector(
    (state: RootState) => state.permissionErrors
  );

  // Clear permission error when navigating to a different resource
  useEffect(() => {
    if (currentError && isPermissionErrorVisible) {
      // Check if the current resource kind is different from the error resource
      const errorResource = currentError.resource?.toLowerCase();
      const currentResource = resourceKind.toLowerCase();
      
      if (errorResource && currentResource && errorResource !== currentResource) {
        // User navigated to a different resource, clear the permission error
        dispatch(clearPermissionError());
      }
    }
  }, [resourceKind, currentError, isPermissionErrorVisible, dispatch]);

  // Reset the redirect flag when the config changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [configName]);

  // Handle retry for permission errors
  const handlePermissionErrorRetry = () => {
    dispatch(clearPermissionError());
    // Optionally refresh the page or reconnect to the event source
    window.location.reload();
  };

  return (
    <>
      <SidebarProvider >
        <Sidebar />
        <SidebarInset>
          {currentError && isPermissionErrorVisible ? (
            <PermissionErrorPage
              error={currentError}
              onRetry={handlePermissionErrorRetry}
              showBackButton={true}
              showRetryButton={true}
            />
          ) : (
            <Outlet />
          )}
        </SidebarInset>
      </SidebarProvider>
      {/* Floating theme toggle (bottom-right across all pages) */}
      <div className="fixed right-4 bottom-4 z-[60]">
        <ThemeModeSelector />
      </div>
      {/* Remove the GlobalPermissionErrorHandler since we're now showing full page errors */}
    </>
  );
}
