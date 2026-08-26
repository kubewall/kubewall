import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { ClusterEOLBadge, ClusterTagBadge, eolEnabled, tagsEnabled } from '../clusterAddonSlots';

import { ClusterAvatar } from '../ClusterAvatar';
import { ClusterStatus } from '../ClusterStatus';
import { ConfigGroup } from '../types';
import { ConfigGroupHeader } from '../ConfigGroupHeader';
import { TruncatedText } from '../TruncatedText';

type ConfigCardsProps = {
  groups: ConfigGroup[];
  onNavigate: (config: string, name: string) => void;
};

export function ConfigCards({ groups, onNavigate }: ConfigCardsProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    // Owns its own scrolling now that the shared wrapper doesn't (see ConfigSection).
    <div className="max-h-full space-y-6 overflow-auto">
      {groups.map((group) => (
        <div key={group.configKey} className="space-y-3">
          {/* Config File Header — laid directly on the page, no container box,
              separated from its cards by a full-width rule. `group/item` is
              required for DeleteConfiguration's hover-revealed icon (the table
              view gets it from its <TableRow>). */}
          <div className="group/item border-b px-1 pb-2">
            <ConfigGroupHeader {...group} />
          </div>

          {/* Cluster Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.keys(group.details.clusters).map((key) => {
              const { name, namespace, connected } = group.details.clusters[key];
              return (
                <Card key={name} className="flex flex-col bg-muted/30 shadow-none">
                  <CardHeader className="flex-1 flex-row items-start justify-between gap-2 space-y-0 p-4 pb-3">
                    {/* `group/link` ties the icon and name hover states together. */}
                    <div className="group/link flex min-w-0 flex-1 items-center gap-3">
                      {/* Same navigation target as the name. Kept out of the tab
                          order and the a11y tree so the pair is one stop,
                          announced once, rather than two identical links. */}
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden
                        onClick={() => onNavigate(group.configKey, name)}
                        className="shrink-0 rounded-md transition-opacity group-hover/link:opacity-75"
                      >
                        <ClusterAvatar name={name} connected={connected} size="lg" />
                      </button>
                      <div className="min-w-0 flex-1">
                        {/* Only the name (and its icon) navigate — not the whole card. */}
                        <button
                          type="button"
                          onClick={() => onNavigate(group.configKey, name)}
                          className="block min-w-0 max-w-full text-left"
                        >
                          <TruncatedText value={name} className="block truncate text-base font-semibold leading-none group-hover/link:underline" />
                        </button>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="min-w-0 max-w-full truncate" title={namespace || 'N/A'}>ns: {namespace || 'N/A'}</span>
                          {eolEnabled && ClusterEOLBadge && (
                            <>
                              <span className="shrink-0">·</span>
                              <ClusterEOLBadge configName={group.configKey} clusterName={name} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <ClusterStatus connected={connected} />
                    </div>
                  </CardHeader>
                  {tagsEnabled && ClusterTagBadge && (
                    <CardFooter className="border-t px-4 py-3">
                      <ClusterTagBadge configName={group.configKey} clusterName={name} layout="footer" />
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
