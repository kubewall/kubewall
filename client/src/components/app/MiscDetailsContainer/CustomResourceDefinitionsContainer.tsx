import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { memo, useEffect, useState } from "react";
import { useAppSelector } from "@/redux/hooks";
import { useNavigate } from "@tanstack/react-router";
import { kwList, appRoute } from "@/routes";
import { CUSTOM_RESOURCES_LIST_ENDPOINT } from "@/constants";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";
import { Loader } from "@/components/app/Loader";

interface CustomResourceInstance {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: Record<string, any>;
  status?: Record<string, any>;
}

interface CRDResources {
  [crdName: string]: {
    instances: CustomResourceInstance[];
    loading: boolean;
    error?: string;
  };
}

const CustomResourceDefinitionsContainer = memo(function () {
  const navigate = useNavigate();
  const { config } = appRoute.useParams();
  const { cluster } = kwList.useSearch();
  
  const {
    customResourcesDefinitions
  } = useAppSelector((state) => state.customResources);

  const [crdResources, setCrdResources] = useState<CRDResources>({});
  const [loading, setLoading] = useState(false);

  // Fetch resources for each CRD
  useEffect(() => {
    const fetchCRDResources = async () => {
      if (!customResourcesDefinitions || customResourcesDefinitions.length === 0) return;
      
      setLoading(true);
      const newCrdResources: CRDResources = {};

      for (const crd of customResourcesDefinitions) {
        newCrdResources[crd.name] = { instances: [], loading: true };
        
        try {
          // Get the active version and resource info from the CRD
          const group = crd.group;
          const version = crd.version;
          const resource = crd.resource.toLowerCase(); // Convert to plural form
          
          const queryParams = new URLSearchParams({
            config,
            cluster,
            group,
            version,
            resource
          });

          const response = await kwFetch(`${API_VERSION}/${CUSTOM_RESOURCES_LIST_ENDPOINT}?${queryParams}`);
          
          if (response && Array.isArray(response)) {
            newCrdResources[crd.name] = {
              instances: response as CustomResourceInstance[],
              loading: false
            };
          } else {
            newCrdResources[crd.name] = {
              instances: [],
              loading: false,
              error: 'Invalid response format'
            };
          }
        } catch (error) {
          console.error(`Error fetching resources for CRD ${crd.name}:`, error);
          newCrdResources[crd.name] = {
            instances: [],
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      setCrdResources(newCrdResources);
      setLoading(false);
    };

    fetchCRDResources();
  }, [customResourcesDefinitions, config, cluster]);

  const handleResourceClick = (crd: any, instance: CustomResourceInstance) => {
    navigate({
      to: '/$config/details',
      params: { config },
      search: {
        cluster,
        resourcekind: CUSTOM_RESOURCES_LIST_ENDPOINT,
        resourcename: instance.metadata.name,
        group: crd.group,
        kind: crd.resource,
        resource: crd.resource.toLowerCase(),
        version: crd.version,
        namespace: instance.metadata.namespace || ''
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-8 h-8" />
        <span className="ml-2">Loading Custom Resource Definitions...</span>
      </div>
    );
  }

  if (!customResourcesDefinitions || customResourcesDefinitions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No Custom Resource Definitions found in this cluster.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {customResourcesDefinitions.map((crd) => (
        <Card key={crd.name} className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">{crd.name}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{crd.group}</Badge>
                  <Badge variant="secondary">{crd.version}</Badge>
                  <Badge variant="outline">{crd.scope}</Badge>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <div>Resource: {crd.resource}</div>
                <div>Age: {crd.age}</div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Instances ({crdResources[crd.name]?.instances?.length || 0})</h4>
                {crdResources[crd.name]?.loading && (
                  <Loader className="w-4 h-4" />
                )}
              </div>
              
              {crdResources[crd.name]?.error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  Error loading instances: {crdResources[crd.name].error}
                </div>
              )}
              
              {crdResources[crd.name]?.instances && crdResources[crd.name].instances.length > 0 ? (
                <div className="space-y-2">
                  {crdResources[crd.name].instances.map((instance) => (
                    <div
                      key={instance.metadata.uid}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleResourceClick(crd, instance)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{instance.metadata.name}</div>
                        {instance.metadata.namespace && (
                          <div className="text-sm text-muted-foreground">
                            Namespace: {instance.metadata.namespace}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Created: {new Date(instance.metadata.creationTimestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {instance.kind}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Copy YAML to clipboard
                            navigator.clipboard.writeText(JSON.stringify(instance, null, 2));
                          }}
                        >
                          Copy YAML
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                  No instances found for this Custom Resource Definition
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

export { CustomResourceDefinitionsContainer };
