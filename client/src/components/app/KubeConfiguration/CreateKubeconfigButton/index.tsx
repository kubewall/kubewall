import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, Download, FileText, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { generateUnifiedKubernetesScript } from '../UnifiedScriptGenerator';

export function CreateKubeconfigButton() {
  const [open, setOpen] = useState(false);

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard', {
      description: description
    });
  };

  const downloadScript = () => {
    const script = generateUnifiedKubernetesScript('kubeconfig');
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup-kube-dash-kubeconfig.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Script downloaded', {
      description: 'Run the script on your cluster to create the necessary resources'
    });
  };





  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <FileText className="h-3 w-3" />
          Create Kubeconfig
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Download Kubeconfig Setup Script
          </DialogTitle>
          <DialogDescription>
            Download and run this script on your cluster to create the necessary resources for kube-dash access.
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Automated Setup Script
                </CardTitle>
            <CardDescription>
              Download and run this script on your cluster to automatically create all necessary resources.
            </CardDescription>
          </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={downloadScript} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download Script
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(generateUnifiedKubernetesScript('kubeconfig'), 'Script copied to clipboard')}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Script
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label>Script Preview</Label>
                  <Textarea
                    value={generateUnifiedKubernetesScript('kubeconfig')}
                    readOnly
                    rows={15}
                    className="font-mono text-xs"
                  />
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What this script does:</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Creates the <code>kube-dash</code> namespace</li>
                    <li>• Creates a ServiceAccount named <code>kube-dash</code></li>
                    <li>• Creates a ClusterRoleBinding with cluster-admin permissions</li>
                    <li>• Creates a Secret to generate a service account token</li>
                    <li>• Outputs cluster endpoint, CA certificate, and token information</li>
                    <li>• Provides a kubeconfig template for easy setup</li>
                  </ul>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-md">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Usage Instructions:</h4>
                  <ol className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                    <li>1. Download the script using the button above</li>
                    <li>2. Make it executable: <code>chmod +x setup-kube-dash-access.sh</code></li>
                    <li>3. Run it on your cluster: <code>./setup-kube-dash-access.sh</code></li>
                    <li>4. Copy the generated kubeconfig and save it as a file</li>
                    <li>5. Upload the kubeconfig file using the "Add Configuration" button</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
      </DialogContent>
    </Dialog>
  );
}