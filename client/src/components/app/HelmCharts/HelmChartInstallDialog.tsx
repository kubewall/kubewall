import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { HelmChart, HelmChartVersion } from '@/types/helm';
import Editor from '../Details/YamlEditor/MonacoWrapper';
import { 
  DownloadIcon, 
  ReloadIcon, 
  ExternalLinkIcon,
  InfoCircledIcon,
  FileTextIcon,
  GearIcon
} from '@radix-ui/react-icons';

interface HelmChartInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: HelmChart | null;
  clusterName: string;
  configName: string;
}

interface InstallForm {
  name: string;
  namespace: string;
  version: string;
  values: string;
}

interface ChartTemplate {
  name: string;
  content: string;
}

export function HelmChartInstallDialog({
  open,
  onOpenChange,
  chart,
  clusterName,
  configName
}: HelmChartInstallDialogProps) {
  const [installForm, setInstallForm] = useState<InstallForm>({
    name: '',
    namespace: 'default',
    version: '',
    values: ''
  });
  const [chartVersions, setChartVersions] = useState<HelmChartVersion[]>([]);
  const [chartTemplates, setChartTemplates] = useState<ChartTemplate[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingValues, setLoadingValues] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState('values');

  // Reset form when dialog opens/closes or chart changes
  useEffect(() => {
    if (open && chart) {
      setInstallForm({
        name: chart.name,
        namespace: 'default',
        version: '',
        values: ''
      });
      fetchChartVersions();
    } else if (!open) {
      // Reset state when dialog closes
      setInstallForm({ name: '', namespace: 'default', version: '', values: '' });
      setChartVersions([]);
      setChartTemplates([]);
      setActiveTab('values');
    }
  }, [open, chart]);

  // Fetch chart versions
  const fetchChartVersions = async () => {
    if (!chart) return;
    
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/v1/helmcharts/${chart.id}/versions?cluster=${clusterName}&config=${configName}`);
      if (response.ok) {
        const versions = await response.json();
        setChartVersions(versions || []);
        
        // Set the latest version as default
        if (versions && versions.length > 0) {
          const latestVersion = versions[0].version;
          setInstallForm(prev => ({ ...prev, version: latestVersion }));
          // Fetch values for the latest version
          fetchChartValues();
        }
      } else {
        toast.error('Failed to fetch chart versions');
      }
    } catch (error) {
      console.error('Error fetching chart versions:', error);
      toast.error('Failed to fetch chart versions');
    } finally {
      setLoadingVersions(false);
    }
  };

  // Fetch chart values for a specific version
  const fetchChartValues = async () => {
    if (!chart) return;
    
    setLoadingValues(true);
    try {
      const response = await fetch(`/api/v1/helmcharts/${chart.id}?cluster=${clusterName}&config=${configName}`);
      if (response.ok) {
        const details = await response.json();
        const defaultValues = details.default_values || '# No default values available\n# Add your custom values here\n';
        setInstallForm(prev => ({ ...prev, values: defaultValues }));
      }
    } catch (error) {
      console.error('Error fetching chart values:', error);
      setInstallForm(prev => ({ ...prev, values: '# Error loading default values\n# Add your custom values here\n' }));
    } finally {
      setLoadingValues(false);
    }
  };

  // Fetch chart templates from backend
  const fetchChartTemplates = async () => {
    if (!chart || !installForm.version) return;

    setLoadingTemplates(true);
    try {
      const response = await fetch(`/api/v1/helmcharts/${chart.id}/${installForm.version}/templates?cluster=${clusterName}&config=${configName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }
      const data = (await response.json()) as { name: string; content: string }[];
      const templates: ChartTemplate[] = Array.isArray(data)
        ? data.map((t) => ({ name: t.name, content: t.content }))
        : [];
      setChartTemplates(templates);
      setSelectedTemplateIndex(0);
    } catch (error) {
      console.error('Error fetching chart templates:', error);
      toast.error('Failed to fetch chart templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Handle version change
  const handleVersionChange = (version: string) => {
    setInstallForm(prev => ({ ...prev, version }));
    fetchChartValues();
    if (activeTab === 'templates') {
      fetchChartTemplates();
    }
  };

  // Handle chart installation
  const handleInstallChart = async () => {
    if (!chart) return;

    if (!installForm.name.trim()) {
      toast.error('Release name is required');
      return;
    }

    if (!installForm.version.trim()) {
      toast.error('Version is required');
      return;
    }

    setInstalling(true);
    try {
      const installData = {
        name: installForm.name,
        namespace: installForm.namespace,
        chart: chart.name,
        repository: chart.repository.url,
        version: installForm.version,
        values: installForm.values
      };

      const response = await fetch(`/api/v1/helmcharts/install?cluster=${clusterName}&config=${configName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(installData)
      });

      if (!response.ok) {
        // Try to extract structured error from backend
        let message = `Installation failed: ${response.statusText}`;
        try {
          const data = await response.json();
          if (data?.details) message = data.details as string;
          else if (data?.error) message = data.error as string;
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      toast.success('Chart installation started', {
        description: data?.message || `${installForm.name} is being installed in ${installForm.namespace}`
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error installing chart:', error);
      toast.error('Failed to install chart', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setInstalling(false);
    }
  };

  // Load templates when templates tab is activated
  useEffect(() => {
    if (activeTab === 'templates' && chart) {
      fetchChartTemplates();
    }
  }, [activeTab, chart, installForm.version]);

  if (!chart) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DownloadIcon className="h-5 w-5" />
            Install Helm Chart
          </DialogTitle>
          <DialogDescription>
            Configure and install {chart.name} chart to your cluster
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Panel - Chart Info & Configuration */}
            <div className="lg:col-span-1 space-y-4 overflow-y-auto">
              {/* Chart Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <InfoCircledIcon className="h-4 w-4" />
                    Chart Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Name:</span>
                    <span className="text-sm">{chart.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Repository:</span>
                    <Badge variant="secondary" className="text-xs">{chart.repository.name}</Badge>
                  </div>
                  {chart.appVersion && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">App Version:</span>
                      <span className="text-sm">{chart.appVersion}</span>
                    </div>
                  )}
                  {chart.home && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Homepage:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => window.open(chart.home, '_blank')}
                      >
                        <ExternalLinkIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Installation Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GearIcon className="h-4 w-4" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="release-name">Release Name *</Label>
                    <Input
                      id="release-name"
                      placeholder="my-release"
                      value={installForm.name}
                      onChange={(e) => setInstallForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="namespace">Namespace</Label>
                    <Input
                      id="namespace"
                      placeholder="default"
                      value={installForm.namespace}
                      onChange={(e) => setInstallForm(prev => ({ ...prev, namespace: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="version">Version *</Label>
                    <Select 
                      value={installForm.version} 
                      onValueChange={handleVersionChange}
                      disabled={loadingVersions}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingVersions ? "Loading versions..." : "Select version"} />
                      </SelectTrigger>
                      <SelectContent>
                        {chartVersions.map((version) => (
                          <SelectItem key={version.version} value={version.version}>
                            <div className="flex items-center justify-between w-full">
                              <span>{version.version}</span>
                              {version.created && (
                                <span className="text-xs text-gray-500 ml-2">
                                  ({new Date(version.created).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Values & Templates Editor */}
            <div className="lg:col-span-2 flex flex-col overflow-hidden min-h-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 h-[72vh]">
                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                  <TabsTrigger value="values" className="flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    Values (YAML)
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    Templates
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="values" className="flex-1 mt-4 overflow-hidden min-h-0">
                  <div className="h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <Label className="text-sm font-medium">Custom Values (YAML)</Label>
                      <div className="flex items-center gap-2">
                        {loadingValues && <ReloadIcon className="h-4 w-4 animate-spin" />}
                        <span className="text-xs text-gray-500">
                          {loadingValues ? 'Loading...' : 'Monaco Editor'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 border rounded-md overflow-hidden min-h-0">
                      <Editor
                        value={installForm.values}
                        language="yaml"
                        theme="vs-dark"
                        onChange={(value) => setInstallForm(prev => ({ ...prev, values: value || '' }))}
                        options={{
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          lineNumbers: 'on',
                          wordWrap: 'on',
                          automaticLayout: true
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="templates" className="flex-1 mt-4 overflow-hidden min-h-0">
                  <div className="h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <Label className="text-sm font-medium">Chart Templates</Label>
                      {loadingTemplates && <ReloadIcon className="h-4 w-4 animate-spin" />}
                    </div>
                    
                    {chartTemplates.length > 0 ? (
                      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                        {/* Template List */}
                        <div className="w-56 flex-shrink-0">
                          <ScrollArea className="h-[64vh] pr-2">
                            <div className="space-y-1 pb-2">
                              {chartTemplates.map((template, index) => (
                                <Button
                                  key={index}
                                  variant={selectedTemplateIndex === index ? "secondary" : "ghost"}
                                  size="sm"
                                  className="w-full justify-start text-left h-auto py-2"
                                  onClick={() => {
                                    setSelectedTemplateIndex(index);
                                  }}
                                >
                                  <FileTextIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">{template.name}</span>
                                </Button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        
                        <Separator orientation="vertical" />
                        
                        {/* Template Content */}
                        <div className="flex-1 overflow-hidden min-h-0">
                          <div className="h-[64vh] border rounded-md overflow-hidden">
                            <Editor
                              value={chartTemplates[selectedTemplateIndex]?.content || ''}
                              language="yaml"
                              theme="vs-dark"
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: true,
                                padding: { bottom: 24 },
                                fontSize: 13,
                                lineNumbers: 'on',
                                wordWrap: 'on',
                                automaticLayout: true
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <FileTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No templates available</p>
                          <p className="text-sm">Templates will be shown here when available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t flex-shrink-0">
          <div className="text-sm text-gray-500">
            Installing to cluster: <Badge variant="outline">{clusterName}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={installing}>
              Cancel
            </Button>
            <Button 
              onClick={handleInstallChart} 
              disabled={installing || !installForm.name.trim() || !installForm.version.trim()}
            >
              {installing ? (
                <>
                  <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Install Chart
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HelmChartInstallDialog;