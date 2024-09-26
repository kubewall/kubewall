import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { defaultOrValue } from "@/utils";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const NodeDetailsContainer = memo(function () {
  const {
    nodeDetails: {
      status: {
        conditions,
        images
      }
    }
  } = useAppSelector((state) => state.nodeDetails);

  return (
    <div className="mt-4">
      {
        images && <Card className="shadow-none rounded-lg">
          <CardHeader className="p-4 ">
            <CardTitle className="text-sm font-medium">Images <span className="text-xs">({images?.length})</span></CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="items-start gap-6 rounded-lg grid">
              {
                images?.map((image) => {
                  return (
                    <div key={image?.sizeBytes} className="grid items-start">
                      <Card className="shadow-none rounded-lg border-dashed">
                        {/* <CardHeader className="p-5">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex flex-1 items-center">
                            <div className="text-sm font-normal basis-2/3 break-all">{image?.type}</div>
                          </div>
                        </CardTitle>
                      </CardHeader> */}
                        <CardContent className="boder p-0">
                          <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                            <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Size</div>
                            <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                              <div className="break-all basis-[97%] ">
                                {defaultOrValue((Number(image?.sizeBytes)/1048576).toFixed(2))} MB
                              </div>
                              <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                <CopyToClipboard val={defaultOrValue((Number(image?.sizeBytes)/1048576).toFixed(2)) + ' MB'} />
                              </div>
                            </div>
                          </div>
                          {
                            image?.names?.map((imageName) => {
                              return (
                                <div className="py-1.5 border-b border-dashed flex flex-row">
                                  <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Image Name</div>
                                  <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                                    <div className="break-all basis-[97%] ">
                                      {
                                        defaultOrValue(imageName)
                                      }
                                    </div>
                                    <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                      <CopyToClipboard val={defaultOrValue(imageName)} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          }
                        </CardContent>
                      </Card>
                    </div>
                  );
                })
              }
            </div>
          </CardContent>
        </Card>
      }
      {
        conditions && <Card className="mt-4 shadow-none rounded-lg">
          <CardHeader className="p-4 ">
            <CardTitle className="text-sm font-medium">Conditions <span className="text-xs">({conditions?.length})</span></CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="items-start gap-6 rounded-lg lg:grid-cols-2 grid">
              {
                conditions?.map((condition) => {
                  return (
                    <div key={condition?.type} className="grid items-start">
                      <Card className="shadow-none rounded-lg border-dashed">
                        <CardHeader className="p-5">
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex flex-1 items-center">
                              {/* <CubeIcon className="mr-2 h-3.5 w-3.5" /> */}
                              <div className="text-sm font-normal basis-2/3 break-all">{condition?.type}</div>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="boder p-0">
                          <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                            <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Status</div>
                            <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                              <div className="break-all basis-[97%] ">
                                {defaultOrValue(condition?.status)}
                              </div>
                              <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                <CopyToClipboard val={defaultOrValue(condition?.status)} />
                              </div>
                            </div>
                          </div>
                          <div className="py-1.5  border-b border-dashed flex flex-row">
                            <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Last Heartbeat Time</div>
                            <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                              <div className="break-all basis-[97%] ">
                                {
                                  defaultOrValue(condition?.lastHeartbeatTime)
                                }
                              </div>
                              <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                <CopyToClipboard val={defaultOrValue(condition?.lastHeartbeatTime)} />
                              </div>
                            </div>
                          </div>
                          <div className="py-1.5  border-b border-dashed flex flex-row">
                            <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Last Transition Time</div>
                            <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                              <div className="break-all basis-[97%] ">
                                {
                                  defaultOrValue(condition?.lastTransitionTime)
                                }
                              </div>
                              <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                <CopyToClipboard val={defaultOrValue(condition?.lastTransitionTime)} />
                              </div>
                            </div>
                          </div>
                          <div className="py-1.5  border-b border-dashed flex flex-row">
                            <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Reason</div>
                            <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                              <div className="break-all basis-[97%] ">
                                {
                                  defaultOrValue(condition?.reason)
                                }
                              </div>
                              <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                <CopyToClipboard val={defaultOrValue(condition?.reason)} />
                              </div>
                            </div>
                          </div>
                          <div className="py-1.5  border-b border-dashed flex flex-row">
                            <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Message</div>
                            <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                              <div className="break-all basis-[97%] ">
                                {
                                  defaultOrValue(condition?.message)
                                }
                              </div>
                              <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                <CopyToClipboard val={defaultOrValue(condition?.message)} />
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
      }

    </div>
  );
});

export {
  NodeDetailsContainer
};