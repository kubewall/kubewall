import { cn } from '@/lib/utils';

// Dot + label status indicator, shared by the table and card views so both
// read identically. Only two states exist in the data (`connected: boolean`).
export function ClusterStatus({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', connected ? 'bg-green-500' : 'bg-muted-foreground/40')} />
      <span className="truncate text-xs text-muted-foreground">{connected ? 'Connected' : 'Disconnected'}</span>
    </span>
  );
}
