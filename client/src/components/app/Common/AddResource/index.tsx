import './index.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import Editor from '../../Details/YamlEditor/MonacoWrapper';
import type { editor as MonacoEditor } from 'monaco-editor';
import { FilePlusIcon } from "@radix-ui/react-icons";
import { Loader } from '../../Loader';
import { SaveIcon } from "lucide-react";
import { getSystemTheme } from "@/utils";
import { validateKubernetesYaml, formatYaml, cleanYamlForPatch } from '@/utils/yamlUtils';
import { kwList, appRoute } from '@/routes';
import { toast } from 'sonner';
import { CUSTOM_RESOURCES_LIST_ENDPOINT } from '@/constants';
import kwFetch from '@/data/kwFetch';
import { API_VERSION } from '@/constants';

const BUILT_IN_GROUPS = new Set<string>([
  '',
  'apps',
  'batch',
  'networking.k8s.io',
  'rbac.authorization.k8s.io',
  'autoscaling',
  'policy',
  'scheduling.k8s.io',
  'node.k8s.io',
  'storage.k8s.io',
]);

function isCustomResource(ar: { group: string }): boolean {
  return !!ar.group && !BUILT_IN_GROUPS.has(ar.group);
}

function mapResourceKindForRoute(ar: { resource: string; group: string }): string {
  return isCustomResource(ar) ? CUSTOM_RESOURCES_LIST_ENDPOINT : ar.resource;
}

const AddResource = () => {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const { config } = appRoute.useParams();
  const { cluster, resourcekind, group = '', resource = '' } = kwList.useSearch();

  const queryParams = new URLSearchParams({
    config,
    cluster
  }).toString();

  const [yamlUpdated, setYamlUpdated] = useState<boolean>(false);
  const {
    error,
    yamlUpdateResponse,
    loading: yamlUpdateLoading
  } = useAppSelector((state) => state.updateYaml);


  const onChange = useCallback((val = '') => {
    setYamlUpdated(true);
    setValue(val);
  }, []);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editorDimensions, setEditorDimensions] = useState({ width: "100%", height: "100%" });
  const [isDialogOpen, setIsDialogOpen] = useState(false); // Track dialog open state
  const [canCreate, setCanCreate] = useState<boolean>(true);
  const [checkingPermission, setCheckingPermission] = useState<boolean>(false);

  const [hasYamlErrors, setHasYamlErrors] = useState(false);

  const onValidate = useCallback((markers: MonacoEditor.IMarker[]) => {
    setHasYamlErrors((markers || []).length > 0);
  }, []);

  const yamlUpdate = () => {
    if (hasYamlErrors) {
      toast.error('Invalid YAML', { description: 'Please fix YAML errors before applying.' });
      return;
    }

    // Validate YAML before applying
    const validation = validateKubernetesYaml(value);
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

  const onDialogOpenChange = (status: boolean) => {
    setIsDialogOpen(status);
    setValue('');
    setYamlUpdated(false);
  };

  const listSelectedNamespace = useAppSelector((state: any) => state?.listTableNamesapce?.selectedNamespace);
  const namespaceForCheck = (() => {
    if (Array.isArray(listSelectedNamespace) && listSelectedNamespace.length === 1) {
      return Array.from(listSelectedNamespace)[0] as string;
    }
    return '';
  })();

  useEffect(() => {
    const checkPermission = async () => {
      if (!config || !cluster || !resourcekind) return;
      setCheckingPermission(true);
      try {
        const qp: Record<string, string> = { config, cluster, resourcekind, verb: 'create' };
        if (resourcekind === 'customresources') {
          if (group) qp['group'] = group;
          if (resource) qp['resource'] = resource;
        }
        if (namespaceForCheck) qp['namespace'] = namespaceForCheck;
        const url = `${API_VERSION}/permissions/check?${new URLSearchParams(qp).toString()}`;
        const res = await kwFetch(url, { method: 'GET' });
        setCanCreate(Boolean((res as any)?.allowed));
      } catch (_) {
        setCanCreate(false);
      } finally {
        setCheckingPermission(false);
      }
    };
    checkPermission();
  }, [config, cluster, resourcekind, group, resource, namespaceForCheck]);
  useEffect(() => {
    if (yamlUpdateResponse.message) {
      toast.success("Success", {
        description: yamlUpdateResponse.message,
      });

      // If server sent applied resources, navigate to the first one
      const first = yamlUpdateResponse.appliedResources?.[0];
      if (first) {
        const params = new URLSearchParams({
          cluster,
          resourcekind: mapResourceKindForRoute(first),
          resourcename: first.name,
          namespace: first.namespace || '',
          // Custom resources are handled via resourcekind=customresources + group/kind/resource/version
          ...(first.group && first.group !== '' && first.resource === 'customresources' ? {
            group: first.group,
            kind: first.kind,
            resource: first.resource,
            version: first.version,
          } : {}),
        }).toString();
        window.location.href = `/${config}/details?${params}`;
      }

      setIsDialogOpen(false);
      dispatch(resetUpdateYaml());
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
    }
  }, [yamlUpdateResponse, error]);

  useEffect(() => {
    const resizeEditor = () => {
      if (editorContainerRef.current) {
        const { clientWidth, clientHeight } = editorContainerRef.current;
        setEditorDimensions({ width: clientWidth.toString() || "100%", height: clientHeight.toString() || "80vh" });
      }
    };

    if (isDialogOpen) {
      // Resize editor when dialog is opened
      resizeEditor();
      window.addEventListener("resize", resizeEditor);
    }

    return () => {
      window.removeEventListener("resize", resizeEditor);
    };
  }, [isDialogOpen]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={onDialogOpenChange}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {(() => {
              const isDisabled = checkingPermission || !canCreate;
              const buttonEl = (
                <Button className="ml-1 h-8 w-8" variant="outline" size="icon" disabled={isDisabled}>
                  <FilePlusIcon
                    className={
                      `h-[1.2rem]
                      w-[1.2rem]
                      rotate-0
                      scale-100
                      transition-all
                      dark:-rotate-${getSystemTheme() === 'light' ? '90' : '0'}
                      dark:scale-${getSystemTheme() === 'light' ? '0' : '100'}`
                    }
                  />
                </Button>
              );
              return isDisabled ? (
                <span className="ml-1 inline-flex" role="button" aria-disabled tabIndex={0}>
                  {buttonEl}
                </span>
              ) : (
                <DialogTrigger asChild>
                  {buttonEl}
                </DialogTrigger>
              );
            })()}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {checkingPermission ? 'Checking permissions...' : (!canCreate ? "You don't have permission to create" : 'Add Resource')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>


      <DialogContent onInteractOutside={(event) => event.preventDefault()} className="w-full max-w-screen-lg flex flex-col" style={{ height: '80vh' }}>
        <DialogHeader>
          <DialogTitle>YAML/Manifest</DialogTitle>
          <DialogDescription>
            Add the yaml/manifest file of the new resource you want to create and click Apply.
          </DialogDescription>
        </DialogHeader>
        <div ref={editorContainerRef} className="flex-grow border-b rounded-b-sm" style={{ overflow: "hidden" }}>
          {editorDimensions.width && editorDimensions.height && (
            <>
              {
                yamlUpdated &&
                <Button
                  variant="default"
                  size="icon"
                  className='absolute bottom-12 right-12 rounded z-10 border w-16 gap-0'
                  onClick={yamlUpdate}
                  disabled={hasYamlErrors || yamlUpdateLoading}
                > {
                    yamlUpdateLoading ?
                      <Loader className='w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                      <SaveIcon className="h-4 w-4 mr-1" />
                  }
                  <span className='text-xs'>Apply</span>
                </Button>
              }
              <Editor
                className='border rounded-lg h-screen'
                value={value}
                defaultLanguage='yaml'
                onChange={onChange}
                onValidate={onValidate}
                theme={getSystemTheme()}
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
                width={editorDimensions.width}
                height={editorDimensions.height}
              />
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export {
  AddResource
};