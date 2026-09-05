import { Card, CardContent, CardTitle } from "@/components/ui/card";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { DetailsCards } from "@/types";
import { RelativeTime } from "@/components/app/Common/RelativeTime";
import { ResourceDetailsLink } from "@/components/app/Common/ResourceDetailsLink";

type CardContainerProps = {
  items: DetailsCards,
  title?: string;
};

const AGE_LABEL = 'Age';

function DetailValue({ label, value, link }: DetailsCards[number]) {
  if (link) {
    return <ResourceDetailsLink link={link} text={String(value)} />;
  }
  if (label === AGE_LABEL && typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return <RelativeTime timestamp={value} />;
  }
  return <>{value}</>;
}

export function FixedCard({ items, title }: CardContainerProps) {
  const rowsPerColumn = Math.ceil(items.length / 2);

  return (
    <div className="flex items-center justify-center [&>div]:w-full">
      <Card className="pt-3 shadow-none rounded-lg">
        {
          title && <CardTitle className="p-4">{title}</CardTitle>
        }
        <CardContent className="grid gap-1 p-4 pt-0">
          <div
            className="grid grid-cols-1 gap-2 md:grid-cols-2 md:grid-flow-col"
            style={{ gridTemplateRows: `repeat(${rowsPerColumn}, auto)` }}
          >
            {
              items.map(({ label, value, link }) => {
                return (
                  <div key={label} className="group/item -mx-2 px-3 transition-all">
                    <div className="flex flex-row">
                      <div className="text-sm font-medium text-muted-foreground basis-1/3">{label}</div>
                      {/* <div className="text-sm font-normal break-all basis-2/3">{value}</div> */}
                      <div className="text-sm font-normal basis-2/3 flex items-center justify-between">
                        <div className="break-all"><DetailValue label={label} value={value} link={link} /></div>
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
