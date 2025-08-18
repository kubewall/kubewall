import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme } from '@/utils';
import { formatYaml, cleanYamlForPatch } from '@/utils/yamlUtils';
import { memo, useCallback, useEffect, useState } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';

import { Button } from '@/components/ui/button';

import Editor from './MonacoWrapper';
import { Loader } from '../../Loader';
import { SaveIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { updateYamlDetails } from '@/data/Yaml/YamlSlice';
import { useEventSource } from '../../Common/Hooks/EventSource';
import { useNavigate } from '@tanstack/react-router';
import { checkYamlEditPermission, getPermissionDenialMessage, YamlEditPermissionResult } from '@/utils/yamlPermissions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type EditorProps = {
  name: string;
  instanceType: string;
  namespace: string;
  configName: string;
  clusterName: string;
  extraQuery?: string;
}

const YamlEditor = memo(function ({ instanceType, name, namespace, clusterName, configName, extraQuery }: EditorProps) {
  const {
    error,
    yamlUpdateResponse,
    loading: yamlUpdateLoading
  } = useAppSelector((state) => state.updateYaml);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [yamlUpdated, setYamlUpdated] = useState<boolean>(false);
  const {
    loading,
    yamlData,
  } = useAppSelector((state) => state.yaml);

  const queryParams = new URLSearchParams({
    config: configName,
    cluster: clusterName
  }).toString();

  const [value, setValue] = useState('');
  const onChange = useCallback((val = '') => {
    setYamlUpdated(true);
    setValue(val);
  }, []);

  useEffect(() => {
    setValue(yamlData);
  }, [yamlData, loading]);

  // Check permissions when component mounts or when resource changes
  useEffect(() => {
    const checkPermissions = async () => {
      if (!configName || !clusterName || !name) return;
      
      try {
        const result = await checkYamlEditPermission({
          config: configName,
          cluster: clusterName,
          resourcekind: instanceType,
          namespace,
          resourcename: name,
          // Add custom resource parameters if needed
          ...(instanceType.includes('customresources') && extraQuery ? {
            group: new URLSearchParams(extraQuery).get('group') || '',
            resource: new URLSearchParams(extraQuery).get('resource') || '',
          } : {}),
        });
        setPermissionResult(result);
      } catch (error) {
        console.error('Failed to check YAML edit permissions:', error);
        setPermissionResult({
          allowed: false,
          permissions: { update: false, patch: false },
          reason: 'Failed to check permissions',
          group: '',
          resource: instanceType,
          namespace,
          name,
        });
      }
    };

    checkPermissions();
  }, [configName, clusterName, instanceType, namespace, name, extraQuery]);

  const [hasYamlErrors, setHasYamlErrors] = useState(false);
  const [yamlValidationErrors, setYamlValidationErrors] = useState<string[]>([]);
  const [permissionResult, setPermissionResult] = useState<YamlEditPermissionResult | null>(null);

  const onValidate = useCallback((markers: MonacoEditor.IMarker[]) => {
    setHasYamlErrors((markers || []).length > 0);
    
    // Extract validation errors for display
    const errors = markers.map(marker => `${marker.message} (line ${marker.startLineNumber})`);
    setYamlValidationErrors(errors);
  }, []);

  // Enhanced YAML validation
  const validateYamlContent = useCallback((yamlContent: string): boolean => {
    try {
      // Basic YAML syntax validation
      const lines = yamlContent.split('\n');
      let hasApiVersion = false;
      let hasKind = false;
      let hasMetadata = false;
      let hasName = false;

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('apiVersion:')) {
          hasApiVersion = true;
        }
        if (trimmedLine.startsWith('kind:')) {
          hasKind = true;
        }
        if (trimmedLine.startsWith('metadata:')) {
          hasMetadata = true;
        }
        if (trimmedLine.startsWith('name:')) {
          hasName = true;
        }
      }

      const missingFields: string[] = [];
      if (!hasApiVersion) missingFields.push('apiVersion');
      if (!hasKind) missingFields.push('kind');
      if (!hasMetadata) missingFields.push('metadata');
      if (!hasName) missingFields.push('name');

      if (missingFields.length > 0) {
        setYamlValidationErrors([`Missing required fields: ${missingFields.join(', ')}`]);
        return false;
      }

      return true;
    } catch (error) {
      setYamlValidationErrors(['Invalid YAML syntax']);
      return false;
    }
  }, []);

  const yamlUpdate = () => {
    if (!permissionResult?.allowed) {
      return; // Button is disabled, so this shouldn't happen, but just in case
    }

    if (hasYamlErrors) {
      toast.error('Invalid YAML', { description: 'Please fix YAML errors before saving.' });
      return;
    }

    if (!validateYamlContent(value)) {
      toast.error('Invalid YAML', { description: 'Please fix YAML validation errors before applying.' });
      return;
    }

    // Clean and format YAML before applying
    const cleanedYaml = cleanYamlForPatch(value);
    const formattedYaml = formatYaml(cleanedYaml);
    setValue(formattedYaml);

    dispatch(updateYaml({
      data: formattedYaml,
      queryParams
    }));
  };

  useEffect(() => {
    if (yamlUpdateResponse.message) {
      toast.success("Success", {
        description: yamlUpdateResponse.message,
      });
      dispatch(resetUpdateYaml());
      setYamlUpdated(false);
    } else if (error) {
      const anyErr: any = error as any;
      let description = anyErr?.message || 'Save failed';
      if (Array.isArray(anyErr?.details) && anyErr.details.length) {
        const first = anyErr.details[0];
        if (first?.message) {
          description = first.message;
        }
      }
      toast.error("Failure", { description });
      dispatch(resetUpdateYaml());
      setYamlUpdated(false);
    }
  }, [yamlUpdateResponse, error]);

  const sendMessage = (message: Event[]) => {
    dispatch(updateYamlDetails(message));
  };

  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  useEventSource({
    url: getEventStreamUrl(
      // For pods, use singular form when namespace is in query params
      instanceType === 'pods' ? 'pod' : instanceType,
      createEventStreamQueryObject(
        configName,
        clusterName,
        namespace
      ),
      // For namespace-scoped resources, include namespace in path
      (instanceType === 'deployments' || instanceType === 'daemonsets' || instanceType === 'statefulsets' || instanceType === 'replicasets' || instanceType === 'jobs' || instanceType === 'cronjobs' || instanceType === 'services' || instanceType === 'configmaps' || instanceType === 'secrets' || instanceType === 'horizontalpodautoscalers' || instanceType === 'limitranges' || instanceType === 'resourcequotas' || instanceType === 'serviceaccounts' || instanceType === 'roles' || instanceType === 'rolebindings' || instanceType === 'persistentvolumeclaims' || instanceType === 'poddisruptionbudgets' || instanceType === 'endpoints' || instanceType === 'ingresses' || instanceType === 'leases') ? `/${namespace}/${name}/yaml` : `/${name}/yaml`,
      extraQuery
    ),
    sendMessage,
    onConfigError: handleConfigError,
  });

  return (
    <>
      {
        loading ?
          <div className="flex items-center justify-center h-screen">
            <div role="status">
              <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" /><path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" /></svg>
              <span className="sr-only">Loading...</span>
            </div>
          </div>
          : <div className='relative'>
            {/* YAML Validation Status */}
            {yamlUpdated && (
              <div className="absolute top-4 right-4 z-20">
                {hasYamlErrors ? (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    <AlertCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm text-red-700 dark:text-red-300">YAML has errors</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                    <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300">YAML is valid</span>
                  </div>
                )}
              </div>
            )}

            {/* Remove the permission status badge - no longer showing "Can Edit" or "No Permission" */}

            {/* Action Buttons */}
            {yamlUpdated && (
              <div className="absolute bottom-32 right-0 mt-1 mr-5 rounded z-10 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className='gap-2 px-4 py-2'
                  onClick={() => {
                    setValue(yamlData);
                    setYamlUpdated(false);
                    setYamlValidationErrors([]);
                  }}
                  disabled={yamlUpdateLoading}
                >
                  <span className='text-xs'>Reset</span>
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className={`gap-2 px-4 py-2 ${!permissionResult?.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={yamlUpdate}
                        disabled={hasYamlErrors || yamlUpdateLoading || !permissionResult?.allowed}
                      >
                        {yamlUpdateLoading ? (
                          <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
                        ) : (
                          <SaveIcon className="h-4 w-4" />
                        )}
                        <span className='text-xs'>Apply</span>
                      </Button>
                    </TooltipTrigger>
                    {(hasYamlErrors || yamlUpdateLoading || !permissionResult?.allowed) && (
                      <TooltipContent>
                        <p className="text-sm">
                          {hasYamlErrors 
                            ? 'Cannot apply YAML with validation errors' 
                            : yamlUpdateLoading 
                              ? 'Applying changes...' 
                              : getPermissionDenialMessage(permissionResult!)
                          }
                        </p>
                        {!hasYamlErrors && !yamlUpdateLoading && !permissionResult?.allowed && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Contact your cluster administrator if you believe this is an error.
                          </p>
                        )}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {/* YAML Validation Errors */}
            {yamlValidationErrors.length > 0 && (
              <div className="absolute top-16 right-4 z-20 max-w-md">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">Validation Errors</span>
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                    {yamlValidationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}



            <Editor
              value={value}
              language="yaml"
              onChange={onChange}
              onValidate={onValidate}
              className='border rounded-lg h-screen'
              theme={getSystemTheme()}
              options={{
                minimap: { enabled: false },
                automaticLayout: true,
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                folding: true,
                scrollBeyondLastLine: true,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  verticalScrollbarSize: 14,
                  horizontalScrollbarSize: 14,
                },
                overviewRulerBorder: false,
                overviewRulerLanes: 0,
              }}
            />
          </div>
      }
    </>
  );
});

export {
  YamlEditor
};