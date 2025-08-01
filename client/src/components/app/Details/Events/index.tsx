import './index.css';

import { Event } from "@/types";
import { createEventStreamQueryObject, getEventStreamUrl } from "@/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { updateEventsDetails, resetJobDetails } from "@/data/Events/EventsSlice";
import { useEventSource } from "../../Common/Hooks/EventSource";
import { DataTable } from "@/components/app/Table";
import { eventsColumns } from "./columns";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type EventsProps = {
  instanceType: string;
  name: string;
  namespace?: string;
  configName: string;
  clusterName: string;
  extraQuery?: string;
}

export function Events({ instanceType, name, namespace, configName, clusterName, extraQuery }: EventsProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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

  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  useEventSource({
    url: getEventStreamUrl(
      instanceType,
      createEventStreamQueryObject(
        configName,
        clusterName,
        namespace
      ),
      // For namespace-scoped resources, include namespace in path
      (instanceType === 'deployments' || instanceType === 'daemonsets' || instanceType === 'statefulsets' || instanceType === 'replicasets' || instanceType === 'jobs' || instanceType === 'cronjobs' || instanceType === 'services' || instanceType === 'configmaps' || instanceType === 'secrets' || instanceType === 'horizontalpodautoscalers' || instanceType === 'limitranges' || instanceType === 'resourcequotas' || instanceType === 'serviceaccounts' || instanceType === 'roles' || instanceType === 'rolebindings' || instanceType === 'persistentvolumeclaims' || instanceType === 'poddisruptionbudgets' || instanceType === 'endpoints' || instanceType === 'ingresses' || instanceType === 'leases') ? `/${namespace}/${name}/events` : `/${name}/events`,
      extraQuery
    ),
    sendMessage,
    onConfigError: handleConfigError,
  });

  return (
    <DataTable
      columns={eventsColumns({count:events.length,clusterName,configName,loading, instanceType: 'events'})}
      data={events}
      showToolbar={false}
      tableWidthCss="event-table-max-height rounded-lg"
      instanceType='events'
      showNamespaceFilter={false}
      isEventTable={true}
    />
  );
}
