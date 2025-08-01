import { CloudShell } from "./CloudShell";
import { cloudShellRoute } from "@/routes";

export function CloudShellDetailsContainer() {
  const { config } = cloudShellRoute.useParams();
  const { cluster, namespace = "default" } = cloudShellRoute.useSearch();
  
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