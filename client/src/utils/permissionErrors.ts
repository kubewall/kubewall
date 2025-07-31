import { PermissionError } from '@/components/app/Common/PermissionErrorBanner';

// Check if an error is a permission error based on HTTP status code and message
export const isPermissionError = (error: any): boolean => {
  if (!error) return false;
  
  // Check HTTP status codes
  if (error.code === 403 || error.code === 401) {
    return true;
  }
  
  // Check error message for permission-related keywords
  const message = (error.message || '').toLowerCase();
  const permissionKeywords = [
    'forbidden',
    'unauthorized',
    'access denied',
    'permission denied',
    'rbac',
    'not allowed',
    'insufficient permissions',
  ];
  
  return permissionKeywords.some(keyword => message.includes(keyword));
};

// Convert an API error to a PermissionError object
export const convertToPermissionError = (error: any): PermissionError | null => {
  if (!isPermissionError(error)) {
    return null;
  }
  
  return {
    type: 'permission_error',
    message: error.message || 'Permission denied',
    code: error.code || 403,
    resource: error.resource,
    verb: error.verb,
    apiGroup: error.apiGroup,
    apiVersion: error.apiVersion,
  };
};

// Get a user-friendly error message for permission errors
export const getPermissionErrorMessage = (error: PermissionError): string => {
  const verb = getVerbDisplay(error.verb);
  const resource = getResourceDisplay(error.resource, error.apiGroup);
  
  return `You don't have permission to ${verb} ${resource}.`;
};

// Convert Kubernetes verb to user-friendly display text
export const getVerbDisplay = (verb?: string): string => {
  if (!verb) return 'access';
  
  const verbMap: Record<string, string> = {
    'get': 'view',
    'list': 'list',
    'watch': 'watch',
    'create': 'create',
    'update': 'update',
    'patch': 'modify',
    'delete': 'delete',
    'deletecollection': 'delete',
  };
  
  return verbMap[verb] || verb;
};

// Convert resource name to user-friendly display text
export const getResourceDisplay = (resource?: string, apiGroup?: string): string => {
  if (!resource) return 'this resource';
  
  // Convert resource name to display format (e.g., "configmaps" -> "ConfigMaps")
  const resourceDisplay = resource.charAt(0).toUpperCase() + resource.slice(1);
  
  if (apiGroup && apiGroup !== '') {
    return `${resourceDisplay} (${apiGroup})`;
  }
  
  return resourceDisplay;
};

// Check if a specific resource and verb combination is in the error history
export const hasPermissionError = (
  errorHistory: PermissionError[],
  resource: string,
  verb: string,
  apiGroup?: string
): boolean => {
  return errorHistory.some(
    error =>
      error.resource === resource &&
      error.verb === verb &&
      error.apiGroup === apiGroup
  );
}; 