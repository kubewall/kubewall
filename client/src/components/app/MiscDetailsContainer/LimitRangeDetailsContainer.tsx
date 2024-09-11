import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { CubeIcon } from "@radix-ui/react-icons";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const LimitRangeDetailsContainer = memo(function (){
  const {
    limitRangeDetails: {
      spec : {
        limits
      }
    }
  } = useAppSelector((state) => state.limitRangeDetails);

  const convertObjectToString = (specLimits: object | undefined | null) => {
    return specLimits ? Object.entries(specLimits).map(([key, value]) => `${key}=${value}`).join(', ') : '—';
  };
  return (
    <div className="mt-4">
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium">Limits <span className="text-xs">({limits.length})</span></CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start justify-center gap-6 rounded-lg grid-cols-2 sm:grid">
            {
              limits.map((limit) => {
                return (
                  <div key={limit?.type} className="grid items-start">
                    <Card className="shadow-none rounded-lg border-dashed">
                      <CardHeader className="p-5">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex flex-1 items-center">
                            <CubeIcon className="mr-2 h-3.5 w-3.5" />
                            <div className="text-sm font-normal basis-2/3 break-all">{limit?.type}</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="boder p-0">
                        <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Max</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                             {
                              convertObjectToString(limit?.max)
                             }
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={convertObjectToString(limit?.max)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Min</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {
                              convertObjectToString(limit?.min)
                             }
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={convertObjectToString(limit?.min)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Default</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {
                              convertObjectToString(limit?.default)
                             }
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={convertObjectToString(limit?.default)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Default Request</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {
                              convertObjectToString(limit?.defaultRequest)
                             }
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={convertObjectToString(limit?.defaultRequest)}/>
                            </div>
                          </div>
                        </div>
                        <div className="py-1.5  border-b border-dashed flex flex-row">
                          <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">Max Limit Request Ratio</div>
                          <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                            <div className="break-all basis-[97%] ">
                            {
                              convertObjectToString(limit?.maxLimitRequestRatio)
                             }
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard val={convertObjectToString(limit?.maxLimitRequestRatio)}/>
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
  LimitRangeDetailsContainer
};