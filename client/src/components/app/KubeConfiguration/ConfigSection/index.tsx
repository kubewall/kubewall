import { Fragment } from 'react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ClustersDetails } from '@/types';
import { DeleteConfiguration } from '../DeleteConfiguration';
import { SystemConfigIndicator } from '../SystemConfigIndicator';
import { StatusCell } from '../../Table/TableCells/statusCell';
import { FileBox } from "lucide-react";

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
      <Table>
        <TableBody>
          {configKeys.map((config, index) => (
            <Fragment key={config + index}>
              {/* Config File Row */}
              <TableRow className="group/item">
                <TableCell colSpan={3} className="bg-muted/30">
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

              {/* Cluster Rows */}
              {Object.keys(configs[config].clusters).map((key) => {
                const { name, namespace, connected } = configs[config].clusters[key];
                return (
                  <TableRow
                    className="group/item hover:cursor-pointer hover:bg-muted/50"
                    onClick={() => onNavigate(config, name)}
                    key={name}
                  >
                    <TableCell className="flex items-center space-x-3">
                      <div className="flex w-12 flex-shrink-0 items-center justify-center bg-primary rounded-md text-sm font-medium text-secondary">
                        {name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-normal">{name}</span>
                    </TableCell>
                    <TableCell>
                      <span>{namespace || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      {connected ? <StatusCell cellValue='Active' /> : <StatusCell cellValue='InActive' />}
                    </TableCell>
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
