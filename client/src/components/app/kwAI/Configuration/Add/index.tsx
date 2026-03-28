import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { kwAIStoredModels } from "@/types/kwAI/addConfiguration";
import { kwAiModels, resetKwAiModels } from "@/data/KwClusters/kwAiModelsSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Providers that don't require an API key to fetch models
const API_KEY_OPTIONAL_PROVIDERS = ['lmstudio', 'ollama'];
import { ComboboxDemo } from "@/components/app/Common/Combobox";
import { Input } from "@/components/ui/input";
import { KW_AI_PROVIDERS } from "@/constants/kwAi";
import { Label } from "@/components/ui/label";
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  // Debounced model fetch to avoid firing on every keystroke
  const debouncedFetchModels = useCallback((apiKey: string, url: string, provider: string, apiVersion: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const params: Record<string, string> = { config, cluster };
      if (provider === 'azure' && apiVersion) {
        params['api-version'] = apiVersion;
      }
      const dynamicQueryParams = new URLSearchParams(params).toString();
      dispatch(kwAiModels({ apiKey, url, queryParams: dynamicQueryParams, provider }));
      setHasFetchedOnce(true);
    }, 600);
  }, [config, cluster, dispatch]);

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
      if (key === 'apiKey' && API_KEY_OPTIONAL_PROVIDERS.includes(formData.provider)) return false;
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
    const { url, apiKey, provider, apiVersion } = formData;
    if (provider && url && (API_KEY_OPTIONAL_PROVIDERS.includes(provider) || apiKey)) {
      debouncedFetchModels(apiKey, url, provider, apiVersion);
    } else {
      dispatch(resetKwAiModels());
      setHasFetchedOnce(false);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [formData.apiKey, formData.url, formData.provider, formData.apiVersion, config, cluster, debouncedFetchModels, dispatch]);

  const refreshModels = () => {
    const { url, apiKey, provider, apiVersion } = formData;
    if (!provider || !url) return;
    if (!API_KEY_OPTIONAL_PROVIDERS.includes(provider) && !apiKey) return;
    const params: Record<string, string> = { config, cluster };
    if (provider === 'azure' && apiVersion) {
      params['api-version'] = apiVersion;
    }
    const dynamicQueryParams = new URLSearchParams(params).toString();
    dispatch(kwAiModels({ apiKey, url, queryParams: dynamicQueryParams, provider }));
    setHasFetchedOnce(true);
  };

  const canRefreshModels = useMemo(() => {
    const { provider, url, apiKey } = formData;
    return provider && url && (API_KEY_OPTIONAL_PROVIDERS.includes(provider) || apiKey);
  }, [formData.provider, formData.url, formData.apiKey]);

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
      <div className="p-4 pt-0 flex-1 flex flex-col space-y-5 overflow-auto pr-2">
        {/* Provider & Connection */}
        <fieldset className="space-y-3 rounded-md border border-border/60 p-3">
          <legend className="px-1.5 text-xs font-medium text-muted-foreground">Provider &amp; Connection</legend>
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <ComboboxDemo data={KW_AI_PROVIDERS} setValue={(value) => handleProviderChange('provider', value)} value={formData.provider} placeholder="Select Provider..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input
              placeholder="https://api.example.com/v1"
              id="addKwAiConfigUrl"
              className={cn('shadow-none', error && hasFetchedOnce && 'border-destructive focus-visible:ring-destructive')}
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {KW_AI_PROVIDERS.find(p => p.value === formData.provider)?.urlHint || 'Base URL of your provider API. Only the root endpoint, no model paths.'}
            </p>
          </div>
          {!API_KEY_OPTIONAL_PROVIDERS.includes(formData.provider) && (
            <div className="space-y-1">
              <Label className="text-xs">API Key</Label>
              <Input
                placeholder="sk-..."
                id="addKwAiConfigApiKey"
                autoComplete="off"
                className={cn('shadow-none', error && hasFetchedOnce && 'border-destructive focus-visible:ring-destructive')}
                value={formData.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
              />
            </div>
          )}
          {formData.provider === 'azure' && (
            <div className="space-y-1">
              <Label className="text-xs">API Version</Label>
              <Input
                placeholder="2024-02-01"
                id="addKwAiConfigApiVersion"
                className={cn('shadow-none', error && hasFetchedOnce && 'border-destructive focus-visible:ring-destructive')}
                value={formData.apiVersion}
                onChange={(e) => handleChange('apiVersion', e.target.value)}
              />
            </div>
          )}
        </fieldset>

        {/* Model Selection */}
        <fieldset className="space-y-3 rounded-md border border-border/60 p-3">
          <legend className="px-1.5 text-xs font-medium text-muted-foreground">Model</legend>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Model</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 text-xs"
                disabled={!canRefreshModels || loading}
                onClick={refreshModels}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Fetching models…</span>
              </div>
            ) : (
              <ComboboxDemo data={kwAiModel} setValue={(value) => handleChange('model', value)} value={formData.model} placeholder="Select Model..." />
            )}
            {error && hasFetchedOnce && !loading && (
              <div className="flex items-start gap-1.5 mt-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p className="text-xs leading-tight">Could not fetch models. Please verify the provider, URL, and API key above.</p>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alias</Label>
            <Input
              placeholder="e.g. my-anthropic-claude"
              id="addKwAiConfigAlias"
              className="shadow-none"
              value={formData.alias}
              onChange={(e) => handleChange('alias', e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">A friendly name to identify this configuration.</p>
          </div>
        </fieldset>

        {/* Default Provider */}
        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <Label htmlFor="default-provider-switch" className="text-xs cursor-pointer">Set as default provider</Label>
          <Switch id="default-provider-switch" checked={currentProviderIsDefault} onCheckedChange={setCurrentProviderIsDefault} />
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