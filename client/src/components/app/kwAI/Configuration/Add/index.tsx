import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { kwAIStoredModels } from "@/types/kwAI/addConfiguration";
import { kwAiModels, resetKwAiModels } from "@/data/KwClusters/kwAiModelsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

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
  setKwAIStoredModelsCollection: Dispatch<SetStateAction<kwAIStoredModels>>;
}

const AddConfiguration = ({ uuid, setShowAddConfiguration, config, cluster, setKwAIStoredModelsCollection }: AddConfigurationProps) => {
  const dispatch = useAppDispatch();
  const {
    error,
    kwAiModel,
    loading
  } = useAppSelector((state) => state.kwAiModels);

  const getDefaultState = (uuid?: string) => {
    let defaultState = {
      provider: '',
      model: '',
      url: '',
      apiKey: '',
      apiVersion: '',
      alias: '', // Default alias is an empty string
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
      return true;
    }
    const storedKwAIModel = localStorage.getItem('kwAIStoredModels');
    if (storedKwAIModel) {
      return (JSON.parse(storedKwAIModel) as kwAIStoredModels).defaultProvider === uuid;
    }
  };

  const [formData, setFormData] = useState(getDefaultState(uuid));
  const [currentProviderIsDefault, setCurrentProviderIsDefault] = useState(getDefaultCurrentProvider(uuid));

  // Modified handleChange to include alias autofill logic, respecting existing alias value
  const handleChange = (name: string, value: string | boolean) => {
    setFormData(prev => {
      const newState = { ...prev, [name]: value };

      // Only auto-fill alias if the current alias is empty or was previously auto-filled by this logic
      // This ensures manual input is not overwritten
      const currentAliasValue = prev.alias;
      const isAliasDefaultOrAutofilled = currentAliasValue === '' || currentAliasValue === `${prev.provider}-${prev.model}`;

      if (name === 'model' && typeof value === 'string' && newState.provider && value && isAliasDefaultOrAutofilled) {
        newState.alias = `${newState.provider}-${value}`;
      } else if (name === 'provider' && typeof value === 'string' && newState.model && value && isAliasDefaultOrAutofilled) {
        newState.alias = `${value}-${newState.model}`;
      }
      return newState;
    });
  };

  const isInvalid = useMemo(() => {
    return (Object.keys(formData) as Array<keyof typeof formData>).some((key) => {
      if (key === 'apiKey' && ['lmstudio'].includes(formData.provider)) return false;
      if (key === 'apiVersion' && formData.provider === 'azure') return formData.apiVersion === '';
      if (key === 'apiVersion') return false;
      return formData[key] === '';
    });
  }, [formData]);

  // Modified handleProviderChange to include alias autofill logic, respecting existing alias value
  const handleProviderChange = (name: string, providerValue: string | boolean) => {
    const providerDefaultUrl = KW_AI_PROVIDERS.find(({ value }) => value === providerValue)?.providerDefaultUrl || '';
    setFormData(prev => {
      const newState = { ...prev, [name]: providerValue, url: providerDefaultUrl };

      // Only auto-fill alias if the current alias is empty or was previously auto-filled by this logic
      const currentAliasValue = prev.alias;
      const isAliasDefaultOrAutofilled = currentAliasValue === '' || currentAliasValue === `${prev.provider}-${prev.model}`;

      if (newState.model && typeof providerValue === 'string' && isAliasDefaultOrAutofilled) {
        newState.alias = `${providerValue}-${newState.model}`;
      }
      return newState;
    });
  };

  useEffect(() => {
    const {
      url,
      apiKey,
      provider,
      apiVersion,
    } = formData;
    const params: Record<string, string> = { config, cluster };
    if (provider === 'azure' && apiVersion) {
      params['api-version'] = apiVersion;
    }
    const dynamicQueryParams = new URLSearchParams(params).toString();

    if (provider && url && (['lmstudio'].includes(provider) || apiKey)) {
      dispatch(kwAiModels({ apiKey, queryParams: dynamicQueryParams }));
    }
  }, [formData.apiKey, formData.url, formData.provider, formData.apiVersion, config, cluster, dispatch])

  const resetAddConfiguration = () => {
    dispatch(resetKwAiModels());
    setFormData(getDefaultState());
    setCurrentProviderIsDefault(false);
    setShowAddConfiguration(false);
  };

  const storeConfigToLocalStorage = () => {
    const currentUUID = uuid || `kw_provider_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    try {
      const raw = localStorage.getItem('kwAIStoredModels');
      let kwAiModels: kwAIStoredModels = raw ? JSON.parse(raw) : {};

      if (!kwAiModels || typeof kwAiModels.providerCollection === 'undefined') {
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
      setKwAIStoredModelsCollection(() => kwAiModels);
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
          <ComboboxDemo data={KW_AI_PROVIDERS} setValue={(value) => handleProviderChange('provider', value)} value={formData.provider} placeholder="Select Provider..." />
        </div>
        <div>
          <Label>URL</Label>
          <Input placeholder="URL to model provider" id="addKwAiConfigUrl" className={cn('shadow-none', error && 'border-destructive focus-visible:ring-destructive')} value={formData.url} onChange={(e) => handleChange('url', e.target.value)} />
        </div>

        {
          !['lmstudio'].includes(formData.provider) &&
          <div>
            <Label>API Key</Label>
            <Input placeholder="Secret Key" id="addKwAiConfigApiKey" className={cn('shadow-none', error && 'border-destructive focus-visible:ring-destructive')} value={formData.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} />
          </div>
        }


        {
          formData.provider === 'azure' &&
          <div>
            <Label>API Version</Label>
            <Input placeholder="API Version" id="addKwAiConfigApiVersion" className={cn('shadow-none', error && 'border-destructive focus-visible:ring-destructive')} value={formData.apiVersion} onChange={(e) => handleChange('apiVersion', e.target.value)} />
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
          <Input placeholder="Quick identifier name model" id="addKwAiConfigAlias" className="shadow-none" value={formData.alias} onChange={(e) => handleChange('alias', e.target.value)} />
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
