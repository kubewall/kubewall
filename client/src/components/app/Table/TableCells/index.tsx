import { CUSTOM_RESOURCES_ENDPOINT, CUSTOM_RESOURCES_LIST_ENDPOINT, ENDPOINTS_ENDPOINT, HPA_ENDPOINT, INGRESSES_ENDPOINT, NODES_ENDPOINT, ROLE_BINDINGS_ENDPOINT, SECRETS_ENDPOINT, SERVICES_ENDPOINT } from '@/constants';
import { Row, Table } from '@tanstack/react-table';

import { ClusterDetails } from '@/types';
import { ConditionCell } from './conditionCell';
import { CurrentByDesiredCell } from './currentByDesiredCell';
import { DefaultCell } from './defaultCell';
import { IndeterminateCheckbox } from './selectCell';
import { MultiValueCell } from './multiValueCell';
import { NameCell } from './nameCell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusCell } from './statusCell';
import { TimeCell } from './timeCell';
import { toQueryParams } from '@/utils';

type TableCellType<T> = {
  type: string;
  value: string;
  namespace: string;
  instanceType: string;
  loading: boolean;
  row: Row<T>;
  table: Table<T>;
  queryParams?: string;
} & ClusterDetails;

const TableCells = <T extends ClusterDetails>({
  clusterName,
  configName,
  instanceType,
  loading,
  namespace,
  type,
  value,
  queryParams,
  row,
  table,
}: TableCellType<T>) => {

  // TODO: remove usage of window
  const lastSelectedRow = window.lastSelectedRow;
  const handleRowClick = (row: Row<T>, event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    const { id } = row;
    const isShiftKey = event.shiftKey;

    // If Shift key is pressed, select a range of rows
    if (isShiftKey && lastSelectedRow) {
      const lastSelectedIndex = table.getRowModel().rows.findIndex((r) => r.id === lastSelectedRow);
      const currentIndex = table.getRowModel().rows.findIndex((r) => r.id === id);

      // Ensure selection is in the correct order (min, max)
      const rangeStart = Math.min(lastSelectedIndex, currentIndex);
      const rangeEnd = Math.max(lastSelectedIndex, currentIndex);
      if(rangeStart === rangeEnd) {
        row.getToggleSelectedHandler()(event);
      }
      // Select all rows in the range while preserving the first selected row
      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (table.getRowModel().rows[i].id !== lastSelectedRow) {
          table.getRowModel().rows[i].getToggleSelectedHandler()(event); // Call the toggleSelectedHandler for each row in the range
        }
      }
    } else {
      // Regular row click (no Shift key), toggle the selected state of the clicked row
      row.getToggleSelectedHandler()(event);
    }

    // Update the last selected row to the current row
    window.lastSelectedRow = id;
  };

  if (loading) {
    return <Skeleton className="h-4" />;
  }
  if (type === 'Select') {
    return (<div className="pl-2">
      <IndeterminateCheckbox
        {...{
          checked: row.getIsSelected(),
          disabled: !row.getCanSelect(),
        }}
        onClick={(event) => handleRowClick(row, event)}
      />
    </div>);
  }
  if (value === undefined || value === 'undefined' || value === '') {
    return <DefaultCell cellValue='—' />;
  }

  if (type === 'Conditions') {
    return <ConditionCell cellValue={value} />;
  }
  if (type === 'Age' || type === 'Duration' || type === 'eventTime' || type === 'firstTimestamp' || type === 'lastTimestamp' || type === 'Last Restart' ) {
    return <TimeCell cellValue={value} />;
  }
  if (type === 'Ready' || type === 'Current') {
    return <CurrentByDesiredCell cellValue={value} />;
  }
  if (type === 'Status' || type === 'reason' || type === 'Condition Status') {
    return <StatusCell cellValue={value} />;
  }
  if (type === 'Name') {
    let link = '';
    const defaultQueryParams: Record<string,string> = {
      resourcekind: instanceType.toLowerCase(),
      resourcename: value,
      ...(namespace ? {namespace:namespace} :  {})
    };
    if (instanceType === CUSTOM_RESOURCES_ENDPOINT) {
      // From CRD Definitions list, navigate to the corresponding Custom Resources list
      const original: any = row.original as any;
      const group: string = original?.group || '';
      const version: string = original?.version || '';
      const kind: string = original?.resource || '';
      // Derive plural resource from CRD name (e.g., alertmanagers.monitoring.coreos.com)
      const resourcePlural: string = (original?.name?.split?.('.')?.[0]) || '';
      const listQueryParams: Record<string, string> = {
        resourcekind: CUSTOM_RESOURCES_LIST_ENDPOINT,
        cluster: clusterName,
        group,
        kind,
        resource: resourcePlural,
        version
      };
      link = `${configName}/list?${toQueryParams(listQueryParams)}`;
    } else if (instanceType !== CUSTOM_RESOURCES_LIST_ENDPOINT) {
      defaultQueryParams.cluster = clusterName;
      link = `${configName}/details?${toQueryParams(defaultQueryParams)}`;
    } else {
      // For custom resources list, ensure cluster param is included in details route
      defaultQueryParams.cluster = clusterName;
      link = `${configName}/details?${toQueryParams(defaultQueryParams)}&${queryParams}`;
    }
    return <NameCell
      cellValue={value}
      link={link}
    />;
  }
  if (instanceType === 'events' || instanceType === HPA_ENDPOINT) {
    const eventsValue = value ?? '—';
    return <DefaultCell cellValue={eventsValue} truncate={false} />;
  }
  if (
    value !== '' &&
    (type === 'Rules' || type === 'Ports' || type === 'Bindings' || type === 'Roles' || type === 'Keys' || type === 'External IP') &&
    (
      instanceType === INGRESSES_ENDPOINT ||
      instanceType === ENDPOINTS_ENDPOINT ||
      instanceType === SERVICES_ENDPOINT ||
      instanceType === ROLE_BINDINGS_ENDPOINT ||
      instanceType === NODES_ENDPOINT ||
      instanceType === SECRETS_ENDPOINT
    )
  ) {
    return <MultiValueCell cellValue={value} />;
  }
  return <DefaultCell cellValue={value === '' ? '—' : value} />;
};

export {
  TableCells
};
