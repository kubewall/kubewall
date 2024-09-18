import './index.css';

import { createEventStreamQueryObject, getEventStreamUrl } from "@/utils";
import { resetJobDetails, updateEventsDetails } from "@/data/Events/EventsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { DataTable } from "@/components/app/Table";
import { eventsColumns } from "./columns";
import { useEffect } from "react";
import { useEventSource } from "../../Common/Hooks/EventSource";

type EventsProps = {
  name: string;
  instanceType: string;
  namespace: string;
  configName: string;
  clusterName: string;
  extraQuery?: string;
}

export function Events({ instanceType, name, namespace, configName, clusterName, extraQuery }: EventsProps) {
  const dispatch = useAppDispatch();
  const {
    loading,
    events,
  } = useAppSelector((state) => state.events);

  useEffect(() => {
    return () => {
      dispatch(resetJobDetails());
    };
  }, [dispatch]);


  const sendMessage = (message: Event[]) => {
    dispatch(updateEventsDetails(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      instanceType,
      createEventStreamQueryObject(
        configName,
        clusterName,
        namespace
      ),
      `/${name}/events`,
      extraQuery
    ),
    sendMessage
  });


  return (
    <DataTable
      columns={eventsColumns({count:events.length,clusterName,configName,loading, instanceType: 'events'})}
      data={events}
      showToolbar={false}
      tableWidthCss="event-table-max-height rounded-lg"
      showNamespaceFilter={false}
      isEventTable={true}
    />
  );
}
