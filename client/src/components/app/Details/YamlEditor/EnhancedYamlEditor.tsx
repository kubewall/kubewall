import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme } from '@/utils';
import { validateKubernetesYaml, formatYaml, extractResourceInfo, hasYamlChanges, cleanYamlForPatch } from '@/utils/yamlUtils';
import { checkYamlEditPermission, getPermissionDenialMessage, YamlEditPermissionResult } from '@/utils/yamlPermissions';
import { memo, useCallback, useEffect, useState } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Editor from './MonacoWrapper';
import { Loader } from '../../Loader';
import { SaveIcon, AlertCircleIcon, RefreshCwIcon, EyeIcon, EditIcon } from "lucide-react";
import { toast } from "sonner";
import { updateYamlDetails } from '@/data/Yaml/YamlSlice';
import { useEventSource } from '../../Common/Hooks/EventSource';
import { useNavigate } from '@tanstack/react-router';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type EnhancedYamlEditorProps = {
  name: string;
  instanceType: string;
  namespace: string;
  configName: string;
  clusterName: string;
  extraQuery?: string;
}

const EnhancedYamlEditor = memo(function ({ 
  instanceType, 
  name, 
  namespace, 
  clusterName, 
  configName, 
  extraQuery 
}: EnhancedYamlEditorProps) {
  const {
    error,
    yamlUpdateResponse,
    loading: yamlUpdateLoading
  } = useAppSelector((state) => state.updateYaml);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [yamlUpdated, setYamlUpdated] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [originalYaml, setOriginalYaml] = useState<string>('');
  const {
    loading,
    yamlData,
  } = useAppSelector((state) => state.yaml);

  const queryParams = new URLSearchParams({
    config: configName,
    cluster: clusterName
  }).toString();

  const [value, setValue] = useState('');
  const [hasYamlErrors, setHasYamlErrors] = useState(false);
  const [yamlValidationErrors, setYamlValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [resourceInfo, setResourceInfo] = useState<{
    apiVersion?: string;
    kind?: string;
    name?: string;
    namespace?: string;
  }>({});
  const [permissionResult, setPermissionResult] = useState<YamlEditPermissionResult | null>(null);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);

  const onChange = useCallback((val = '') => {
    if (isEditing) {
      setYamlUpdated(hasYamlChanges(originalYaml, val));
      setValue(val);
    }
  }, [isEditing, originalYaml]);

  useEffect(() => {
    setValue(yamlData);
    setOriginalYaml(yamlData);
    setResourceInfo(extractResourceInfo(yamlData));
  }, [yamlData, loading]);

  // Check permissions when component mounts or when resource changes
  useEffect(() => {
    const checkPermissions = async () => {
      if (!configName || !clusterName || !name) return;
      
      setCheckingPermission(true);
      try {
        const permissionResourceKind = instanceType.startsWith('customresource') ? 'customresources' : instanceType;
        const extraParams = (() => {
          if (extraQuery) {
            const params = new URLSearchParams(extraQuery);
            return {
              group: params.get('group') || '',
              resource: params.get('resource') || '',
            };
          }
          return { group: '', resource: '' };
        })();
        const result = await checkYamlEditPermission({
          config: configName,
          cluster: clusterName,
          resourcekind: permissionResourceKind,
          namespace,
          resourcename: name,
          // Add custom resource parameters if needed (for both customresources/customresource)
          ...(((instanceType.includes('customresources') || instanceType.includes('customresource')) && extraQuery) ? extraParams : {}),
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
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermissions();
  }, [configName, clusterName, instanceType, namespace, name, extraQuery]);

  const onValidate = useCallback((markers: MonacoEditor.IMarker[]) => {
    setHasYamlErrors((markers || []).length > 0);
    
    // Extract validation errors for display
    const errors = markers.map(marker => `${marker.message} (line ${marker.startLineNumber})`);
    setYamlValidationErrors(errors);
  }, []);

  // Enhanced YAML validation using utility function
  const validateYamlContent = useCallback((yamlContent: string) => {
    return validateKubernetesYaml(yamlContent);
  }, []);

  const handleApply = () => {
    const validation = validateYamlContent(value);
    
    if (!validation.isValid) {
      toast.error('Invalid YAML', { 
        description: `Please fix the following errors:\n${validation.errors.join('\n')}` 
      });
      return;
    }

    if (validation.warnings.length > 0) {
      toast.warning('YAML Warnings', { 
        description: `Consider addressing these warnings:\n${validation.warnings.join('\n')}` 
      });
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

  const handleReset = () => {
    setValue(originalYaml);
    setYamlUpdated(false);
    setYamlValidationErrors([]);
    setValidationWarnings([]);
    setIsEditing(false);
  };

  const handleEdit = () => {
    if (!permissionResult?.allowed) {
      return; // Button is disabled, so this shouldn't happen, but just in case
    }
    setIsEditing(true);
    setYamlUpdated(false);
  };

  const handleView = () => {
    setIsEditing(false);
    setYamlUpdated(false);
    setValue(originalYaml);
  };

  useEffect(() => {
    if (yamlUpdateResponse.message) {
      toast.success("Success", {
        description: yamlUpdateResponse.message,
      });
      dispatch(resetUpdateYaml());
      setYamlUpdated(false);
      setIsEditing(false);
      setOriginalYaml(value); // Update original YAML after successful apply
    } else if (error) {
      const anyErr: any = error as any;
      let description = anyErr?.message || 'Apply failed';
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
  }, [yamlUpdateResponse, error, value]);

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
      instanceType === 'pods' ? 'pod' : instanceType,
      createEventStreamQueryObject(
        configName,
        clusterName,
        namespace
      ),
      (instanceType === 'deployments' || instanceType === 'daemonsets' || instanceType === 'statefulsets' || instanceType === 'replicasets' || instanceType === 'jobs' || instanceType === 'cronjobs' || instanceType === 'services' || instanceType === 'configmaps' || instanceType === 'secrets' || instanceType === 'horizontalpodautoscalers' || instanceType === 'limitranges' || instanceType === 'resourcequotas' || instanceType === 'serviceaccounts' || instanceType === 'roles' || instanceType === 'rolebindings' || instanceType === 'persistentvolumeclaims' || instanceType === 'poddisruptionbudgets' || instanceType === 'endpoints' || instanceType === 'ingresses' || instanceType === 'leases') ? `/${namespace}/${name}/yaml` : `/${name}/yaml`,
      extraQuery
    ),
    sendMessage,
    onConfigError: handleConfigError,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div role="status">
          <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
          </svg>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Header with status and controls */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <EditIcon className="h-4 w-4 text-blue-600" />
            ) : (
              <EyeIcon className="h-4 w-4 text-gray-600" />
            )}
            <span className="text-sm font-medium">
              {isEditing ? 'Editing' : 'Viewing'} YAML
            </span>
          </div>
          
          {/* Resource Info */}
          {(resourceInfo.kind || resourceInfo.apiVersion) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {resourceInfo.kind && (
                <Badge variant="outline" className="text-xs">
                  {resourceInfo.kind}
                </Badge>
              )}
              {resourceInfo.apiVersion && (
                <span>{resourceInfo.apiVersion}</span>
              )}
            </div>
          )}
          
          {yamlUpdated && (
            <Badge variant={hasYamlErrors ? "destructive" : "default"} className="text-xs">
              {hasYamlErrors ? 'Has Errors' : 'Modified'}
            </Badge>
          )}
          
          {/* Remove the permission status badge - no longer showing "Can Edit" or "No Permission" */}
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                    disabled={checkingPermission || !permissionResult?.allowed}
                    className={`gap-2 ${!permissionResult?.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {checkingPermission ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <EditIcon className="h-4 w-4" />
                    )}
                    {checkingPermission ? 'Checking...' : 'Edit'}
                  </Button>
                </TooltipTrigger>
                {(checkingPermission || !permissionResult?.allowed) && (
                  <TooltipContent>
                    <p className="text-sm">
                      {checkingPermission 
                        ? 'Checking permissions...' 
                        : getPermissionDenialMessage(permissionResult!)
                      }
                    </p>
                    {!checkingPermission && !permissionResult?.allowed && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Contact your cluster administrator if you believe this is an error.
                      </p>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleView}
                className="gap-2"
              >
                <EyeIcon className="h-4 w-4" />
                View
              </Button>
              
              {yamlUpdated && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={yamlUpdateLoading}
                    className="gap-2"
                  >
                    <RefreshCwIcon className="h-4 w-4" />
                    Reset
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApply}
                    disabled={hasYamlErrors || yamlUpdateLoading || !permissionResult?.allowed}
                    className="gap-2"
                  >
                    {yamlUpdateLoading ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <SaveIcon className="h-4 w-4" />
                    )}
                    Apply
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>



      {/* Validation Alerts */}
      {yamlValidationErrors.length > 0 && (
        <Alert variant="destructive" className="m-4">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>YAML Validation Errors</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {yamlValidationErrors.map((error, index) => (
                <li key={index} className="text-sm">{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validationWarnings.length > 0 && (
        <Alert className="m-4">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>YAML Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {validationWarnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* YAML Editor */}
      <div className="flex-1" style={{ height: 'calc(100vh - 200px)' }}>
        <Editor
          value={value}
          language="yaml"
          onChange={onChange}
          onValidate={onValidate}
          className="border rounded-lg h-full"
          theme={getSystemTheme()}
          options={{
            readOnly: !isEditing,
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
    </div>
  );
});

export { EnhancedYamlEditor };
