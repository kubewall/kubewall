import { BearerTokenConfig, CertificateConfig, KubeconfigFileConfig } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KUBECONFIGS_BEARER_URL, KUBECONFIGS_CERTIFICATE_URL, KUBECONFIGS_URL } from "@/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addConfig, resetAddConfig } from "@/data/KwClusters/AddConfigSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { toast } from "sonner";

const AddConfig = () => {

  const [textValue, setTextValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [bearerTokenConfig, setBearerTokenConfig] = useState<BearerTokenConfig>({} as BearerTokenConfig);
  const [certificateConfig, setCertificateConfig] = useState<CertificateConfig>({} as CertificateConfig);
  const [kubeconfigFileConfig, setKubeconfigFileConfig] = useState<KubeconfigFileConfig>({} as KubeconfigFileConfig);
  const [activeTab, setActiveTab] = useState("bearerToken");
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
      toast.success("Success", {
        description: addConfigResponse.message,
      });
      dispatch(fetchClusters());
      dispatch(resetAddConfig());
      setStatesToDefault(false);
    }
  }, [addConfigResponse, error, dispatch]);

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
    setBearerTokenConfig({} as BearerTokenConfig);
    setCertificateConfig({} as CertificateConfig);
    setKubeconfigFileConfig({} as KubeconfigFileConfig);
    setTextValue('');
    setModalOpen(open);
  };

  const addNewConfig = () => {
    let route = '';
    let formData: FormData;
    if (activeTab === 'bearerToken') {
      formData = new FormData();
      formData.append("serverIP", bearerTokenConfig.apiServer);
      formData.append("name", bearerTokenConfig.name);
      formData.append("token", bearerTokenConfig.token);
      route = KUBECONFIGS_BEARER_URL;
    } else if (activeTab === 'certificate') {
      formData = new FormData();
      formData.append("serverIP", certificateConfig.apiServer);
      formData.append("clientCertData", certificateConfig.certificate);
      formData.append("clientKeyData", certificateConfig.certificateKey);
      formData.append("name", certificateConfig.name);
      route = KUBECONFIGS_CERTIFICATE_URL;
    } else {
      formData = new FormData();
      formData.append("file", kubeconfigFileConfig.config);
      route = KUBECONFIGS_URL;
    }
    dispatch(addConfig({ formData, route }));
  };

  const isDisabled = () => {
    if (activeTab === "bearerToken") {
      return !bearerTokenConfig.apiServer || !bearerTokenConfig.name || checkForValidConfigName(bearerTokenConfig.name) || !bearerTokenConfig.token;
    }
    if (activeTab === "certificate") {
      return !certificateConfig.apiServer || !certificateConfig.certificate || !certificateConfig.certificateKey || !certificateConfig.name || checkForValidConfigName(certificateConfig.name);
    }
    return !kubeconfigFileConfig.config;
  };

  const checkForValidConfigName = (name: string) => {
    const regex = /^[a-zA-Z0-9-]+$/;
    return (!regex.test(name));
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="ml-auto">
        <Dialog open={modalOpen} onOpenChange={setStatesToDefault}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircledIcon className="mr-2 h-4 w-4" />
              Add Config
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                      <Label htmlFor="bearerTokenName">Name</Label>
                      <Input
                        id="bearerTokenName"
                        placeholder="Config name"
                        value={bearerTokenConfig.name}
                        className={cn('shadow-none', bearerTokenConfig.name && checkForValidConfigName(bearerTokenConfig.name) && 'border-red-500 focus-visible:ring-red-500')}
                        onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, name: e.target.value || '' })}
                      />
                      {
                        bearerTokenConfig.name && checkForValidConfigName(bearerTokenConfig.name) &&
                        <p className="text-red-500 text-sm">Name must be alphanumeric and can include hyphens (-).</p>
                      }
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bearerTokenApiServer">API Server</Label>
                      <Input
                        id="bearerTokenApiServer"
                        className="shadow-none"
                        placeholder="https://127.0.0.1:8731"
                        value={bearerTokenConfig.apiServer}
                        onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, apiServer: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1 mt-2">
                      <Label htmlFor="bearerToken">Bearer Token</Label>
                      <Textarea
                        id="bearerToken"
                        rows={6}
                        className="shadow-none"
                        placeholder="Bearer {token}"
                        value={bearerTokenConfig.token}
                        onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, token: e.target.value || '' })}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="certificate">
                    <div className="space-y-1">
                      <Label htmlFor="certificateName">Name</Label>
                      <Input
                        id="certificateName"
                        placeholder="Config name"
                        value={certificateConfig.name}
                        className={cn('shadow-none', bearerTokenConfig.name && checkForValidConfigName(certificateConfig.name) && 'border-red-500 focus-visible:ring-red-500')}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, name: e.target.value || '' })}
                      />
                      {
                        bearerTokenConfig.name && checkForValidConfigName(certificateConfig.name) &&
                        <p className="text-red-500 text-sm">Name must be alphanumeric and can include hyphens (-).</p>
                      }
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="certificateApiServer">API Server</Label>
                      <Input
                        id="certificateApiServer"
                        className="shadow-none"
                        placeholder="https://127.0.0.1:8731"
                        value={certificateConfig.apiServer}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, apiServer: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="certificateCertificate">Certificate</Label>
                      <Textarea
                        id="certificateCertificate"
                        placeholder={`----- BEGIN CERTIFICATE -----\r\n----- END CERTIFICATE -----`}
                        className="shadow-none"
                        value={certificateConfig.certificate}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, certificate: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="certificateCertificateKey">Certificate Key</Label>
                      <Textarea id="certificateCertificateKey"
                        placeholder={`----- BEGIN RSA PRIVATE KEY -----\r\n----- END CERTIFICATE -----`}
                        className="shadow-none"
                        value={certificateConfig.certificateKey}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, certificateKey: e.target.value || '' })}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="kubeconfigFile">
                    <div className="space-y-1">
                      <Label htmlFor="kubeconfigFile">File</Label>
                      <Input
                        id="kubeconfigFile"
                        type='file'
                        className='shadow-none'
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-1 mt-1">
                      <Textarea id="kubeconfig"
                        rows={11}
                        className="shadow-none"
                        placeholder="Select the config file or directly paste your config here"
                        value={textValue}
                        onChange={(e) => {
                          setTextValue(e.target.value || '');
                          setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: e.target.value || '' });
                        }}
                      />
                    </div>
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
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export {
  AddConfig
};