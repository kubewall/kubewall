import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PermissionError {
  type: 'permission_error';
  message: string;
  code: number;
  resource?: string;
  verb?: string;
  apiGroup?: string;
  apiVersion?: string;
}

interface PermissionErrorBannerProps {
  error: PermissionError;
  className?: string;
  onRetry?: () => void;
  showRetryButton?: boolean;
  variant?: 'default' | 'compact';
}

export const PermissionErrorBanner: React.FC<PermissionErrorBannerProps> = ({
  error,
  className,
  onRetry,
  showRetryButton = false,
  variant = 'default'
}) => {
  const getVerbDisplay = (verb?: string) => {
    if (!verb) return 'access';
    
    const verbMap: Record<string, string> = {
      'get': 'view',
      'list': 'list',
      'watch': 'watch',
      'create': 'create',
      'update': 'update',
      'patch': 'modify',
      'delete': 'delete',
      'deletecollection': 'delete'
    };
    
    return verbMap[verb] || verb;
  };

  const getResourceDisplay = (resource?: string, apiGroup?: string) => {
    if (!resource) return 'this resource';
    
    // Convert resource name to display format (e.g., "configmaps" -> "ConfigMaps")
    const resourceDisplay = resource.charAt(0).toUpperCase() + resource.slice(1);
    
    if (apiGroup && apiGroup !== '') {
      return `${resourceDisplay} (${apiGroup})`;
    }
    
    return resourceDisplay;
  };

  const getErrorMessage = () => {
    const verb = getVerbDisplay(error.verb);
    const resource = getResourceDisplay(error.resource, error.apiGroup);
    
    return `You don't have permission to ${verb} ${resource}.`;
  };

  if (variant === 'compact') {
    return (
      <Alert variant="destructive" className={cn("border-orange-200 bg-orange-50 text-orange-800", className)}>
        <Lock className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {getErrorMessage()}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className={cn("border-orange-200 bg-orange-50 text-orange-800", className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-orange-800">Permission Denied</AlertTitle>
      <AlertDescription className="text-orange-700">
        {getErrorMessage()}
        {error.message && error.message !== getErrorMessage() && (
          <div className="mt-2 text-sm opacity-75">
            {error.message}
          </div>
        )}
      </AlertDescription>
      {showRetryButton && onRetry && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            Try Again
          </Button>
        </div>
      )}
    </Alert>
  );
}; 