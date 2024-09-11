import { ExpandableCard } from "@/components/app/Details/Card";
import { memo } from "react";
import { useAppSelector } from "@/redux/hooks";

const SecretDetailsContainer = memo(function () {
  const {
    secretsDetails,
  } = useAppSelector((state) => state.secretsDetails);

  const secretDetailsData = [
    {
      fieldLabel: "Data",
      data: secretsDetails.data,
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
  SecretDetailsContainer
};