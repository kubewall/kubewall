import { kwAIConfigurations, kwAIStoredModels } from "@/types/kwAI/addConfiguration";
import { kwAiModels, resetKwAiModels } from "@/data/KwClusters/kwAiModelsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ComboboxDemo } from "@/components/app/Common/Combobox";
import { Input } from "@/components/ui/input";
import { KW_AI_PROVIDERS } from "@/constants/kwAi";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AddConfigurationProps = {
  uuid: string;
  setShowAddConfiguration: React.Dispatch<React.SetStateAction<boolean>>;
  cluster: string;
  config: string;
}

const AddConfiguration = ({ uuid, setShowAddConfiguration, config, cluster }: AddConfigurationProps) => {
  const dispatch = useAppDispatch();
  const {
    error,
    kwAiModel,
    loading
  } = useAppSelector((state) => state.kwAiModels);

  const queryParams = new URLSearchParams({
    config,
    cluster
  }).toString();
  const getDefaultState = (uuid?: string) => {
    let defaultState = {
      provider: '',
      model: '',
      url: '',
      apiKey: '',
      alias: '',
    };
    if (uuid) {
      const storedKwAIModel = localStorage.getItem('kwAIStoredModels');
      if (storedKwAIModel) {
        defaultState = (JSON.parse(storedKwAIModel) as kwAIStoredModels).providerCollection[uuid] || defaultState;
      }
    }
    return defaultState;
  };

  const getDefaultCurrentProvider = (uuid?: string) => {
    if (!uuid) {
      return false;
    }
    const storedKwAIModel = localStorage.getItem('kwAIStoredModels');
    if (storedKwAIModel) {
      return (JSON.parse(storedKwAIModel) as kwAIStoredModels).defaultProvider === uuid;
    }
  };
  const [formData, setFormData] = useState(getDefaultState(uuid));
  const [currentProviderIsDefault, setCurrentProviderIsDefault] = useState(getDefaultCurrentProvider(uuid));
  const handleChange = (name: string, value: string | boolean) => setFormData(prev => ({ ...prev, [name]: value }));
  const isInvalid = (Object.keys(formData) as kwAIConfigurations[]).some((key) => key === 'apiKey' && ['ollama', 'lmstudio'].includes(formData.provider) ? false : formData[key] === '');

  useEffect(() => {
    const {
      url,
      apiKey,
      provider,
    } = formData;
    if (provider && url && (['ollama', 'lmstudio'].includes(provider) || apiKey)) {
      setFormData({
        ...formData,
      });
      dispatch(kwAiModels({ apiKey, url, queryParams }));
    }
  }, [formData.apiKey, formData.url, formData.provider, queryParams]);

  const resetAddConfiguration = () => {
    dispatch(resetKwAiModels());
    setFormData(getDefaultState());
    setCurrentProviderIsDefault(false);
    if (uuid) {
      setShowAddConfiguration(false);
    }
  };

  const storeConfigToLocalStorage = () => {
    const currentUUID = uuid || crypto.randomUUID();

    try {
      const raw = localStorage.getItem('kwAIStoredModels');
      let kwAiModels: kwAIStoredModels = raw ? JSON.parse(raw) : {};

      // Initialize parent if not present
      if (!kwAiModels) {
        kwAiModels = {
          defaultProvider: '',
          providerCollection: {}
        };
      }

      kwAiModels = {
        ...kwAiModels,
        defaultProvider: currentProviderIsDefault ? currentUUID : '',
        providerCollection: {
          ...kwAiModels.providerCollection,
          [currentUUID]: formData,
        }
      };

      localStorage.setItem('kwAIStoredModels', JSON.stringify(kwAiModels));

      toast.success("Success", {
        description: 'Configuration saved!',
      });

      resetAddConfiguration();
    } catch (error) {
      toast.error("Failure", {
        description: 'Some error occurred. Check localStorage permissions or the console.',
      });
      console.error('kwAIStoredModelsFailure', error);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-4 pt-0 flex-1 flex flex-col space-y-4 overflow-auto pr-2">
        <div>
          <Label>Provider</Label>
          <ComboboxDemo data={KW_AI_PROVIDERS} setValue={(value) => handleChange('provider', value)} value={formData.provider} placeholder="Select Provider..." />
        </div>
        <div>
          <Label>URL</Label>
          <Input id="addKwAiConfigUrl" className={cn('shadow-none', error && 'border-destructive focus-visible:ring-destructive')} value={formData.url} onChange={(e) => handleChange('url', e.target.value)} />
        </div>

        {
          !['ollama', 'lmstudio'].includes(formData.provider) &&
          <div>
            <Label>API Key</Label>
            <Input id="addKwAiConfigApiKey" className={cn('shadow-none', error && 'border-destructive focus-visible:ring-destructive')} value={formData.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} />
          </div>
        }

        <div>
          <Label>Model</Label>
          {
            loading ? <Skeleton className="h-9 w-full rounded-md" /> :
              <ComboboxDemo data={kwAiModel} setValue={(value) => handleChange('model', value)} value={formData.model} placeholder="Select Model..." />
          }
          {
            error && <p className="text-sm text-destructive">Error fetching models, please check the details above</p>
          }
        </div>
        <div>
          <Label>Alias</Label>
          <Input id="addKwAiConfigAlias" className="shadow-none" value={formData.alias} onChange={(e) => handleChange('alias', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="airplane-mode">Set as default Provider</Label>
          <Switch className="block" id="airplane-mode" checked={currentProviderIsDefault} onClick={() => setCurrentProviderIsDefault(!currentProviderIsDefault)} />
        </div>
      </div>
      <div className="flex p-4 border-t justify-center gap-2">
        <Button
          className="md:w-2/4 w-full"
          variant="default"
          disabled={isInvalid || loading}
          onClick={storeConfigToLocalStorage}
        >Save</Button>
        <Button
          className="md:w-2/4 w-full"
          variant="outline"
          onClick={resetAddConfiguration}
        >
          {uuid ? "Cancel" : "Reset"}
        </Button>
      </div>
    </div>
  );
};

export {
  AddConfiguration
};