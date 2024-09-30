import { BadgeDetails, DetailsCards } from "@/types";
import { ExpandableCard, FixedCard } from "../Card";

type OverviewProps = {
  details: DetailsCards[];
  lableConditions: BadgeDetails | null;
  annotations: BadgeDetails | null;
  miscComponent?: React.ReactNode;
}

export function Overview({ details, lableConditions, annotations, miscComponent }: OverviewProps) {
  return (
    <div className="overview overflow-auto">
      <div className="items-start justify-center gap-6 rounded-lg">
        {
          details.map((detailCard, index) => {
            return (
              <div key={index} className="grid items-start gap-6">
                <FixedCard
                  items={detailCard}
                />
              </div>
            );
          })
        }
      </div>
      {
        lableConditions &&
        <div className="mt-4 items-start justify-center gap-6 rounded-lg">
          <div className="grid items-start gap-6">
            <ExpandableCard
              cards={lableConditions}
            />
          </div>
        </div>
      }
      {
        annotations && 
        <div className="mt-4 items-start justify-center gap-6 rounded-lg">
          <div className="grid items-start gap-6">
            <ExpandableCard
              cards={annotations}
            />
          </div>
        </div>
      }
      {
        miscComponent
      }
    </div>
  );
}
