import './index.css';

import { Card, CardContent, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { defaultOrValue } from "@/utils";
import { useState } from "react";

type CardItems = {
  fieldLabel: string;
  data: {
    [k: string]: string | number | null;
  } | null | undefined;
  defaultLabelCount: number;
};

type ExpandableCardProps = {
  cards: CardItems[]
  title?: string;
};

function CardContentDetails({ fieldLabel, data, defaultLabelCount }: CardItems) {
  const [showCompleteLabel, setShowCompleteLabel] = useState(false);

  const checkForTagLength = () => {
    if (Object.keys(data || {}).length > defaultLabelCount) {
      return true;
    }

    let isTagLong = false;
    for (const [, value] of Object.entries(data || {})) {
      if (value && value.toString().length > 100) {
        isTagLong = true;
        break;
      }
    }
    return isTagLong;
  };

  return (
    data ?
      <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all group/item">
        <div className="space-y-1">
          <div className="py-1 flex items-center">
            <span className="text-sm font-medium">
              {fieldLabel}
            </span>
            {
              checkForTagLength() &&
              <span
                className="text-xs pl-1 text-blue-600 dark:text-blue-500 cursor-pointer hover:underline"
                onClick={() => setShowCompleteLabel(!showCompleteLabel)}
              >
                {
                  showCompleteLabel ? 'view less [-]' : 'view more [+]'
                }
              </span>
            }
            <div className="group/edit invisible group-hover/item:visible ml-2"><CopyToClipboard val={defaultOrValue(JSON.stringify(data))} /></div>
          </div>
          <div>
            {
              Object.keys(data).map((key, index) => {
                return (
                  (index < defaultLabelCount || showCompleteLabel) && <span key={index}>
                    <Badge className="m-1" variant="secondary">
                      <p className={checkForTagLength() && !showCompleteLabel ? "line-clamp-1 break-all" : "break-all"}>
                        <span className="text-sm font-medium text-muted-foreground">{key}: </span>
                        <span className="text-sm font-normal ">{data[key]}</span>
                      </p>
                    </Badge>
                  </span>
                );
              })
            }
          </div>
        </div>
      </div> : <></>
  );
}

export function ExpandableCard({ cards, title }: ExpandableCardProps) {
  return (
    <div className="flex items-center justify-center [&>div]:w-full">
      <Card className="shadow-none rounded-lg">
        {
          title && <CardTitle className="p-4">{title}</CardTitle>
        }
        <CardContent className="grid gap-1 p-4 pt-0 ">
          <div className={`grid grid-cols-1 md:grid-cols-${cards.length} gap-2`}>
            {
              cards.map(({ fieldLabel, data, defaultLabelCount }) => {
                return <CardContentDetails key={fieldLabel} fieldLabel={fieldLabel} data={data} defaultLabelCount={defaultLabelCount} />;
              })
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
