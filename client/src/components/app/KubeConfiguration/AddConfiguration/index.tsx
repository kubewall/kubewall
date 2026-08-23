import { BearerTokenConfig, CertificateConfig, KubeconfigFileConfig } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KUBECONFIGS_BEARER_URL, KUBECONFIGS_CERTIFICATE_URL, KUBECONFIGS_URL } from "@/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addConfig, resetAddConfig } from "@/data/KwClusters/AddConfigSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ConfigNameInput, isConfigNameInvalid } from "@/components/app/Common/ConfigNameInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { Textarea } from "@/components/ui/textarea";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { toast } from "sonner";
import addons from "@/addons";
import capabilities from "@/capabilities";

type ClusterTag = { label: string; color: string };

const ClusterTagListEditor = addons.clusterTags?.ClusterTagListEditor ?? null;
const tagsEnabled = !!capabilities.clusterTags?.enabled && !!ClusterTagListEditor;

type AddConfigProps = {
  /** Custom trigger element (e.g. the sidebar's dashed "+ Add config" row). Defaults to the standalone solid button. */
  trigger?: ReactNode;
};

const AddConfig = ({ trigger }: AddConfigProps) => {

  const [textValue, setTextValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [bearerTokenConfig, setBearerTokenConfig] = useState<BearerTokenConfig>({
    configName: '',
    name: '',
    apiServer: '',
    token: ''
  });
  const [certificateConfig, setCertificateConfig] = useState<CertificateConfig>({
    configName: '',
    name: '',
    apiServer: '',
    certificate: '',
    certificateKey: '',
    tlsMode: 'system',
    caCertificate: '',
  });
  const [kubeconfigFileConfig, setKubeconfigFileConfig] = useState<KubeconfigFileConfig>({
    configName: '',
    config: ''
  });
  const [tagValues, setTagValues] = useState<ClusterTag[]>([]);
  const [activeTab, setActiveTab] = useState("bearerToken");
  // The tab whose config was actually submitted — read inside the async
  // success handler instead of `activeTab`, since the user can switch tabs
  // while the POST is still in flight.
  const submittedTabRef = useRef(activeTab);

  // Two-phase dialog for the kubeconfig-file tab: once the config is created
  // we don't know its cluster/context names up front (no client-side yaml
  // parsing), so we fetch them post-submit and offer a follow-up tagging step.
  const [phase, setPhase] = useState<"form" | "tagging">("form");
  const [pendingConfigName, setPendingConfigName] = useState("");
  const [pendingTagValues, setPendingTagValues] = useState<Record<string, ClusterTag[]>>({});
  const [savingTags, setSavingTags] = useState(false);

  const dispatch = useAppDispatch();
  const {
    addConfigResponse,
    error
  } = useAppSelector((state) => state.addConfig);

  useEffect(() => {
    if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(fetchClusters());
      dispatch(resetAddConfig());
      setStatesToDefault(false);
    } else if (addConfigResponse.message) {
      handleAddConfigSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addConfigResponse, error, dispatch]);

  const handleAddConfigSuccess = async () => {
    toast.success("Success", {
      description: addConfigResponse.message,
    });
    dispatch(resetAddConfig());

    const submittedTab = submittedTabRef.current;

    if (submittedTab === "kubeconfigFile") {
      const configNameUsed = kubeconfigFileConfig.configName;
      let clusterNames: string[] = [];

      if (tagsEnabled) {
        try {
          const result = await dispatch(fetchClusters()).unwrap();
          clusterNames = Object.keys(result?.kubeConfigs?.[configNameUsed]?.clusters ?? {});
        } catch {
          clusterNames = [];
        }
      } else {
        dispatch(fetchClusters());
      }

      if (tagsEnabled && clusterNames.length > 0) {
        setPendingConfigName(configNameUsed);
        setPendingTagValues(
          clusterNames.reduce<Record<string, ClusterTag[]>>((acc, name) => {
            acc[name] = [];
            return acc;
          }, {})
        );
        setPhase("tagging");
        return;
      }

      setStatesToDefault(false);
      return;
    }

    // Bearer Token / Certificate: config + cluster identity is already known.
    dispatch(fetchClusters());
    const finalTags = tagValues.filter((t) => t.label.trim());
    if (tagsEnabled && finalTags.length > 0 && addons.clusterTags?.upsertClusterTags) {
      const configNameUsed = submittedTab === "bearerToken" ? bearerTokenConfig.configName : certificateConfig.configName;
      const clusterNameUsed = submittedTab === "bearerToken" ? bearerTokenConfig.name : certificateConfig.name;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await dispatch(addons.clusterTags.upsertClusterTags(configNameUsed, clusterNameUsed, finalTags) as any).unwrap();
      } catch {
        toast.error("Failure", {
          description: "Config saved, but the tags could not be saved. You can add them later from the table.",
        });
      }
    }
    setStatesToDefault(false);
  };

  const saveClusterTags = async () => {
    setSavingTags(true);
    const entries = Object.entries(pendingTagValues)
      .map(([clusterName, tags]) => [clusterName, tags.filter((t) => t.label.trim())] as const)
      .filter(([, tags]) => tags.length > 0);
    if (addons.clusterTags?.upsertClusterTags) {
      await Promise.all(
        entries.map(([clusterName, tags]) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dispatch(addons.clusterTags!.upsertClusterTags!(pendingConfigName, clusterName, tags) as any)
            .unwrap()
            .catch(() => null)
        )
      );
    }
    setSavingTags(false);
    setStatesToDefault(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const file = e?.target?.result;
        setTextValue(file?.toString() || '');
        setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: file?.toString() || '' });
      };
      reader.readAsText(file);
    }
  };

  const setStatesToDefault = (open: boolean) => {
    setBearerTokenConfig({
      configName: '',
      name: '',
      apiServer: '',
      token: ''
    });
    setCertificateConfig({
      configName: '',
      name: '',
      apiServer: '',
      certificate: '',
      certificateKey: '',
      tlsMode: 'system',
      caCertificate: '',
    });
    setKubeconfigFileConfig({
      configName: '',
      config: ''
    });
    setTagValues([]);
    setTextValue('');
    setPhase("form");
    setPendingConfigName("");
    setPendingTagValues({});
    setModalOpen(open);
  };

  const addNewConfig = () => {
    let route = '';
    let formData: FormData;
    submittedTabRef.current = activeTab;
    if (activeTab === 'bearerToken') {
      formData = new FormData();
      formData.append("serverIP", bearerTokenConfig.apiServer);
      formData.append("name", bearerTokenConfig.name);  // Cluster/context name
      formData.append("configName", bearerTokenConfig.configName);  // Config file identifier
      formData.append("token", bearerTokenConfig.token);
      route = KUBECONFIGS_BEARER_URL;
    } else if (activeTab === 'certificate') {
      formData = new FormData();
      formData.append("serverIP", certificateConfig.apiServer);
      formData.append("name", certificateConfig.name);  // Cluster/context name
      formData.append("configName", certificateConfig.configName);  // Config file identifier
      formData.append("clientCertData", certificateConfig.certificate);
      formData.append("clientKeyData", certificateConfig.certificateKey);
      formData.append("tlsMode", certificateConfig.tlsMode);
      if (certificateConfig.tlsMode === 'custom' && certificateConfig.caCertificate) {
        formData.append("caCertData", certificateConfig.caCertificate);
      }
      route = KUBECONFIGS_CERTIFICATE_URL;
    } else {
      formData = new FormData();
      formData.append("file", kubeconfigFileConfig.config);
      formData.append("configName", kubeconfigFileConfig.configName);  // Config file identifier
      route = KUBECONFIGS_URL;
    }
    dispatch(addConfig({ formData, route }));
  };

  const isDisabled = () => {
    if (activeTab === "bearerToken") {
      return !bearerTokenConfig.apiServer ||
             !bearerTokenConfig.name ||
             !bearerTokenConfig.configName ||
             isConfigNameInvalid(bearerTokenConfig.configName) ||
             !bearerTokenConfig.token;
    }
    if (activeTab === "certificate") {
      const baseValidation = !certificateConfig.apiServer ||
             !certificateConfig.name ||
             !certificateConfig.configName ||
             isConfigNameInvalid(certificateConfig.configName) ||
             !certificateConfig.certificate ||
             !certificateConfig.certificateKey;
      const caCertRequired = certificateConfig.tlsMode === 'custom' && !certificateConfig.caCertificate;
      return baseValidation || caCertRequired;
    }
    return !kubeconfigFileConfig.config ||
           !kubeconfigFileConfig.configName ||
           isConfigNameInvalid(kubeconfigFileConfig.configName);
  };

  return (
    <Dialog open={modalOpen} onOpenChange={setStatesToDefault}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-0">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            Add Config
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
            {phase === "form" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Add Config</DialogTitle>
                  <DialogDescription>
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                  <div className="grid flex-1 gap-2">
                    <Tabs defaultValue={activeTab} onValueChange={(value: string) => setActiveTab(value)}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="bearerToken">Bearer Token</TabsTrigger>
                        <TabsTrigger value="certificate">Certificate</TabsTrigger>
                        <TabsTrigger value="kubeconfigFile">kubeconfig file</TabsTrigger>
                      </TabsList>
                      <TabsContent value="bearerToken">
                        <div className="space-y-1">
                          <Label htmlFor="bearerTokenName">Cluster Name *</Label>
                          <Input
                            id="bearerTokenName"
                            placeholder="production"
                            value={bearerTokenConfig.name}
                            className="shadow-none"
                            onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, name: e.target.value || '' })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Name for the cluster/context in the kubeconfig YAML
                          </p>
                        </div>
                        <ConfigNameInput
                          id="bearerTokenConfigName"
                          value={bearerTokenConfig.configName}
                          onChange={(value) => setBearerTokenConfig({ ...bearerTokenConfig, configName: value })}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="bearerTokenApiServer">API Server *</Label>
                          <Input
                            id="bearerTokenApiServer"
                            className="shadow-none"
                            placeholder="https://127.0.0.1:8731"
                            value={bearerTokenConfig.apiServer}
                            onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, apiServer: e.target.value || '' })}
                          />
                        </div>
                        <div className="space-y-1 mt-2">
                          <Label htmlFor="bearerToken">Bearer Token *</Label>
                          <Textarea
                            id="bearerToken"
                            rows={6}
                            className="shadow-none"
                            placeholder="Bearer {token}"
                            value={bearerTokenConfig.token}
                            onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, token: e.target.value || '' })}
                          />
                        </div>
                        {tagsEnabled && ClusterTagListEditor && (
                          <div className="mt-2">
                            <ClusterTagListEditor value={tagValues} onChange={setTagValues} idPrefix="bearer-cluster-tag" layout="inline" />
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="certificate">
                        <div className="space-y-1">
                          <Label htmlFor="certificateName">Cluster Name *</Label>
                          <Input
                            id="certificateName"
                            placeholder="production"
                            value={certificateConfig.name}
                            className="shadow-none"
                            onChange={(e) => setCertificateConfig({ ...certificateConfig, name: e.target.value || '' })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Name for the cluster/context in the kubeconfig YAML
                          </p>
                        </div>
                        <ConfigNameInput
                          id="certificateConfigName"
                          value={certificateConfig.configName}
                          onChange={(value) => setCertificateConfig({ ...certificateConfig, configName: value })}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="certificateApiServer">API Server *</Label>
                          <Input
                            id="certificateApiServer"
                            className="shadow-none"
                            placeholder="https://127.0.0.1:8731"
                            value={certificateConfig.apiServer}
                            onChange={(e) => setCertificateConfig({ ...certificateConfig, apiServer: e.target.value || '' })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="certificateCertificate">Certificate *</Label>
                          <Textarea
                            id="certificateCertificate"
                            placeholder={`----- BEGIN CERTIFICATE -----\r\n----- END CERTIFICATE -----`}
                            className="shadow-none"
                            value={certificateConfig.certificate}
                            onChange={(e) => setCertificateConfig({ ...certificateConfig, certificate: e.target.value || '' })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="certificateCertificateKey">Certificate Key *</Label>
                          <Textarea id="certificateCertificateKey"
                            placeholder={`----- BEGIN RSA PRIVATE KEY -----\r\n----- END CERTIFICATE -----`}
                            className="shadow-none"
                            value={certificateConfig.certificateKey}
                            onChange={(e) => setCertificateConfig({ ...certificateConfig, certificateKey: e.target.value || '' })}
                          />
                        </div>
                        <div className="space-y-1 mt-2">
                          <Label htmlFor="tlsMode">TLS Verification</Label>
                          <Select
                            value={certificateConfig.tlsMode}
                            onValueChange={(value) => setCertificateConfig({
                              ...certificateConfig,
                              tlsMode: value as 'system' | 'custom' | 'insecure'
                            })}
                          >
                            <SelectTrigger className="shadow-none">
                              <SelectValue placeholder="Select TLS mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="system">Use system certificates</SelectItem>
                              <SelectItem value="custom">Use custom CA certificate</SelectItem>
                              <SelectItem value="insecure">Skip verification (insecure)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {certificateConfig.tlsMode === 'insecure' && (
                          <p className="text-yellow-600 text-sm mt-2">
                            Warning: Disables server certificate verification. Only use for development or trusted networks.
                          </p>
                        )}
                        {certificateConfig.tlsMode === 'custom' && (
                          <div className="space-y-1 mt-2">
                            <Label htmlFor="caCertificate">CA Certificate</Label>
                            <Textarea
                              id="caCertificate"
                              placeholder={`----- BEGIN CERTIFICATE -----\r\n----- END CERTIFICATE -----`}
                              className="shadow-none"
                              value={certificateConfig.caCertificate}
                              onChange={(e) => setCertificateConfig({
                                ...certificateConfig,
                                caCertificate: e.target.value || ''
                              })}
                            />
                          </div>
                        )}
                        {tagsEnabled && ClusterTagListEditor && (
                          <div className="mt-2">
                            <ClusterTagListEditor value={tagValues} onChange={setTagValues} idPrefix="certificate-cluster-tag" layout="inline" />
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="kubeconfigFile">
                        <ConfigNameInput
                          id="kubeconfigConfigName"
                          value={kubeconfigFileConfig.configName}
                          onChange={(value) => setKubeconfigFileConfig({ ...kubeconfigFileConfig, configName: value })}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="kubeconfigFile">File *</Label>
                          <Input
                            id="kubeconfigFile"
                            type='file'
                            className='shadow-none'
                            onChange={handleChange}
                          />
                        </div>
                        <div className="space-y-1 mt-1">
                          <Textarea id="kubeconfig"
                            rows={8}
                            className="shadow-none"
                            placeholder="Select the config file or directly paste your config here"
                            value={textValue}
                            onChange={(e) => {
                              setTextValue(e.target.value || '');
                              setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: e.target.value || '' });
                            }}
                          />
                        </div>
                        {tagsEnabled && (
                          <p className="text-xs text-muted-foreground mt-2">
                            You'll be able to tag each cluster found in this file after it's added.
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
                <DialogFooter className="sm:flex-col">
                  <Button
                    type="submit"
                    onClick={addNewConfig}
                    disabled={isDisabled()}
                  >Save</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Tag Your Clusters</DialogTitle>
                  <DialogDescription>
                    Optionally tag the clusters found in &quot;{pendingConfigName}&quot;. You can also do this later from the table.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {Object.keys(pendingTagValues).map((clusterName) => (
                    <div key={clusterName} className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">{clusterName}</p>
                      {ClusterTagListEditor && (
                        <ClusterTagListEditor
                          value={pendingTagValues[clusterName]}
                          onChange={(value) => setPendingTagValues((prev) => ({ ...prev, [clusterName]: value }))}
                          idPrefix={`kubeconfig-cluster-tag-${clusterName}`}
                          layout="inline"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatesToDefault(false)} disabled={savingTags}>
                    Skip
                  </Button>
                  <Button onClick={saveClusterTags} disabled={savingTags}>
                    {savingTags ? 'Saving…' : 'Save tags'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
    </Dialog>
  );
};

export {
  AddConfig
};
