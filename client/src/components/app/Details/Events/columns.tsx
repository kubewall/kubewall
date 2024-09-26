import { Event, HeaderList, TableColumns } from "@/types";

import GenerateColumns from '../../Common/Hooks/TableColumns';

export function eventsColumns({ count, clusterName, configName, loading, instanceType }: TableColumns) {

  const headersList: HeaderList[] = [
    {
      title: 'Reason',
      accessorKey: 'reason',
    },
    {
      title: 'Message',
      accessorKey: 'message',
    },
    {
      title: 'Type',
      accessorKey: 'type',
    },
    {
      title: 'Action',
      accessorKey: 'action',
    },
    {
      title: 'Reporting Component',
      accessorKey: 'reportingComponent',
    },
    {
      title: 'Reporting Instance',
      accessorKey: 'reportingInstance',
    },
    {
      title: 'Event Time',
      accessorKey: 'eventTime',
    },
  ];

  return GenerateColumns<Event, HeaderList>({
    count,
    clusterName,
    configName, 
    instanceType,
    loading,
    headersList,
  });
}
