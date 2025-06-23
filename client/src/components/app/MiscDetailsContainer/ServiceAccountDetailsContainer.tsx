import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { defaultOrValueObject } from "@/utils";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const ServiceAccountDetailsContainer = memo(function () {
  const {
    serviceAccountDetails: {
      secrets
    }
  } = useAppSelector((state) => state.serviceAccountDetails);
  return (
    secrets &&
    <div className="mt-2">
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium">Secrets</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start justify-center gap-6 rounded-lg grid-cols-2 sm:grid">
            {
              secrets?.map((item, index) => {
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
                                      {defaultOrValueObject(item[key] ?? '')}
                                    </div>
                                    <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                      <CopyToClipboard val={defaultOrValueObject(item[key])} />
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
  ServiceAccountDetailsContainer
};