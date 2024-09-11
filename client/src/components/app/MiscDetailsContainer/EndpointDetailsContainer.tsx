import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { CubeIcon } from "@radix-ui/react-icons";
import { defaultOrValueObject } from "@/utils";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const EndpointDetailsContainer = memo(function () {
  const {
    endpointDetails: {
      subsets
    }
  } = useAppSelector((state) => state.endpointDetails);

  return (
    subsets ?
      <div className="mt-4">
        <Card className="shadow-none rounded-lg" >
          <CardHeader className="p-4 ">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="items-start justify-center gap-6 rounded-lg grid-cols-1 sm:grid">
              {
                subsets.map((item, index) => {
                  return (
                    item ?
                      Object.keys(item).map((key) => {
                        return (
                          <div key={index} className="grid items-start">
                            <Card className="shadow-none rounded-lg">
                              <CardHeader className="p-5">
                                <CardTitle className="flex items-center justify-between">
                                  <div className="flex flex-1 items-center">
                                    <CubeIcon className="mr-2 h-3.5 w-3.5" />
                                    <div className="text-sm font-normal basis-2/3 break-all">{key}</div>
                                  </div>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="boder p-0 px-4 pb-4">
                                <div className="items-start justify-center gap-6 rounded-lg grid-cols-2 sm:grid">
                                  {
                                    item[key as keyof typeof item]?.map((subkey) => {
                                      return (
                                        <Card className="shadow-none rounded-lg border-dashed" >
                                          <CardContent className="boder p-0">
                                            {
                                              subkey && Object.keys(subkey).map((sskey: keyof typeof subkey) => {
                                                return (
                                                  <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                                                    <div className="pl-4 text-sm font-medium text-muted-foreground basis-1/3">{sskey}</div>
                                                    <div className="flex flex-row text-sm font-normal basis-2/3 group/item">
                                                      <div className="break-all basis-[97%] ">
                                                        {defaultOrValueObject(subkey[sskey])}
                                                      </div>
                                                      <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                                                        <CopyToClipboard val={defaultOrValueObject(subkey[sskey])} />
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            }
                                          </CardContent>
                                        </Card>
                                      );
                                    })
                                  }
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })
                      : <></>
                  );
                })
              }
            </div>
          </CardContent>
        </Card >
      </div > :
      <></>

  );
});

export {
  EndpointDetailsContainer
};