import { ExpandableCard } from "@/components/app/Details/Card";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const ConfigMapDetailsContainer =  memo(function (){
  const {
    configMapDetails,
  } = useAppSelector((state) => state.configMapDetails);

  const secretDetailsData = [
    {
      fieldLabel: "Data",
      data: configMapDetails.data,
      defaultLabelCount: 2
    }
  ];

  return (
    <div className="mt-4">
      <ExpandableCard
        cards={secretDetailsData}
      />
    </div>
  );
});

export {
  ConfigMapDetailsContainer
};