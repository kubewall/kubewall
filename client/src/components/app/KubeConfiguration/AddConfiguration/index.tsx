import { BearerTokenConfig, CertificateConfig, KubeconfigFileConfig } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KUBECONFIGS_BEARER_URL, KUBECONFIGS_CERTIFICATE_URL, KUBECONFIGS_URL, KUBECONFIGS_VALIDATE_BEARER_URL, KUBECONFIGS_VALIDATE_CERTIFICATE_URL } from "@/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addConfig, resetAddConfig } from "@/data/KwClusters/AddConfigSlice";
import { validateConfig, resetValidateConfig } from "@/data/KwClusters/ValidateConfigSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircledIcon, CheckCircledIcon, CrossCircledIcon, ReloadIcon, ArrowUpIcon } from "@radix-ui/react-icons";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface FileUploadResult {
  filename: string;
  success: boolean;
  message: string;
  configId?: string;
}

const AddConfig = () => {

  const [textValue, setTextValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [bearerTokenConfig, setBearerTokenConfig] = useState<BearerTokenConfig>({} as BearerTokenConfig);
  const [certificateConfig, setCertificateConfig] = useState<CertificateConfig>({} as CertificateConfig);
  const [kubeconfigFileConfig, setKubeconfigFileConfig] = useState<KubeconfigFileConfig>({} as KubeconfigFileConfig);
  const [activeTab, setActiveTab] = useState("bearerToken");
  const [validationPerformed, setValidationPerformed] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<FileUploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dispatch = useAppDispatch();
  
  const {
    addConfigResponse,
    error
  } = useAppSelector((state) => state.addConfig);

  const {
    validationResponse,
    error: validationError,
    loading: validationLoading
  } = useAppSelector((state) => state.validateConfig);

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

  useEffect(() => {
    if (validationError) {
      toast.error("Validation Failed", {
        description: validationError.error,
      });
      dispatch(resetValidateConfig());
    }
  }, [validationError, dispatch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    
    // If only one file is selected, also populate the text area for validation
    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e?.target?.result;
        setTextValue(fileContent?.toString() || '');
        setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: fileContent?.toString() || '' });
        setValidationPerformed(false);
      };
      reader.readAsText(file);
    } else {
      // Clear text area for multiple files
      setTextValue('');
      setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: '' });
      setValidationPerformed(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.name.endsWith('.yaml') || 
      file.name.endsWith('.yml') || 
      file.name.endsWith('.kubeconfig') ||
      file.name.endsWith('-kubeconfig')
    );
    
    if (files.length > 0) {
      setSelectedFiles(files);
      
      // If only one file is selected, also populate the text area for validation
      if (files.length === 1) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileContent = e?.target?.result;
          setTextValue(fileContent?.toString() || '');
          setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: fileContent?.toString() || '' });
          setValidationPerformed(false);
        };
        reader.readAsText(file);
      } else {
        // Clear text area for multiple files
        setTextValue('');
        setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: '' });
        setValidationPerformed(false);
      }
    }
  };



  const setStatesToDefault = (open: boolean) => {
    setBearerTokenConfig({} as BearerTokenConfig);
    setCertificateConfig({} as CertificateConfig);
    setKubeconfigFileConfig({} as KubeconfigFileConfig);
    setTextValue('');
    setValidationPerformed(false);
    setSelectedFiles([]);
    setUploadResults([]);
    setIsUploading(false);
    setIsDragOver(false);
    setModalOpen(open);
    dispatch(resetValidateConfig());
  };

  const validateKubeconfig = () => {
    if (!kubeconfigFileConfig.config) {
      toast.error("No kubeconfig content to validate");
      return;
    }

    const formData = new FormData();
    formData.append("file", kubeconfigFileConfig.config);
    
    dispatch(validateConfig({ formData }));
    setValidationPerformed(true);
  };

  const validateBearerToken = () => {
    if (!bearerTokenConfig.apiServer || !bearerTokenConfig.name || !bearerTokenConfig.token) {
      toast.error("Please fill in all required fields for bearer token validation");
      return;
    }

    const formData = new FormData();
    formData.append("name", bearerTokenConfig.name);
    formData.append("serverIP", bearerTokenConfig.apiServer);
    formData.append("token", bearerTokenConfig.token);
    
    dispatch(validateConfig({ formData, url: KUBECONFIGS_VALIDATE_BEARER_URL }));
    setValidationPerformed(true);
  };

  const validateCertificate = () => {
    if (!certificateConfig.apiServer || !certificateConfig.name || !certificateConfig.certificate || !certificateConfig.certificateKey) {
      toast.error("Please fill in all required fields for certificate validation");
      return;
    }

    const formData = new FormData();
    formData.append("name", certificateConfig.name);
    formData.append("serverIP", certificateConfig.apiServer);
    formData.append("clientCertData", certificateConfig.certificate);
    formData.append("clientKeyData", certificateConfig.certificateKey);
    
    dispatch(validateConfig({ formData, url: KUBECONFIGS_VALIDATE_CERTIFICATE_URL }));
    setValidationPerformed(true);
  };

  const uploadMultipleKubeconfigs = async () => {
    if (selectedFiles.length === 0) {
      toast.error("No files selected");
      return;
    }

    setIsUploading(true);
    setUploadResults([]);

    const results: FileUploadResult[] = [];
    const validFiles: { file: File; content: string }[] = [];

    // Step 1: Validate all kubeconfigs
    for (const file of selectedFiles) {
      try {
        const fileContent = await readFileAsText(file);
        
        // Validate the kubeconfig
        const validateFormData = new FormData();
        validateFormData.append("file", fileContent);
        
        const validateResponse = await fetch(`/api/v1/app/config/validate`, {
          method: 'POST',
          body: validateFormData,
        });

        const validateResult = await validateResponse.json();

        if (validateResponse.ok && validateResult.hasReachableClusters) {
          // Validation passed, add to valid files list
          validFiles.push({ file, content: fileContent });
          results.push({
            filename: file.name,
            success: true,
            message: 'Validation passed',
            configId: undefined
          });
        } else {
          // Validation failed
          results.push({
            filename: file.name,
            success: false,
            message: validateResult.error || 'Validation failed - no reachable clusters'
          });
        }
      } catch (error) {
        results.push({
          filename: file.name,
          success: false,
          message: error instanceof Error ? error.message : 'Validation failed'
        });
      }
    }

    // Step 2: Upload only valid kubeconfigs
    const uploadResults: FileUploadResult[] = [];
    
    for (const { file, content } of validFiles) {
      try {
        const formData = new FormData();
        formData.append("file", content);
        formData.append("filename", file.name);

        const response = await fetch(`/api/v1/app/config/kubeconfigs`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          uploadResults.push({
            filename: file.name,
            success: true,
            message: result.message || 'Upload successful',
            configId: result.id
          });
        } else {
          uploadResults.push({
            filename: file.name,
            success: false,
            message: result.error || 'Upload failed'
          });
        }
      } catch (error) {
        uploadResults.push({
          filename: file.name,
          success: false,
          message: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }

    // Combine validation and upload results
    const finalResults = results.map(result => {
      if (result.success) {
        // Find corresponding upload result
        const uploadResult = uploadResults.find(u => u.filename === result.filename);
        return uploadResult || result;
      }
      return result;
    });

    setUploadResults(finalResults);
    setIsUploading(false);

    // Show summary toast
    const successCount = finalResults.filter(r => r.success).length;
    const failureCount = finalResults.length - successCount;
    const validationFailedCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} kubeconfig${successCount > 1 ? 's' : ''}`);
      // Close the dialog if any files were uploaded successfully
      setStatesToDefault(false);
    }
    
    if (validationFailedCount > 0) {
      toast.error(`${validationFailedCount} kubeconfig${validationFailedCount > 1 ? 's' : ''} failed validation`);
    }
    
    if (failureCount > successCount) {
      toast.error(`${failureCount - successCount} kubeconfig${failureCount - successCount > 1 ? 's' : ''} failed to upload`);
    }

    // Refresh clusters list
    dispatch(fetchClusters());
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const addNewConfig = () => {
    let route = '';
    let formData: FormData;
    if (activeTab === 'bearerToken') {
      // For bearer token, check if validation was performed and clusters are reachable
      if (!validationPerformed) {
        toast.error("Please validate the bearer token configuration first");
        return;
      }
      
      if (!validationResponse?.hasReachableClusters) {
        toast.error("Cannot add bearer token configuration: Cluster not reachable");
        return;
      }

      formData = new FormData();
      formData.append("serverIP", bearerTokenConfig.apiServer);
      formData.append("name", bearerTokenConfig.name);
      formData.append("token", bearerTokenConfig.token);
      route = KUBECONFIGS_BEARER_URL;
    } else if (activeTab === 'certificate') {
      // For certificate, check if validation was performed and clusters are reachable
      if (!validationPerformed) {
        toast.error("Please validate the certificate configuration first");
        return;
      }
      
      if (!validationResponse?.hasReachableClusters) {
        toast.error("Cannot add certificate configuration: Cluster not reachable");
        return;
      }

      formData = new FormData();
      formData.append("serverIP", certificateConfig.apiServer);
      formData.append("clientCertData", certificateConfig.certificate);
      formData.append("clientKeyData", certificateConfig.certificateKey);
      formData.append("name", certificateConfig.name);
      route = KUBECONFIGS_CERTIFICATE_URL;
    } else {
      // For kubeconfig file, check if validation was performed and clusters are reachable
      if (!validationPerformed) {
        toast.error("Please validate the kubeconfig first");
        return;
      }
      
      if (!validationResponse?.hasReachableClusters) {
        toast.error("Cannot add kubeconfig: No reachable clusters found");
        return;
      }

      formData = new FormData();
      formData.append("file", kubeconfigFileConfig.config);
      route = KUBECONFIGS_URL;
    }
    dispatch(addConfig({ formData, route }));
  };



  const isAddDisabled = () => {
    if (activeTab === "bearerToken") {
      return !bearerTokenConfig.apiServer || !bearerTokenConfig.name || checkForValidConfigName(bearerTokenConfig.name) || !bearerTokenConfig.token || !validationPerformed || !validationResponse?.hasReachableClusters;
    }
    if (activeTab === "certificate") {
      return !certificateConfig.apiServer || !certificateConfig.certificate || !certificateConfig.certificateKey || !certificateConfig.name || checkForValidConfigName(certificateConfig.name) || !validationPerformed || !validationResponse?.hasReachableClusters;
    }
    return !kubeconfigFileConfig.config || !validationPerformed || !validationResponse?.hasReachableClusters;
  };

  const checkForValidConfigName = (name: string) => {
    const regex = /^[a-zA-Z0-9._-]+$/;
    return !regex.test(name);
  };

  const renderClusterStatus = () => {
    if (!validationPerformed || !validationResponse) return null;

    return (
      <div className="mt-4 p-3 border rounded-md bg-muted/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Cluster Status:</span>
          {validationResponse.hasReachableClusters ? (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircledIcon className="w-3 h-3 mr-1" />
              Reachable
            </Badge>
          ) : (
            <Badge variant="destructive">
              <CrossCircledIcon className="w-3 h-3 mr-1" />
              Not Reachable
            </Badge>
          )}
        </div>
                 {validationResponse.clusterStatus && Object.keys(validationResponse.clusterStatus).length > 0 && (
           <div className="space-y-1">
             {Object.entries(validationResponse.clusterStatus).map(([contextName, status]) => (
               <div key={contextName} className="flex items-center gap-2 text-xs">
                 <span className={cn(
                   "w-2 h-2 rounded-full",
                   status.reachable ? "bg-green-500" : "bg-red-500"
                 )} />
                 <span>{contextName}</span>
                 {!status.reachable && status.error && (
                   <span className="text-red-600">({status.error})</span>
                 )}
               </div>
             ))}
           </div>
         )}
      </div>
    );
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="ml-auto">
        <Dialog open={modalOpen} onOpenChange={setStatesToDefault}>
          <DialogTrigger asChild>
            <Button className="gap-0">
              <PlusCircledIcon className="mr-2 h-4 w-4" />
              Add Config
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                    <TabsTrigger value="kubeconfigFile">Kubeconfig File</TabsTrigger>
                  </TabsList>
                  <TabsContent value="bearerToken">
                    <div className="space-y-1">
                      <Label htmlFor="bearerTokenName">Name</Label>
                      <Input
                        id="bearerTokenName"
                        className="shadow-none"
                        placeholder="Enter config name"
                        value={bearerTokenConfig.name}
                        onChange={(e) => setBearerTokenConfig({ ...bearerTokenConfig, name: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1 mt-2">
                      <Label htmlFor="bearerTokenServer">API Server</Label>
                      <Input
                        id="bearerTokenServer"
                        className="shadow-none"
                        placeholder="https://api.example.com:6443"
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
                    <div className="flex justify-end mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={validateBearerToken}
                        disabled={!bearerTokenConfig.apiServer || !bearerTokenConfig.name || !bearerTokenConfig.token || checkForValidConfigName(bearerTokenConfig.name)}
                        className="gap-2"
                      >
                        {validationLoading ? (
                          <ReloadIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircledIcon className="h-4 w-4" />
                        )}
                        Validate
                      </Button>
                    </div>
                    
                    {renderClusterStatus()}
                  </TabsContent>
                  <TabsContent value="certificate">
                    <div className="space-y-1">
                      <Label htmlFor="certificateName">Name</Label>
                      <Input
                        id="certificateName"
                        className="shadow-none"
                        placeholder="Enter config name"
                        value={certificateConfig.name}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, name: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1 mt-2">
                      <Label htmlFor="certificateServer">API Server</Label>
                      <Input
                        id="certificateServer"
                        className="shadow-none"
                        placeholder="https://api.example.com:6443"
                        value={certificateConfig.apiServer}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, apiServer: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1 mt-2">
                      <Label htmlFor="certificate">Certificate</Label>
                      <Textarea
                        id="certificate"
                        rows={6}
                        placeholder={`----- BEGIN CERTIFICATE -----\r\n----- END CERTIFICATE -----`}
                        className="shadow-none"
                        value={certificateConfig.certificate}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, certificate: e.target.value || '' })}
                      />
                    </div>
                    <div className="space-y-1 mt-2">
                      <Label htmlFor="certificateKey">Certificate Key</Label>
                      <Textarea
                        id="certificateKey"
                        rows={6}
                        placeholder={`----- BEGIN RSA PRIVATE KEY -----\r\n----- END CERTIFICATE -----`}
                        className="shadow-none"
                        value={certificateConfig.certificateKey}
                        onChange={(e) => setCertificateConfig({ ...certificateConfig, certificateKey: e.target.value || '' })}
                      />
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={validateCertificate}
                        disabled={!certificateConfig.apiServer || !certificateConfig.name || !certificateConfig.certificate || !certificateConfig.certificateKey || checkForValidConfigName(certificateConfig.name)}
                        className="gap-2"
                      >
                        {validationLoading ? (
                          <ReloadIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircledIcon className="h-4 w-4" />
                        )}
                        Validate
                      </Button>
                    </div>
                    
                    {renderClusterStatus()}
                  </TabsContent>
                  <TabsContent value="kubeconfigFile">
                    <div className="space-y-1">
                      <Label htmlFor="kubeconfigFile">Files</Label>
                      <div 
                        className={cn(
                          "border-2 border-dashed rounded-lg p-4 transition-colors",
                          isDragOver 
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                            : "border-gray-300 dark:border-gray-600"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Input
                            id="kubeconfigFile"
                            type='file'
                            multiple
                            accept=".yaml,.yml,.kubeconfig,-kubeconfig"
                            className='shadow-none flex-1'
                            onChange={handleFileChange}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('kubeconfigFile')?.click()}
                          >
                            Browse Files
                          </Button>
                          {selectedFiles.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedFiles([]);
                                setTextValue('');
                                setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: '' });
                                setValidationPerformed(false);
                              }}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Drag and drop kubeconfig files here, or click Browse Files
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Hold Cmd (Mac) or Ctrl (Windows/Linux) to select multiple files
                        </p>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground mb-2">
                            Selected {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}:
                          </p>
                          <div className="space-y-1">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <span className="text-blue-600">{file.name}</span>
                                <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedFiles.length === 1 && (
                      <div className="space-y-1 mt-1">
                        <Textarea id="kubeconfig"
                          rows={8}
                          className="shadow-none"
                          placeholder="Select the config file or directly paste your config here"
                          value={textValue}
                          onChange={(e) => {
                            setTextValue(e.target.value || '');
                            setKubeconfigFileConfig({ ...kubeconfigFileConfig, config: e.target.value || '' });
                            setValidationPerformed(false);
                          }}
                        />
                      </div>
                    )}
                    
                    {selectedFiles.length === 1 && kubeconfigFileConfig.config && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={validateKubeconfig}
                          disabled={validationLoading}
                        >
                          {validationLoading ? (
                            <>
                              <ReloadIcon className="w-3 h-3 mr-1 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            <>
                              <CheckCircledIcon className="w-3 h-3 mr-1" />
                              Validate Kubeconfig
                            </>
                          )}
                        </Button>
                        {validationPerformed && validationResponse && (
                          <span className="text-xs text-muted-foreground">
                            {validationResponse.hasReachableClusters ? '✓ Valid' : '✗ Invalid'}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {selectedFiles.length > 1 && (
                      <div className="mt-4">
                        <Button
                          type="button"
                          onClick={uploadMultipleKubeconfigs}
                          disabled={isUploading}
                          className="w-full"
                        >
                          {isUploading ? (
                            <>
                              <ReloadIcon className="w-4 h-4 mr-2 animate-spin" />
                              Validating & Uploading {selectedFiles.length} files...
                            </>
                          ) : (
                            <>
                              <ArrowUpIcon className="w-4 h-4 mr-2" />
                              Validate & Upload {selectedFiles.length} Kubeconfig{selectedFiles.length > 1 ? 's' : ''}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {uploadResults.length > 0 && (
                      <div className="mt-4 p-3 border rounded-md bg-muted/50">
                        <h4 className="text-sm font-medium mb-2">Validation & Upload Results:</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {uploadResults.map((result, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              {result.success ? (
                                <CheckCircledIcon className="w-4 h-4 text-green-600" />
                              ) : (
                                <CrossCircledIcon className="w-4 h-4 text-red-600" />
                              )}
                              <span className="font-mono text-xs">{result.filename}</span>
                              <span className={result.success ? "text-green-600" : "text-red-600"}>
                                {result.message}
                              </span>
                              {result.configId && (
                                <span className="text-xs text-muted-foreground">
                                  (ID: {result.configId})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-xs text-muted-foreground">
                            {uploadResults.filter(r => r.success).length} of {uploadResults.length} files processed successfully
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {selectedFiles.length === 1 && renderClusterStatus()}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <DialogFooter className="sm:flex-col">
              {activeTab === 'kubeconfigFile' && selectedFiles.length === 1 ? (
                <Button
                  type="submit"
                  onClick={addNewConfig}
                  disabled={isAddDisabled()}
                >Save</Button>
              ) : activeTab !== 'kubeconfigFile' ? (
                <Button
                  type="submit"
                  onClick={addNewConfig}
                  disabled={isAddDisabled()}
                >Save</Button>
              ) : null}
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