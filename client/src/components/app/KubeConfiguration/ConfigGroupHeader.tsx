import { Badge } from '@/components/ui/badge';
import { FileBox } from 'lucide-react';
import { DeleteConfiguration } from './DeleteConfiguration';
import { SystemConfigIndicator } from './SystemConfigIndicator';
import { ConfigGroup, clusterCountLabel } from './types';

// Inner content of a per-kubeconfig group header: name, System/Added pill,
// cluster count, and the file path right-aligned with its lock/delete action.
// Rendered bare (card view lays it directly on the page) or inside a table
// cell — the wrapper differs, the content doesn't.
export function ConfigGroupHeader({ configKey, details, isSystem }: ConfigGroup) {
  const clusters = Object.values(details.clusters);
  const connectedCount = clusters.filter((c) => c.connected).length;

  return (
    <div className="flex items-center justify-between gap-3">
      {/* `items-baseline` so the name (text-sm) and the count (text-xs) share a
          baseline — `items-center` centres each box instead, which leaves the
          smaller text visibly off. The icon and pill are boxes rather than
          running text, so they opt back out with `self-center`. */}
      <div className="flex min-w-0 items-baseline gap-2">
        <FileBox className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
        <span className="truncate font-mono text-sm font-medium" title={configKey}>{configKey}</span>
        <Badge
          variant="outline"
          className="shrink-0 self-center px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {isSystem ? 'System' : 'Added'}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">
          {clusterCountLabel(clusters.length)}
          {connectedCount > 0 && (
            <>
              {' · '}
              <span className="font-medium text-green-600 dark:text-green-500">
                {connectedCount} connected
              </span>
            </>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="hidden max-w-[22rem] truncate font-mono text-xs text-muted-foreground lg:inline"
          title={details.absolutePath}
        >
          {details.absolutePath}
        </span>
        {isSystem ? <SystemConfigIndicator /> : <DeleteConfiguration configId={configKey} />}
      </div>
    </div>
  );
}
