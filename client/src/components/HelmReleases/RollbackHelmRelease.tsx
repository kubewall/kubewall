import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ClockIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import { rollbackHelmRelease, clearError } from '@/data/Helm/HelmActionsSlice';
import { HelmReleaseHistory } from '@/types/helm';

interface RollbackHelmReleaseProps {
  releaseName: string;
  namespace: string;
  configName: string;
  clusterName: string;
  history: HelmReleaseHistory[];
  disabled?: boolean;
}

export function RollbackHelmRelease({
  releaseName,
  namespace,
  configName,
  clusterName,
  history,
  disabled = false,
}: RollbackHelmReleaseProps) {
  const dispatch = useAppDispatch();
  const { rollbackLoading, error } = useAppSelector((state) => state.helmActions);
  const [open, setOpen] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<string>('');

  // Filter out current revision and get rollback candidates
  const rollbackCandidates = history.filter(h => !h.isLatest && h.status === 'superseded');

  const handleRollback = async () => {
    if (!selectedRevision) {
      toast.error('Please select a revision to rollback to');
      return;
    }

    try {
      await dispatch(
        rollbackHelmRelease({
          config: configName,
          cluster: clusterName,
          releaseName,
          namespace,
          revision: parseInt(selectedRevision),
        })
      ).unwrap();

      toast.success(`Successfully rolled back ${releaseName} to revision ${selectedRevision}`);
      setOpen(false);
      setSelectedRevision('');
      
      // Refresh the page to show updated data
      window.location.reload();
    } catch (err) {
      toast.error(`Failed to rollback release: ${err}`);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSelectedRevision('');
      dispatch(clearError());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex-1 justify-start" 
          size="sm"
          disabled={disabled || rollbackCandidates.length === 0}
        >
          <ClockIcon className="h-3 w-3 mr-1" />
          Rollback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rollback Helm Release</DialogTitle>
          <DialogDescription>
            Select a previous revision to rollback {releaseName} to. This will create a new revision with the selected configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="revision" className="text-right">
              Revision
            </Label>
            <div className="col-span-3">
              <Select value={selectedRevision} onValueChange={setSelectedRevision}>
                <SelectTrigger>
                  <SelectValue placeholder="Select revision to rollback to" />
                </SelectTrigger>
                <SelectContent>
                  {rollbackCandidates.map((revision) => (
                    <SelectItem key={revision.revision} value={revision.revision.toString()}>
                      Revision {revision.revision} - {revision.chart} ({new Date(revision.updated).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {rollbackCandidates.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No previous revisions available for rollback.
            </div>
          )}
          {error && (
            <div className="text-sm text-red-500 text-center">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRollback} 
            disabled={rollbackLoading || !selectedRevision || rollbackCandidates.length === 0}
          >
            {rollbackLoading ? 'Rolling back...' : 'Rollback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}