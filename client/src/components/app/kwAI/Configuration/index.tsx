import { CirclePlus, List } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { AddConfiguration } from "./Add";
import { Button } from "@/components/ui/button";
import { ListConfigurations } from "./List";
import { useState } from "react";

type ConfigurationProps = {
  cluster: string;
  config: string;
}
const Configuration = ({cluster, config}: ConfigurationProps) => {
  const [showAddConfiguration, setShowAddConfiguration] = useState(false);
  const [selectedUUID, setSelectedUUId] = useState('');
  const addNewConfiguration = (uuid: string) => {
    setSelectedUUId(uuid);
    setShowAddConfiguration(!showAddConfiguration);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <div className="flex justify-between">
          <h3 className="text-lg font-medium">kwAI Configuration</h3>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button variant="default" size="icon" className="h-8 w-8 shadow-none" onClick={() => addNewConfiguration('')}>
                  {showAddConfiguration ? <List className="h-4 w-4" /> : <CirclePlus className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="px-1.5">
                {showAddConfiguration ? 'List Configurations' : 'Add Configuration'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <p className="text-sm text-muted-foreground">
          {!showAddConfiguration ? 'List of your saved Providers and LLMs' : 'Configure a new Provider and LLM'}
        </p>
      </div>
      {
        showAddConfiguration ?
          <AddConfiguration  cluster={cluster} config={config} uuid={selectedUUID} setShowAddConfiguration={setShowAddConfiguration}/> :
          <ListConfigurations setSelectedUUId={addNewConfiguration} />
      }


    </div>
  );
};

export {
  Configuration
};
