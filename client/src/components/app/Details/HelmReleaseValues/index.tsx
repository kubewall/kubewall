import { useState } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EyeOpenIcon, CodeIcon, FileTextIcon, DownloadIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { getSystemTheme } from '@/utils/MiscUtils';

interface HelmReleaseValuesProps {
  name: string;
  configName: string;
  clusterName: string;
  namespace: string;
}

export function HelmReleaseValues({ name }: HelmReleaseValuesProps) {
  const { details } = useAppSelector((state) => state.helmReleaseDetails);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const values = details?.values || '';

  const formatValues = (rawValues: string) => {
    // If the values are already in YAML format, return as is
    if (rawValues.trim().startsWith('---') || rawValues.includes(':')) {
      return rawValues;
    }
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(rawValues);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, return as is (should be YAML from backend now)
      return rawValues;
    }
  };

  const downloadValues = () => {
    const blob = new Blob([values], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-values.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Values downloaded successfully');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(values).then(() => {
      toast.success('Values copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy values');
    });
  };

  const renderFormattedValues = () => {
    if (!values) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No values available for this release</p>
        </div>
      );
    }

    try {
      const formatted = formatValues(values);
      return (
        <div className="h-[600px] w-full border rounded-lg overflow-hidden">
          <Editor
            value={formatted}
            language="yaml"
            theme={getSystemTheme()}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'on',
              folding: true,
              automaticLayout: true,
            }}
            height="100%"
          />
        </div>
      );
    } catch (error) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CodeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Unable to format values</p>
          <p className="text-xs mt-2">Raw values may be malformed</p>
        </div>
      );
    }
  };

  const renderRawValues = () => {
    if (!values) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No values available for this release</p>
        </div>
      );
    }

    return (
      <div className="h-[600px] w-full border rounded-lg overflow-hidden">
        <Editor
          value={values}
          language="yaml"
          theme={getSystemTheme()}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            folding: true,
            automaticLayout: true,
          }}
          height="100%"
        />
      </div>
    );
  };

  const getValuesSummary = () => {
    if (!values) return null;

    try {
      // Try to parse as JSON first
      let parsed: any;
      try {
        parsed = typeof values === 'string' ? JSON.parse(values) : values;
      } catch {
        // If not JSON, try to parse as YAML
        // For now, we'll skip summary for YAML values since they're more complex to parse
        return null;
      }
      
      const summary: Record<string, any> = {};

      // Extract top-level keys for summary
      Object.keys(parsed).forEach(key => {
        const value = parsed[key];
        if (typeof value === 'object' && value !== null) {
          summary[key] = Array.isArray(value) ? `[${value.length} items]` : '{...}';
        } else {
          summary[key] = String(value);
        }
      });

      return summary;
    } catch {
      return null;
    }
  };

  const valuesSummary = getValuesSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Release Values</h3>
          <p className="text-sm text-muted-foreground">
            Configuration values for {name}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadValues}>
            <DownloadIcon className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Values Summary */}
        {valuesSummary && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Values Summary</CardTitle>
                <CardDescription>Key configuration sections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(valuesSummary).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{key}</span>
                      <Badge variant="outline" className="text-xs">
                        {String(value)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Values Content */}
        <div className={valuesSummary ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Values Configuration</CardTitle>
                  <CardDescription>
                    {values ? `${values.length} characters` : 'No values available'}
                  </CardDescription>
                </div>
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'formatted' | 'raw')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="formatted" className="flex items-center space-x-2">
                      <EyeOpenIcon className="h-4 w-4" />
                      <span>Formatted</span>
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="flex items-center space-x-2">
                      <CodeIcon className="h-4 w-4" />
                      <span>Raw</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'formatted' | 'raw')}>
                <TabsContent value="formatted" className="mt-0">
                  {renderFormattedValues()}
                </TabsContent>
                <TabsContent value="raw" className="mt-0">
                  {renderRawValues()}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Additional Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions</CardTitle>
          <CardDescription>Manage release values</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button variant="outline" disabled>
              Edit Values
            </Button>
            <Button variant="outline" disabled>
              Upgrade Release
            </Button>
            <Button variant="outline" disabled>
              Compare Values
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Advanced value management features will be available in future updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 