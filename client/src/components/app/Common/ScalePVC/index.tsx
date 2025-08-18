import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader } from "@/components/app/Loader";
import { scalePVC, resetScalePVC } from "@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimScaleSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { API_VERSION } from '@/constants';
import kwFetch from '@/data/kwFetch';
import { toast } from 'sonner';
import { ArrowUpIcon } from '@radix-ui/react-icons';

interface ScalePVCProps {
  configName: string;
  clusterName: string;
  namespace: string;
  name: string;
  currentSize: string;
}

const ScalePVC: React.FC<ScalePVCProps> = ({ configName, clusterName, namespace, name, currentSize }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [canScale, setCanScale] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [validationError, setValidationError] = useState('');

  const dispatch = useAppDispatch();
  const { loading, response, error } = useAppSelector((state) => state.persistentVolumeClaimScale);

  // Check permissions when component mounts
  useEffect(() => {
    const checkPermission = async () => {
      if (!configName || !clusterName || !namespace || !name) return;
      setCheckingPermission(true);
      try {
        const qp: Record<string, string> = { 
          config: configName, 
          cluster: clusterName, 
          resourcekind: 'persistentvolumeclaims', 
          verb: 'patch',
          namespace: namespace
        };
        const url = `${API_VERSION}/permissions/check?${new URLSearchParams(qp).toString()}`;
        const res = await kwFetch(url, { method: 'GET' });
        setCanScale(Boolean((res as { allowed?: boolean })?.allowed));
      } catch (_) {
        setCanScale(false);
      } finally {
        setCheckingPermission(false);
      }
    };
    checkPermission();
  }, [configName, clusterName, namespace, name]);

  // Validate size input
  useEffect(() => {
    if (!newSize) {
      setValidationError('');
      return;
    }

    // Basic size format validation (e.g., "10Gi", "100Mi", "1Ti")
    const sizeRegex = /^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E|i)?$/i;
    if (!sizeRegex.test(newSize)) {
      setValidationError('Invalid size format. Use format like "10Gi", "100Mi", "1Ti"');
      return;
    }

    // Parse current size for comparison
    const currentSizeValue = parseFloat(currentSize.replace(/[^\d.]/g, ''));
    const currentSizeUnit = currentSize.replace(/[\d.]/g, '').toLowerCase();
    const newSizeValue = parseFloat(newSize.replace(/[^\d.]/g, ''));
    const newSizeUnit = newSize.replace(/[\d.]/g, '').toLowerCase();

    // Convert to bytes for comparison
    const unitMultipliers: { [key: string]: number } = {
      'ki': 1024,
      'mi': 1024 * 1024,
      'gi': 1024 * 1024 * 1024,
      'ti': 1024 * 1024 * 1024 * 1024,
      'pi': 1024 * 1024 * 1024 * 1024 * 1024,
      'ei': 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
      'k': 1000,
      'm': 1000 * 1000,
      'g': 1000 * 1000 * 1000,
      't': 1000 * 1000 * 1000 * 1000,
      'p': 1000 * 1000 * 1000 * 1000 * 1000,
      'e': 1000 * 1000 * 1000 * 1000 * 1000 * 1000,
    };

    const currentBytes = currentSizeValue * (unitMultipliers[currentSizeUnit] || 1);
    const newBytes = newSizeValue * (unitMultipliers[newSizeUnit] || 1);

    if (newBytes <= currentBytes) {
      setValidationError('New size must be greater than current size');
      return;
    }

    setValidationError('');
  }, [newSize, currentSize]);

  const handleScale = () => {
    if (validationError || !newSize) {
      return;
    }

    dispatch(scalePVC({
      config: configName,
      cluster: clusterName,
      namespace,
      name,
      size: newSize,
    }));
  };

  // Handle response
  useEffect(() => {
    if (response?.message) {
      toast.success("Success", {
        description: response.message,
      });
      dispatch(resetScalePVC());
      setModalOpen(false);
      setNewSize('');
    } else if (error) {
      const anyErr = error as { message?: string; details?: Array<{ message?: string }> };
      let description = anyErr?.message || 'Scale operation failed';
      if (Array.isArray(anyErr?.details) && anyErr.details.length) {
        const first = anyErr.details[0];
        if (first?.message) {
          description = first.message;
        }
      }
      toast.error("Failure", { description });
      dispatch(resetScalePVC());
    }
  }, [response, error, dispatch]);

  const isDisabled = checkingPermission || !canScale || loading || !!validationError || !newSize;

  return (
    <Dialog open={modalOpen} onOpenChange={(open: boolean) => setModalOpen(open)}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-2"
          disabled={checkingPermission || !canScale}
          onClick={() => setModalOpen(true)}
        >
          {checkingPermission ? (
            <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
          ) : (
            <div className="flex items-center gap-1">
              <ArrowUpIcon className="h-4 w-4" />
              <span className='text-xs'>Scale</span>
            </div>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scale Persistent Volume Claim</DialogTitle>
          <DialogDescription>
            Increase the size of the persistent volume claim "{name}" in namespace "{namespace}".
            <br />
            Current size: <strong>{currentSize}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newSize">New Size</Label>
            <Input
              id="newSize"
              placeholder="e.g., 20Gi, 100Mi, 1Ti"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className={validationError ? 'border-red-500' : ''}
            />
            {validationError && (
              <Alert variant="destructive">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
          </div>

          {!canScale && !checkingPermission && (
            <Alert variant="destructive">
              <AlertDescription>
                You don't have permission to scale this persistent volume claim.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="outline"
            className="w-2/4"
            onClick={() => {
              setModalOpen(false);
              setNewSize('');
              setValidationError('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleScale}
            className="w-2/4"
            disabled={isDisabled}
          >
            {loading ? (
              <Loader className='w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' />
            ) : (
              'Scale'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScalePVC;
