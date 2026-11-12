import addons from "@/addons";
import capabilities from "@/capabilities";
import { kwDashboard } from "@/routes";

// Resolved once at module load, same pattern as every other addon slot
// (see Topology/index.tsx) — free builds have no `enterprise-client`
// submodule, so this is null and the fallback below renders instead.
const DashboardView = addons.dashboard?.DashboardView ?? null;
const dashboardEnabled = !!capabilities.dashboard?.enabled && !!DashboardView;

const Dashboard = () => {
  const { config } = kwDashboard.useParams();
  const { cluster } = kwDashboard.useSearch();

  if (!dashboardEnabled || !DashboardView) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Dashboard is a premium feature and is not enabled for this build.
      </div>
    );
  }

  return (
    // h-full, not h-screen like Topology: the dashboard scrolls inside the
    // outlet, so it must stop above the terminal panel rather than under it.
    <div className="h-full w-full">
      <DashboardView configName={config} clusterName={cluster} />
    </div>
  );
};

export default Dashboard;

export {
  Dashboard
};
