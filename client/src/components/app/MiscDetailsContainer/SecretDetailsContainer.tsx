import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EyeIcon, EyeOff } from "lucide-react";
import { memo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyToClipboard } from "../Common/CopyToClipboard";
import { useAppSelector } from "@/redux/hooks";

const SecretDetailsContainer = memo(function () {
  const {
    secretsDetails,
  } = useAppSelector((state) => state.secretsDetails);
  const [toggleSecretDecode, setToggleSecretDecode] = useState(false);
  const newData = secretsDetails.data;

  const getDecodeOrDefault = (secret: string) => {
    return secretsDetails.type === 'helm.sh/release.v1' ? secret : atob(secret);
  };

  return (
    <div className={`mt-4`}>
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium flex items-center shadow-none">
            Data
            <Button
              className="ml-1 h-3.5 w-3.5 shadow-none border-none"
              variant="outline"
              size="icon"
              onClick={() => setToggleSecretDecode(!toggleSecretDecode)}
            >
              {toggleSecretDecode ? <EyeIcon /> : <EyeOff />}
            </Button>

          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start gap-6 rounded-lg grid">
            <Card className="shadow-none rounded-lg border-dashed overflow-x-auto">
              <CardContent className="boder p-0 ">
                {
                  newData && Object.keys(newData).map((key: string) => {
                    return (
                      <div className="py-1.5 border-t border-b border-dashed flex flex-row">
                        <div className="pl-4 text-sm text-muted-foreground basis-1/4">{key}</div>
                        <div className="flex flex-row text-sm font-normal basis-3/4 group/item">
                          <div className="break-all basis-[97%] ">
                            <Badge variant="secondary" className="text-sm font-normal">

                              <span className={toggleSecretDecode ? 'whitespace-pre-line' : 'line-clamp-1'}>
                                {toggleSecretDecode ? getDecodeOrDefault(newData[key] || '') : newData[key]}
                              </span>
                            </Badge>
                          </div>
                          <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard
                              val={toggleSecretDecode ? getDecodeOrDefault(newData[key] || '') : newData[key] || ''}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export {
  SecretDetailsContainer
};