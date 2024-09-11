import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createContainerData, defaultOrValue } from "@/utils";

import { Badge } from "@/components/ui/badge";
import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { CubeIcon } from "@radix-ui/react-icons";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const PodDetailsContainer = memo(function (){
  const {
    podDetails,
  } = useAppSelector((state) => state.podDetails);
  const containerCards = createContainerData(podDetails.spec, podDetails.status);
  return (
    <div className="mt-4">
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium">Containers <span className="text-xs">({containerCards.length})</span></CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start justify-center gap-6 rounded-lg grid-cols-1 lg:grid-cols-2 sm:grid">
            {
              containerCards.map(({ image, command, imageId, containerId, imagePullPolicy, lastRestart, name, ready, restartReason, restarts, started, terminationMessagePolicy }) => {
                return (
                  <div key={name} className="grid items-start">
                    <Card className="shadow-none rounded-lg border-dashed">
                      <CardHeader className="p-5">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex flex-1 items-center">
                            <CubeIcon className="mr-2 h-3.5 w-3.5" />
                            <div className="text-sm font-normal basis-2/3 break-all">{name}</div>
                          </div>
                          <div>
                            {
                              started ? <Badge variant="default">Started</Badge> : <Badge variant="destructive">Not Started</Badge>
                            }
                            {
                              ready ? <Badge className="ml-1" variant="secondary">Ready</Badge> : <Badge className="ml-1" variant="destructive">Not Ready</Badge>
                            }
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="boder p-0">
                        <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Image</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(image)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(image)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">ImageID</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(imageId)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(imageId)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Container Id</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(containerId)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(containerId)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Command</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(command)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(command)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Image Pull Policy</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(imagePullPolicy)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(imagePullPolicy)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Restarts</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(restarts)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(restarts)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Restart Reason</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(restartReason)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(restartReason)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Last Restart</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(lastRestart)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(lastRestart)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5 flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Termination Message Policy</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {defaultOrValue(terminationMessagePolicy)}
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={defaultOrValue(terminationMessagePolicy)}/>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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
  PodDetailsContainer
};