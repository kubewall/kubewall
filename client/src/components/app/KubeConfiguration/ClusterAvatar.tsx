import { cn } from '@/lib/utils';

// Initials tile for a cluster. Tinted by connection state — green when
// connected, neutral otherwise — so status reads at a glance from the left
// edge of the row as well as from the Status column.
export function ClusterAvatar({
  name,
  connected,
  size = 'sm',
}: {
  name: string;
  connected: boolean;
  size?: 'sm' | 'lg';
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md font-medium',
        size === 'lg' ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs',
        connected
          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}
