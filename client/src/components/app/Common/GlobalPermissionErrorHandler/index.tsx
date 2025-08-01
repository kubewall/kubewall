import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { RootState } from '@/redux/store';
import { hidePermissionError } from '@/data/PermissionErrors/PermissionErrorsSlice';
import { PermissionErrorBanner } from '../PermissionErrorBanner';
import { toast } from 'sonner';

export const GlobalPermissionErrorHandler: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentError, isPermissionErrorVisible } = useAppSelector(
    (state: RootState) => state.permissionErrors
  );

  useEffect(() => {
    if (currentError && isPermissionErrorVisible) {
      // Show a toast notification for permission errors
      toast.error('Permission Denied', {
        description: `You don't have permission to ${currentError.verb || 'access'} ${currentError.resource || 'this resource'}.`,
        duration: 5000,
      });
    }
  }, [currentError, isPermissionErrorVisible]);

  if (!currentError || !isPermissionErrorVisible) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <PermissionErrorBanner
        error={currentError}
        variant="compact"
        showRetryButton={false}
        onRetry={() => {
          dispatch(hidePermissionError());
        }}
      />
      <button
        onClick={() => dispatch(hidePermissionError())}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        aria-label="Close permission error"
      >
        ×
      </button>
    </div>
  );
}; 