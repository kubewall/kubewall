import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Save, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface TracingConfig {
  enabled: boolean;
  samplingRate: number;
  maxTraces: number;
  retentionHours: number;
  exportEnabled: boolean;
  jaegerEndpoint: string;
  serviceName: string;
  serviceVersion: string;
}

const TracingSettings: React.FC = () => {
  const [config, setConfig] = useState<TracingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<TracingConfig | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/tracing/config');
      if (!response.ok) {
        throw new Error('Failed to fetch tracing configuration');
      }
      const data = await response.json();
      setConfig(data);
      setOriginalConfig(JSON.parse(JSON.stringify(data)));
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const response = await fetch('/api/v1/tracing/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      setOriginalConfig(JSON.parse(JSON.stringify(updatedConfig)));
      setHasChanges(false);
      toast.success('Configuration saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)));
      setHasChanges(false);
    }
  };

  const updateConfig = (key: keyof TracingConfig, value: any) => {
    if (!config) return;
    
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(originalConfig));
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Configuration</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchConfig}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Tracing Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure OpenTelemetry tracing collection and export settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={resetConfig}>
              Reset
            </Button>
          )}
          <Button 
            onClick={saveConfig} 
            disabled={!hasChanges || saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Tracing</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable OpenTelemetry tracing collection
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => updateConfig('enabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceName">Service Name</Label>
                <Input
                  id="serviceName"
                  value={config.serviceName}
                  onChange={(e) => updateConfig('serviceName', e.target.value)}
                  placeholder="kube-dash"
                />
                <p className="text-sm text-muted-foreground">
                  Name of the service as it appears in traces
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceVersion">Service Version</Label>
                <Input
                  id="serviceVersion"
                  value={config.serviceVersion}
                  onChange={(e) => updateConfig('serviceVersion', e.target.value)}
                  placeholder="1.0.0"
                />
                <p className="text-sm text-muted-foreground">
                  Version of the service for trace identification
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trace Collection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sampling Rate: {(config.samplingRate * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[config.samplingRate]}
                    onValueChange={([value]: number[]) => updateConfig('samplingRate', value)}
                    max={1}
                    min={0}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Percentage of requests to trace. Lower values reduce overhead but may miss issues.
                  </p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Sampling Rate Guidelines:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• 100% - Development/testing environments</li>
                      <li>• 10-50% - Low traffic production</li>
                      <li>• 1-10% - High traffic production</li>
                      <li>• &lt;1% - Very high traffic systems</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Export</Label>
                  <p className="text-sm text-muted-foreground">
                    Export traces to external systems like Jaeger
                  </p>
                </div>
                <Switch
                  checked={config.exportEnabled}
                  onCheckedChange={(checked) => updateConfig('exportEnabled', checked)}
                />
              </div>

              {config.exportEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="jaegerEndpoint">Jaeger Endpoint</Label>
                  <Input
                    id="jaegerEndpoint"
                    value={config.jaegerEndpoint}
                    onChange={(e) => updateConfig('jaegerEndpoint', e.target.value)}
                    placeholder="http://localhost:14268/api/traces"
                  />
                  <p className="text-sm text-muted-foreground">
                    URL of the Jaeger collector endpoint
                  </p>
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  When export is disabled, traces are only stored in memory and available through the UI.
                  Enable export to send traces to external observability platforms.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="maxTraces">Maximum Traces</Label>
                <Input
                  id="maxTraces"
                  type="number"
                  value={config.maxTraces}
                  onChange={(e) => updateConfig('maxTraces', parseInt(e.target.value) || 0)}
                  min="100"
                  max="100000"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum number of traces to store in memory. Older traces are automatically removed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retentionHours">Retention Period (Hours)</Label>
                <Input
                  id="retentionHours"
                  type="number"
                  value={config.retentionHours}
                  onChange={(e) => updateConfig('retentionHours', parseInt(e.target.value) || 0)}
                  min="1"
                  max="168"
                />
                <p className="text-sm text-muted-foreground">
                  How long to keep traces in memory before automatic cleanup (1-168 hours).
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Memory Usage:</strong> Each trace uses approximately 1-10KB of memory depending on span count.
                  With 10,000 traces, expect 10-100MB of memory usage.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config.enabled ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">Tracing Enabled</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium">Tracing Disabled</span>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {hasChanges ? 'Unsaved changes' : 'All changes saved'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TracingSettings;