import { CirclePlus, Copy, CopyCheck, Import, List } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { AddConfiguration } from "./Add";
import { Button } from "@/components/ui/button";
import { ListConfigurations } from "./List";
import { kwAIStoredModels } from "@/types/kwAI/addConfiguration";

type ConfigurationProps = {
  cluster: string;
  config: string;
  kwAIStoredModelsCollection: kwAIStoredModels;
  setKwAIStoredModelsCollection: Dispatch<SetStateAction<kwAIStoredModels>>;
}
const Configuration = ({ cluster, config, kwAIStoredModelsCollection, setKwAIStoredModelsCollection }: ConfigurationProps) => {
  const [showAddConfiguration, setShowAddConfiguration] = useState(false);
  const [showCopyCheck, setShowCopyCheck] = useState(false);
  const [selectedUUID, setSelectedUUId] = useState('');
  const addNewConfiguration = (uuid: string) => {
    setSelectedUUId(uuid);
    setShowAddConfiguration(!showAddConfiguration);
  };

  const copyKwAIStoredModelsCollection = () => {
    navigator.clipboard.writeText(JSON.stringify(kwAIStoredModelsCollection));
    setShowCopyCheck(true);
    setTimeout(() => {
      setShowCopyCheck(false)
    }, 2000);
  }
  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <div className="flex justify-between">
          <h3 className="text-lg font-medium">kwAI Configuration</h3>
          <div className="flex justify-between">
            {/* <NavigationMenu className="z-[12]">
              <NavigationMenuList>
                <NavigationMenuItem >
                  <NavigationMenuTrigger>
                    <Button variant="ghost">
                      Action
                    </Button>

                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-4">
                      <li>
                        <NavigationMenuLink asChild>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => addNewConfiguration('')}>
                                  {showAddConfiguration ? <List className="h-4 w-4" /> : <CirclePlus className="h-4 w-4" />}

                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="px-1.5">
                                {showAddConfiguration ? 'List Configurations' : 'Add Configuration'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shadow-none" onClick={() => addNewConfiguration('')}>
                                  {showAddConfiguration ? <Copy className="h-4 w-4" /> : <CopyCheck className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="px-1.5">
                                Copy Provider config to another broswer
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shadow-none" onClick={() => addNewConfiguration('')}>
                                  <Import className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="px-1.5">
                                Import Copied config
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>With Icon</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[200px] gap-4">
                    <li>
                      <NavigationMenuLink asChild>
                        <Link href="#" className="flex-row items-center gap-2">
                          <CircleHelpIcon />
                          Backlog
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link href="#" className="flex-row items-center gap-2">
                          <CircleIcon />
                          To Do
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link href="#" className="flex-row items-center gap-2">
                          <CircleCheckIcon />
                          Done
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenu> */}
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => addNewConfiguration('')}>
                    {showAddConfiguration ? <List className="h-4 w-4" /> : <CirclePlus className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-1.5">
                  {showAddConfiguration ? 'List Configurations' : 'Add Configuration'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={copyKwAIStoredModelsCollection}>
                    {showCopyCheck ? <CopyCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-1.5">
                  Copy Provider config
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => addNewConfiguration('')}>
                    <Import className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-1.5">
                  Import Copied config
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
{/* 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 */}
        </div>

        <p className="text-sm text-muted-foreground">
          {!showAddConfiguration ? 'List of your saved Providers and LLMs' : 'Configure a new Provider and LLM'}
        </p>
      </div>
      {
        showAddConfiguration ?
          <AddConfiguration cluster={cluster} config={config} uuid={selectedUUID} setShowAddConfiguration={setShowAddConfiguration} setKwAIStoredModelsCollection={setKwAIStoredModelsCollection} /> :
          <ListConfigurations setSelectedUUId={addNewConfiguration} />
      }


    </div>
  );
};

export {
  Configuration
};
