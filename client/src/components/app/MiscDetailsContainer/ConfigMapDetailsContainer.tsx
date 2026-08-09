import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CodeBlock } from "../Common/CodeBlock";
import { CopyToClipboard } from "../Common/CopyToClipboard";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const ConfigMapDetailsContainer = memo(function () {
  const {
    configMapDetails,
  } = useAppSelector((state) => state.configMapDetails);

  const { data } = configMapDetails;

  return (
    <div className="mt-2">
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4 ">
          <CardTitle className="text-sm font-medium flex items-center shadow-none">
            Data
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="items-start gap-6 rounded-lg grid">
            <Card className="shadow-none rounded-lg border-dashed overflow-x-auto">
              <CardContent className="boder p-0 ">
                {
                  data && Object.keys(data).map((key: string) => {
                    // Multi-line values render as a tall code block, where the key
                    // belongs beside the first line rather than the middle.
                    const singleLine = !(data[key] || '').replace(/\n$/, '').includes('\n');

                    return (
                      <div key={key} className={`py-1.5 border-b last:border-b-0 border-dashed flex flex-row ${singleLine ? 'items-center' : ''}`}>
                        <div className="pl-4 text-sm basis-1/4">{key}</div>
                        <div className="flex flex-row text-sm font-normal basis-3/4 group/item">
                          <div className="break-all basis-[97%] ">
                            <CodeBlock value={data[key] || ''} fileName={key} />
                          </div>
                          <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                            <CopyToClipboard
                              val={data[key] || ''}
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
  ConfigMapDetailsContainer
};
