import React from 'react';
import { Lock, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from '@tanstack/react-router';
import { PermissionError } from '../PermissionErrorBanner';
import { useAppDispatch } from '@/redux/hooks';
import { clearPermissionError } from '@/data/PermissionErrors/PermissionErrorsSlice';

interface PermissionErrorPageProps {
  error: PermissionError;
  onRetry?: () => void;
  showBackButton?: boolean;
  showRetryButton?: boolean;
  title?: string;
  description?: string;
}

export const PermissionErrorPage: React.FC<PermissionErrorPageProps> = ({
  error,
  onRetry,
  showBackButton = true,
  showRetryButton = true,
  title,
  description
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

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
    
    const resourceDisplay = resource.charAt(0).toUpperCase() + resource.slice(1);
    
    if (apiGroup && apiGroup !== '') {
      return `${resourceDisplay} (${apiGroup})`;
    }
    
    return resourceDisplay;
  };

  const getDefaultTitle = () => {
    const verb = getVerbDisplay(error.verb);
    const resource = getResourceDisplay(error.resource, error.apiGroup);
    return `Permission Denied - Cannot ${verb} ${resource}`;
  };

  const getDefaultDescription = () => {
    const verb = getVerbDisplay(error.verb);
    const resource = getResourceDisplay(error.resource, error.apiGroup);
    return `You don't have the necessary permissions to ${verb} ${resource}. Please contact your cluster administrator if you believe this is an error.`;
  };

  const handleGoBack = () => {
    // Clear permission error when going back
    dispatch(clearPermissionError());
    navigate({ to: '..' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <Lock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-xl text-foreground">
            {title || getDefaultTitle()}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {description || getDefaultDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.message && (
            <div className="rounded-md bg-orange-50 dark:bg-orange-950/50 p-3 border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Error Details:</strong> {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
            {showBackButton && (
              <Button
                variant="outline"
                onClick={handleGoBack}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}
            
            {showRetryButton && onRetry && (
              <Button
                onClick={onRetry}
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Error Code: {error.code}
              {error.resource && ` • Resource: ${error.resource}`}
              {error.verb && ` • Action: ${error.verb}`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 