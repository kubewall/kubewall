import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createEventStreamQueryObject, defaultOrValue, getEventStreamUrl } from "@/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { PORT_FORWARDING_ENDPOINT } from "@/constants";
import { PortForwardingListResponse } from "@/types";
import { memo } from "react";
import { updatePortForwardingList } from "@/data/Workloads/Pods/PortForwardingListSlice";
import { useEventSource } from "../Common/Hooks/EventSource";
import { useRouterState } from "@tanstack/react-router";

const ServiceDetailsContainer = memo(function () {
  const {
    serviceDetails: {
      spec: {
        ports
      }
    }
  } = useAppSelector((state) => state.serviceDetails);
  const dispatch = useAppDispatch();
  const router = useRouterState();
  const pathname = router.location.pathname;
  const configName = pathname.split('/')[1];
  const queryParams = new URLSearchParams(router.location.search);
  const clusterName = queryParams.get('cluster') || '';
  const sendMessage = (message: PortForwardingListResponse[]) => {
    dispatch(updatePortForwardingList(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      PORT_FORWARDING_ENDPOINT,
      createEventStreamQueryObject(
        configName,
        clusterName
      )),
    sendMessage
  });

  return (
    <div className="mt-2">
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium">Ports</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start justify-center gap-6 rounded-lg grid-cols-2 sm:grid">
            {
              ports?.map((item, index) => {
                return (
                  item ?
                    <div key={index} className="grid items-start">
                      <Card className="shadow-none rounded-lg border-dashed">
                        <CardContent className="boder p-0">
                          {
                            Object.keys(item).map((key: string) => {
                              return (
                                <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                                  <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">{key}</div>
                                  <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                                    <div className="break-all basis-[97%] ">
                                      {defaultOrValue(item[key as keyof typeof item] ?? '')}
                                    </div>
                                    <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                      <CopyToClipboard val={defaultOrValue(item[key as keyof typeof item])} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          }
                        </CardContent>
                      </Card>
                    </div>
                    : <></>
                );
              })
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export {
  ServiceDetailsContainer
};