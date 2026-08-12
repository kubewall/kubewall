import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { PodContainer } from "@/types";
import { memo } from "react";

type PodContainersCellProps = {
  cellValue: string;
  containers: PodContainer[];
};

// Same grid on the header and every row, so the status column lines up while
// container names take whatever width is left.
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2';

const PENDING_STATUSES = new Set([
  'Pending',
  'Waiting',
  'ContainerCreating',
  'PodInitializing',
  'Terminating'
]);

const statusColors = ({ status, ready }: PodContainer) => {
  if (status === 'Running') {
    return ready
      ? { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
      : { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  }
  if (status === 'Completed') {
    return { dot: 'bg-gray-400', text: 'text-gray-500 dark:text-gray-400' };
  }
  if (PENDING_STATUSES.has(status)) {
    return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  }
  return { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
};

const PodContainersCell = memo(function ({ cellValue, containers }: PodContainersCellProps) {
  const valueArray = cellValue.split('/');
  const isReady = valueArray[0] === valueArray[1];

  return (
    <HoverCard openDelay={70} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          className={`text-sm truncate px-3 cursor-pointer underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 ${isReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {cellValue}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="center" side="right" sideOffset={6} className="w-[292px] p-0">
        <div className={`${ROW_GRID} border-b px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
          <span className="truncate">Containers ({containers.length})</span>
          <span className="truncate text-right">Status</span>
        </div>
        <div className="max-h-[248px] overflow-y-auto py-1">
          {containers.map((container) => {
            const { dot, text } = statusColors(container);
            return (
              <div key={container.name} className={`${ROW_GRID} px-2.5 py-[3px] hover:bg-muted/50`}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                  <span className="truncate text-xs" title={container.name}>{container.name}</span>
                  {container.init && (
                    <span className="shrink-0 rounded-sm border px-1 text-[9px] uppercase leading-[14px] text-muted-foreground">init</span>
                  )}
                  {container.restarts > 0 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-amber-600 dark:text-amber-400" title={`${container.restarts} restarts`}>↻{container.restarts}</span>
                  )}
                </div>
                <span className={`truncate text-right text-[11px] ${text}`} title={container.status}>{container.status}</span>
              </div>
            );
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

export {
  PodContainersCell
};
