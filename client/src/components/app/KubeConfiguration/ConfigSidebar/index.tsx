import { FolderPlus, Settings } from 'lucide-react';

import { ClustersDetails } from '@/types';
import { cn } from '@/lib/utils';

type ConfigMap = { [key: string]: ClustersDetails };

type ConfigSidebarProps = {
  addedConfigs: ConfigMap;
  systemConfigs: ConfigMap;
  selectedConfig: string | null;
  onSelect: (config: string | null) => void;
};

const totalClusterCount = (configs: ConfigMap) =>
  Object.values(configs).reduce((sum, details) => sum + Object.keys(details.clusters).length, 0);

// Active-selection marker, mirroring SidebarMenuSubButton in components/ui/sidebar.tsx
// so this filter reads the same as the nav on the list/details pages: a thin
// rounded bar pinned to the left edge, revealed via `data-active`. Height is
// proportional (`h-1/2`) rather than the nav's fixed `h-3.5` because these rows
// are taller — config rows carry a second line for the file path.
const activeBar =
  'relative before:absolute before:left-0 before:top-1/2 before:h-1/2 before:w-[1.5px] ' +
  'before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-foreground before:opacity-0 ' +
  'data-[active=true]:before:opacity-100';

function SectionLabel({ icon: Icon, label }: { icon: typeof Settings; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function ConfigSidebar({ addedConfigs, systemConfigs, selectedConfig, onSelect }: ConfigSidebarProps) {
  const totalClusters = totalClusterCount(addedConfigs) + totalClusterCount(systemConfigs);

  const renderConfigRow = (key: string, details: ClustersDetails) => (
    <button
      key={key}
      type="button"
      onClick={() => onSelect(key)}
      data-active={selectedConfig === key}
      className={cn(
        'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
        activeBar,
        selectedConfig === key && 'bg-accent'
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono font-medium" title={key}>{key}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{Object.keys(details.clusters).length}</span>
      </div>
      <span className="w-full truncate font-mono text-xs text-muted-foreground" title={details.absolutePath}>
        {details.absolutePath}
      </span>
    </button>
  );

  return (
    // No flex-1: the card sizes to its content (flex-grow 0) but still
    // shrinks and scrolls internally when the config list outgrows the
    // viewport, so "Add config" sits right under the last row.
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="flex-1 space-y-4 overflow-auto p-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          data-active={selectedConfig === null}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent',
            activeBar,
            selectedConfig === null && 'bg-accent'
          )}
        >
          <span>All clusters</span>
          <span className="text-xs text-muted-foreground">{totalClusters}</span>
        </button>

        {Object.keys(systemConfigs).length > 0 && (
          <div className="space-y-1">
            <SectionLabel icon={Settings} label="System Configs" />
            {Object.entries(systemConfigs).map(([key, details]) => renderConfigRow(key, details))}
          </div>
        )}

        {Object.keys(addedConfigs).length > 0 && (
          <div className="space-y-1">
            <SectionLabel icon={FolderPlus} label="Added Configs" />
            {Object.entries(addedConfigs).map(([key, details]) => renderConfigRow(key, details))}
          </div>
        )}
      </div>

    </div>
  );
}
