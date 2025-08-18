import { CloudShell } from "./CloudShell";
import { cloudShellRoute } from "@/routes";
import { useFeatureFlag } from "@/hooks/useRuntimeFeatureFlags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export function CloudShellDetailsContainer() {
  const { config } = cloudShellRoute.useParams();
  const { cluster, namespace = "default" } = cloudShellRoute.useSearch();
  const { isEnabled: isCloudShellEnabled, isLoading } = useFeatureFlag('ENABLE_CLOUD_SHELL');
  
  if (isLoading) {
    return (
      <div className="cloud-shell-details-container">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!isCloudShellEnabled) {
    return (
      <div className="cloud-shell-details-container">
        <Card>
          <CardHeader>
            <CardTitle>Cloud Shell</CardTitle>
            <CardDescription>
              Interactive terminal access to your Kubernetes cluster
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Cloud Shell feature is currently disabled. Please contact your administrator to enable this feature.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="cloud-shell-details-container">
      <CloudShell 
        configName={config}
        clusterName={cluster}
        namespace={namespace}
      />
    </div>
  );
}