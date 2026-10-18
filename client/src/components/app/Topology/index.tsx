import addons from "@/addons";
import capabilities from "@/capabilities";
import { kwTopology } from "@/routes";

// Resolved once at module load, same pattern as every other addon slot
// (see Common/Details/index.tsx) — free builds have no `enterprise-client`
// submodule, so this is null and the fallback below renders instead.
const TopologyView = addons.topology?.TopologyView ?? null;
const topologyEnabled = !!capabilities.topology?.enabled && !!TopologyView;

const Topology = () => {
  const { config } = kwTopology.useParams();
  const { cluster } = kwTopology.useSearch();

  if (!topologyEnabled || !TopologyView) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Topology is a premium feature and is not enabled for this build.
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <TopologyView configName={config} clusterName={cluster} />
    </div>
  );
};

export default Topology;

export {
  Topology
};
