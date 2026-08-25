import { cn } from '@/lib/utils';

// Dot + label status indicator, shared by the table and card views so both
// read identically. Only two states exist in the data (`connected: boolean`).
// Connected is a filled green dot with green text; disconnected is a hollow
// ring in muted grey, so the two are distinguishable by shape as well as hue.
export function ClusterStatus({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          connected ? 'bg-green-500' : 'border border-muted-foreground/50'
        )}
      />
      <span
        className={cn(
          'truncate text-xs',
          connected ? 'font-medium text-green-600 dark:text-green-500' : 'text-muted-foreground'
        )}
      >
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </span>
  );
}
