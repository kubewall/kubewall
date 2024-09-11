import { Card, CardContent, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";

type CardContainerProps = {
  items: {
    label: string,
    value: string | number | boolean,
  }[],
  title?: string;
};

export function FixedCard({ items, title }: CardContainerProps) {
  return (
    <div className="flex items-center justify-center [&>div]:w-full">
      <Card className="pt-3 shadow-none rounded-lg">
        {
          title && <CardTitle className="p-4">{title}</CardTitle>
        }
        <CardContent className="grid gap-1 p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {
              items.map(({ label, value }) => {
                return (
                  <div key={label} className="group/item -mx-2 px-3 transition-all">
                    <div className="flex flex-row">
                      <div className="text-sm font-medium text-muted-foreground basis-1/3">{label}</div>
                      {/* <div className="text-sm font-normal break-all basis-2/3">{value}</div> */}
                      <div className="text-sm font-normal basis-2/3 flex items-center justify-between">
                        <div className="break-all">{value}</div>
                        <div className="group/edit invisible group-hover/item:visible">
                          <CopyToClipboard val={value}/>
                          {/* <CopyIcon
                            className="mr-2 h-3.5 w-3.5 cursor-pointer"
                            onClick={() => navigator.clipboard.writeText(value.toString())}
                          /> */}
                        </div>
                      </div>
                    </div>
                    {/* <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium leading-none break-all">{value}</p>
                    </div> */}
                  </div>
                );
              })
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
