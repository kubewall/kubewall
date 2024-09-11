import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { CubeIcon } from "@radix-ui/react-icons";
import { defaultOrValue } from "@/utils";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const ResourceQuotaDetailsContainer = memo(function () {
  const {
    resourceQuotaDetails: {
      status: {
        hard,
        used
      }
    }
  } = useAppSelector((state) => state.resourceQuotaDetails);
  return (
    <div className="mt-4">
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start justify-center gap-6 rounded-lg grid-cols-2 sm:grid">
            {
              [hard, used].map((item, index) => {
                return (
                  item ?
                    <div key={index} className="grid items-start">
                      <Card className="shadow-none rounded-lg border-dashed">
                      <CardHeader className="p-5">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex flex-1 items-center">
                            <CubeIcon className="mr-2 h-3.5 w-3.5" />
                            <div className="text-sm font-normal basis-2/3 break-all">{index === 0 ? 'Hard' : 'Used'}</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                        <CardContent className="boder p-0">
                          {
                            Object.keys(item).map((key: string) => {
                              return (
                                <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                                  <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">{key}</div>
                                  <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                                    <div className="break-all basis-[97%] ">
                                      {defaultOrValue(item[key])}
                                    </div>
                                    <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                      <CopyToClipboard val={defaultOrValue(item[key])} />
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
  ResourceQuotaDetailsContainer
};