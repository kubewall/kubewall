import { ClusterEOLBadge, ClusterTagBadge, eolEnabled, tagsEnabled } from '../clusterAddonSlots';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { ClusterStatus } from '../ClusterStatus';
import { ConfigGroup } from '../types';
import { ConfigGroupHeader } from '../ConfigGroupHeader';
import { Fragment } from 'react';
import { TruncatedText } from '../TruncatedText';

// Cluster + Status, plus the optional addon columns.
const totalColumnCount = 2 + Number(eolEnabled) + Number(tagsEnabled);

// Applied per-<th> rather than to <thead>: the header must paint over the rows
// scrolling beneath it (bg + z), and its divider has to live on the cells.
// The divider is an inset shadow, not `border-b`: the table uses
// `border-collapse: collapse`, where cell borders are painted on the table's
// static border grid and so stay behind when the cell sticks. A shadow is
// painted by the cell itself, so it travels with the pinned header and reads
// as one solid unit while scrolling.
const stickyHead =
  'sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide shadow-[inset_0_-1px_0_0_hsl(var(--border))]';

type ConfigSectionProps = {
  groups: ConfigGroup[];
  onNavigate: (config: string, name: string) => void;
};

export function ConfigSection({ groups, onNavigate }: ConfigSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    // This card IS the scroll container (`overflow-auto`, bounded by
    // `max-h-full` from the flex parent): it clips the sticky header's
    // background to the rounded corners — plain `overflow-hidden` would clip
    // but never scroll, so the header would pin inside a box that doesn't move
    // — and it keeps the card's frame fixed while only the rows scroll inside.
    <div className="max-h-full overflow-auto rounded-xl border bg-background">
      <Table className="table-fixed">
        <colgroup>
          {/* Cluster takes whatever the fixed-width columns leave behind. */}
          <col />
          {eolEnabled && <col className="w-[18%]" />}
          <col className="w-[18%]" />
          {tagsEnabled && <col className="w-[26%]" />}
        </colgroup>
        {/* Drops TableHeader's own `[&_tr]:border-b`. That line sits on the <tr>,
            which doesn't stick, so it would stay put and read as the first row's
            top border; the cells' inset shadow replaces it. Overridden at the
            same variant so twMerge resolves the conflict — a plain `border-b-0`
            on the <tr> loses to the more specific descendant selector. */}
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className={stickyHead}>Cluster</TableHead>
            {eolEnabled && <TableHead className={stickyHead}>Version</TableHead>}
            <TableHead className={stickyHead}>Status</TableHead>
            {tagsEnabled && <TableHead className={stickyHead}>Tags</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, index) => (
            <Fragment key={group.configKey + index}>
              {/* Config File Header Row */}
              <TableRow className="group/item hover:bg-transparent">
                <TableCell colSpan={totalColumnCount} className="bg-muted/40 py-2">
                  <ConfigGroupHeader {...group} />
                </TableCell>
              </TableRow>

              {/* Cluster Rows */}
              {Object.keys(group.details.clusters).map((key) => {
                const { name, namespace, connected } = group.details.clusters[key];
                return (
                  // `group/item` stays — ClusterTagBadge's edit pencil is revealed on row hover.
                  <TableRow className="group/item" key={name}>
                    <TableCell>
                      {/* Inner flex wrapper — putting `flex` on the <td> itself
                          breaks table-fixed column sizing. */}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary text-xs font-medium text-secondary">
                          {name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {/* Only the name navigates — not the whole row. */}
                          <button
                            type="button"
                            onClick={() => onNavigate(group.configKey, name)}
                            className="block min-w-0 max-w-full text-left"
                          >
                            <TruncatedText value={name} className="block truncate font-medium hover:underline" />
                          </button>
                          <span className="block truncate text-xs text-muted-foreground">ns: {namespace || 'N/A'}</span>
                        </div>
                      </div>
                    </TableCell>
                    {eolEnabled && ClusterEOLBadge && (
                      <TableCell>
                        <ClusterEOLBadge configName={group.configKey} clusterName={name} />
                      </TableCell>
                    )}
                    <TableCell>
                      <ClusterStatus connected={connected} />
                    </TableCell>
                    {tagsEnabled && ClusterTagBadge && (
                      <TableCell>
                        <ClusterTagBadge configName={group.configKey} clusterName={name} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
