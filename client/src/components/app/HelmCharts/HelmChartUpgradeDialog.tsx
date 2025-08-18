import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { upgradeHelmRelease } from '@/data/Helm/HelmActionsSlice';
import { HelmRelease, HelmChartVersion } from '@/types/helm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Editor } from '@monaco-editor/react';
import { 
  UpdateIcon, 
  ReloadIcon,
  InfoCircledIcon,
  GearIcon,
  FileTextIcon
} from '@radix-ui/react-icons';

interface HelmChartUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: HelmRelease | null;
  clusterName: string;
  configName: string;
}

interface UpgradeForm {
  version: string;
  values: string;
}

interface ChartTemplate {
  name: string;
  content: string;
}

export function HelmChartUpgradeDialog({
  open,
  onOpenChange,
  release,
  clusterName,
  configName
}: HelmChartUpgradeDialogProps) {
  const dispatch = useAppDispatch();
  const { upgradeLoading } = useAppSelector(state => state.helmActions);
  const helmDetails = useAppSelector(state => state.helmReleaseDetails.details);
  const currentReleaseValues = helmDetails?.values || '';
  
  const [upgradeForm, setUpgradeForm] = useState<UpgradeForm>({
    version: '',
    values: ''
  });
  const [chartVersions, setChartVersions] = useState<HelmChartVersion[]>([]);
  const [chartTemplates, setChartTemplates] = useState<ChartTemplate[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingValues, setLoadingValues] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState('values');

  // Reset form when dialog opens/closes or release changes
  useEffect(() => {
    if (open && release) {
      setUpgradeForm({
        version: '',
        values: ''
      });
      fetchChartVersions();
    } else if (!open) {
      // Reset state when dialog closes
      setUpgradeForm({ version: '', values: '' });
      setChartVersions([]);
      setChartTemplates([]);
      setActiveTab('values');
    }
  }, [open, release]);

  // Fetch chart versions
  const fetchChartVersions = async () => {
    if (!release) return;
    
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/v1/helmcharts/${release.chart}/versions?cluster=${clusterName}&config=${configName}`);
      if (response.ok) {
        const versions = await response.json();
        setChartVersions(versions || []);
        // Default selection: current version; load values for current
        if (release.version) {
          setUpgradeForm(prev => ({ ...prev, version: release.version }));
          fetchChartValues(release.version);
        }
      } else {
        console.error('Failed to fetch chart versions');
        toast.error('Failed to load chart versions');
      }
    } catch (error) {
      console.error('Error fetching chart versions:', error);
      toast.error('Failed to load chart versions');
    } finally {
      setLoadingVersions(false);
    }
  };

  // Fetch chart values for a specific version
  const fetchChartValues = async (version: string) => {
    if (!release || !version) return;
    
    setLoadingValues(true);
    try {
      const response = await fetch(`/api/v1/helmcharts/${release.chart}/${version}/templates?cluster=${clusterName}&config=${configName}`);
      if (response.ok) {
        const templates = await response.json();
        const valuesTemplate = templates?.find((t: ChartTemplate) => t.name === 'values.yaml');
        if (valuesTemplate && valuesTemplate.content) {
          setUpgradeForm(prev => ({ ...prev, values: valuesTemplate.content }));
        } else if (currentReleaseValues) {
          setUpgradeForm(prev => ({ ...prev, values: currentReleaseValues }));
          toast.message('Templates unavailable', { description: 'Loaded current release values instead.' });
        }
      } else {
        // Fallback to current release values if Artifact Hub is unavailable
        if (currentReleaseValues) {
          setUpgradeForm(prev => ({ ...prev, values: currentReleaseValues }));
          toast.message('Templates unavailable', { description: 'Loaded current release values instead.' });
        }
      }
    } catch (error) {
      console.error('Error fetching chart values:', error);
      if (currentReleaseValues) {
        setUpgradeForm(prev => ({ ...prev, values: currentReleaseValues }));
        toast.message('Templates unavailable', { description: 'Loaded current release values instead.' });
      }
    } finally {
      setLoadingValues(false);
    }
  };

  // Fetch chart templates
  const fetchChartTemplates = async () => {
    if (!release || !upgradeForm.version) return;
    
    setLoadingTemplates(true);
    try {
      const response = await fetch(`/api/v1/helmcharts/${release.chart}/${upgradeForm.version}/templates?cluster=${clusterName}&config=${configName}`);
      if (response.ok) {
        const templates = await response.json();
        setChartTemplates(templates || []);
      } else {
        setChartTemplates([]);
      }
    } catch (error) {
      console.error('Error fetching chart templates:', error);
      toast.error('Failed to load chart templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Handle version change
  const handleVersionChange = (version: string) => {
    setUpgradeForm(prev => ({ ...prev, version }));
    fetchChartValues(version);
  };

  // Handle upgrade
  const handleUpgrade = async () => {
    if (!release || !upgradeForm.version) {
      toast.error('Missing required fields');
      return;
    }

    try {
      await dispatch(upgradeHelmRelease({
        config: configName,
        cluster: clusterName,
        name: release.name,
        namespace: release.namespace,
        chart: release.chart,
        version: upgradeForm.version,
        values: upgradeForm.values
      })).unwrap();
      
      toast.success('Chart upgrade started', {
        description: `${release.name} is being upgraded to version ${upgradeForm.version}`
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error upgrading chart:', error);
      toast.error('Failed to upgrade chart', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  // Load templates when templates tab is activated
  useEffect(() => {
    if (activeTab === 'templates' && release) {
      fetchChartTemplates();
    }
  }, [activeTab, release, upgradeForm.version]);

  if (!release) return null;

  // Show all versions in dropdown, marking the current one
  const availableVersions = chartVersions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UpdateIcon className="h-5 w-5" />
            Upgrade Helm Release
          </DialogTitle>
          <DialogDescription>
            Upgrade {release.name} from version {release.version} to a newer version
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Panel - Release Info & Configuration */}
            <div className="lg:col-span-1 space-y-4 overflow-y-auto">
              {/* Release Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <InfoCircledIcon className="h-4 w-4" />
                    Release Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Name:</span>
                    <span className="text-sm">{release.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Namespace:</span>
                    <span className="text-sm">{release.namespace}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Current Version:</span>
                    <Badge variant="outline" className="text-xs">{release.version}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Chart:</span>
                    <span className="text-sm">{release.chart}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={release.status === 'deployed' ? 'default' : 'destructive'} className="text-xs">
                      {release.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Upgrade Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GearIcon className="h-4 w-4" />
                    Upgrade Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="version">New Version *</Label>
                    <Select 
                      value={upgradeForm.version} 
                      onValueChange={handleVersionChange}
                      disabled={loadingVersions}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingVersions ? "Loading versions..." : "Select version"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVersions.map((version) => {
                          const isCurrent = version.version === release.version;
                          return (
                            <SelectItem key={version.version} value={version.version}>
                              <div className="flex items-center justify-between w-full">
                                <span>
                                  {version.version}
                                  {isCurrent && <span className="ml-2 text-xs text-muted-foreground">(current)</span>}
                                </span>
                                {version.created && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    ({new Date(version.created).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {availableVersions.length === 0 && !loadingVersions && (
                      <p className="text-xs text-gray-500 mt-1">
                        No newer versions available
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Values & Templates */}
            <div className="lg:col-span-2 flex flex-col overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                  <TabsTrigger value="values" className="flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    Values
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    Templates
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="values" className="flex-1 flex flex-col mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Custom Values (YAML)</Label>
                    {loadingValues && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <ReloadIcon className="h-3 w-3 animate-spin" />
                        Loading values...
                      </div>
                    )}
                  </div>
                  <div className="flex-1 border rounded-md overflow-hidden">
                    <Editor
                      value={upgradeForm.values}
                      onChange={(value) => setUpgradeForm(prev => ({ ...prev, values: value || '' }))}
                      language="yaml"
                      height="100%"
                      theme="vs-dark"
                      options={{ readOnly: false }}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="templates" className="flex-1 flex flex-col mt-4">
                  {chartTemplates.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Chart Templates</Label>
                        <Select 
                          value={selectedTemplateIndex.toString()} 
                          onValueChange={(value) => setSelectedTemplateIndex(parseInt(value))}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {chartTemplates.map((template, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 border rounded-md overflow-hidden">
                        <Editor
                          value={chartTemplates[selectedTemplateIndex]?.content || ''}
                          language="yaml"
                          height="100%"
                          theme="vs-dark"
                          options={{ readOnly: true }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                      {loadingTemplates ? (
                        <div className="flex items-center gap-2">
                          <ReloadIcon className="h-4 w-4 animate-spin" />
                          Loading templates...
                        </div>
                      ) : (
                        'No templates available'
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <Separator className="flex-shrink-0" />
        
        <div className="flex justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpgrade} 
            disabled={upgradeLoading || !upgradeForm.version}
          >
            {upgradeLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Upgrade Release
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HelmChartUpgradeDialog;