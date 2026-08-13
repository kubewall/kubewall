import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';

import { Badge } from '@/components/ui/badge';
import { ClustersDetails } from '@/types';
import { DeleteConfiguration } from '../DeleteConfiguration';
import { FileBox } from "lucide-react";
import { Fragment } from 'react';
import { SystemConfigIndicator } from '../SystemConfigIndicator';
import addons from '@/addons';
import capabilities from '@/capabilities';

const ClusterEOLBadge = addons.kubeEndOfLife?.ClusterEOLBadge ?? null;
const eolEnabled = !!capabilities.kubeEndOfLife?.enabled && !!ClusterEOLBadge;

type ConfigSectionProps = {
  title: string;
  subtitle?: string;
  configs: { [key: string]: ClustersDetails };
  isSystem: boolean;
  onNavigate: (config: string, name: string) => void;
};

export function ConfigSection({ title, subtitle, configs, isSystem, onNavigate }: ConfigSectionProps) {
  const configKeys = Object.keys(configs);

  if (configKeys.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
        <span className="text-sm font-medium">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>

      {/* Table */}
      <Table className="table-fixed">
        <colgroup>
          <col className={eolEnabled ? 'w-[40%]' : 'w-[60%]'} />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          {eolEnabled && <col className="w-[20%]" />}
        </colgroup>
        <TableBody>
          {configKeys.map((config, index) => (
            <Fragment key={config + index}>
              {/* Config File Row */}
              <TableRow className="group/item">
                <TableCell colSpan={eolEnabled ? 4 : 3} className="bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <FileBox className="h-4 w-4 text-muted-foreground" />
                      <span>{config}</span>
                    </div>
                    {isSystem ? (
                      <SystemConfigIndicator />
                    ) : (
                      <DeleteConfiguration configId={config} />
                    )}
                  </div>
                </TableCell>
              </TableRow>

              {/* Column Header Row */}
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Status</TableHead>
                {eolEnabled && <TableHead>Version</TableHead>}
              </TableRow>

              {/* Cluster Rows */}
              {Object.keys(configs[config].clusters).map((key) => {
                const { name, namespace, connected } = configs[config].clusters[key];
                return (
                  <TableRow
                    className="group/item hover:cursor-pointer hover:bg-muted/50"
                    onClick={() => onNavigate(config, name)}
                    key={name}
                  >
                    <TableCell className="flex min-w-0 items-center space-x-3">
                      <div className="flex w-12 flex-shrink-0 items-center justify-center bg-primary rounded-md text-sm font-medium text-secondary">
                        {name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="min-w-0 truncate font-normal" title={name}>{name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block truncate" title={namespace || 'N/A'}>{namespace || 'N/A'}</span>
                    </TableCell>
                    <TableCell className="flex">
                      {connected ?
                        <Badge className="min-w-0 max-w-full truncate block" variant="default">Active</Badge> :
                        <Badge className="min-w-0 max-w-full truncate block" variant="outline">Inactive</Badge>
                      }
                    </TableCell>
                    {eolEnabled && ClusterEOLBadge && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ClusterEOLBadge configName={config} clusterName={name} />
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
