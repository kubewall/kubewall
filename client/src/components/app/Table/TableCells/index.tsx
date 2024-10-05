import { CONFIG_MAPS_ENDPOINT, CUSTOM_RESOURCES_LIST_ENDPOINT, ENDPOINTS_ENDPOINT, HPA_ENDPOINT, INGRESSES_ENDPOINT, NODES_ENDPOINT, ROLE_BINDINGS_ENDPOINT, SECRETS_ENDPOINT, SERVICES_ENDPOINT } from '@/constants';

import { ClusterDetails } from '@/types';
import { ConditionCell } from './conditionCell';
import { CurrentByDesiredCell } from './currentByDesiredCell';
import { DefaultCell } from './defaultCell';
import { IndeterminateCheckbox } from './selectCell';
import { MultiValueCell } from './multiValueCell';
import { NameCell } from './nameCell';
import { Row } from '@tanstack/react-table';
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
  row
}: TableCellType<T>) => {
  if (loading) {
    return <Skeleton className="h-4" />;
  }
  if (type === 'Select') {
    return (<div className="pl-2">
      <IndeterminateCheckbox
        {...{
          checked: row.getIsSelected(),
          disabled: !row.getCanSelect(),
          onClick: row.getToggleSelectedHandler(),
        }}
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
    if (instanceType !== CUSTOM_RESOURCES_LIST_ENDPOINT) {
      defaultQueryParams.cluster = clusterName;
      link = `${configName}/details?${toQueryParams(defaultQueryParams)}`;
    } else {
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
    (type === 'Rules' || type === 'Ports' || type === 'Bindings' || type === 'Roles' || type === 'Keys') &&
    (
      instanceType === INGRESSES_ENDPOINT ||
      instanceType === ENDPOINTS_ENDPOINT ||
      instanceType === SERVICES_ENDPOINT ||
      instanceType === ROLE_BINDINGS_ENDPOINT ||
      instanceType === NODES_ENDPOINT ||
      instanceType === SECRETS_ENDPOINT ||
      instanceType === CONFIG_MAPS_ENDPOINT
    )
  ) {
    return <MultiValueCell cellValue={value} />;
  }
  return <DefaultCell cellValue={value === '' ? '—' : value} />;
};

export {
  TableCells
};
