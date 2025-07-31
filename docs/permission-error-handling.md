# Permission Error Handling System

This document describes the comprehensive permission error handling system implemented in KubeWall to gracefully handle RBAC permission errors.

## Overview

The permission error handling system provides a unified way to detect, handle, and display RBAC permission errors across both the backend and frontend of the application. It ensures that users receive clear, actionable feedback when they don't have permissions to access specific Kubernetes resources.

## Backend Implementation

### Error Detection

The system uses a centralized error detection utility located at `internal/api/utils/errors.go`:

```go
// Check if an error is a permission-related error
func IsPermissionError(err error) bool

// Extract permission error details from a Kubernetes error
func ExtractPermissionError(err error) *PermissionError

// Create a standardized permission error response
func CreatePermissionErrorResponse(err error) map[string]interface{}
```

### Permission Error Structure

```go
type PermissionError struct {
    Resource    string `json:"resource"`
    Verb        string `json:"verb"`
    APIGroup    string `json:"apiGroup"`
    APIVersion  string `json:"apiVersion"`
    Message     string `json:"message"`
    StatusCode  int    `json:"statusCode"`
}
```

### Usage in Handlers

To add permission error handling to a new handler:

1. Import the utils package
2. Check for permission errors after Kubernetes API calls
3. Use the appropriate error response method

```go
// Example usage in a handler
if err != nil {
    h.logger.WithError(err).Error("Failed to list resources")
    
    // Check if this is a permission error
    if utils.IsPermissionError(err) {
        h.sseHandler.SendSSEPermissionError(c, err)
    } else {
        h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
    }
    return
}
```

## Frontend Implementation

### Components

#### PermissionErrorBanner
A reusable component for displaying inline permission errors:

```tsx
import { PermissionErrorBanner } from '@/components/app/Common/PermissionErrorBanner';

<PermissionErrorBanner
  error={permissionError}
  variant="default" // or "compact"
  showRetryButton={true}
  onRetry={() => handleRetry()}
/>
```

#### PermissionErrorPage
A full-page component for permission errors:

```tsx
import { PermissionErrorPage } from '@/components/app/Common/PermissionErrorPage';

<PermissionErrorPage
  error={permissionError}
  onRetry={() => handleRetry()}
  showBackButton={true}
  showRetryButton={true}
/>
```

#### GlobalPermissionErrorHandler
A global component that displays permission errors as toast notifications:

```tsx
import { GlobalPermissionErrorHandler } from '@/components/app/Common/GlobalPermissionErrorHandler';

// Add to your main App component
<GlobalPermissionErrorHandler />
```

### Redux State Management

The permission error state is managed through Redux:

```typescript
// State structure
interface PermissionErrorsState {
  currentError: PermissionError | null;
  errorHistory: PermissionError[];
  isPermissionErrorVisible: boolean;
}

// Actions
setPermissionError(error: PermissionError)
clearPermissionError()
hidePermissionError()
clearErrorHistory()
removeFromErrorHistory(payload: { resource: string; verb: string; apiGroup?: string })
```

### EventSource Integration

The EventSource hook has been enhanced to handle permission errors:

```typescript
useEventSource({
  url: endpoint,
  sendMessage: handleMessage,
  onConfigError: handleConfigError,
  onPermissionError: handlePermissionError, // New callback
  setLoading: setLoading,
});
```

### Utility Functions

Utility functions for permission error handling are available at `client/src/utils/permissionErrors.ts`:

```typescript
// Check if an error is a permission error
isPermissionError(error: any): boolean

// Convert an API error to a PermissionError object
convertToPermissionError(error: any): PermissionError | null

// Get a user-friendly error message
getPermissionErrorMessage(error: PermissionError): string

// Convert Kubernetes verb to user-friendly display text
getVerbDisplay(verb?: string): string

// Convert resource name to user-friendly display text
getResourceDisplay(resource?: string, apiGroup?: string): string
```

## Error Detection Patterns

The system detects permission errors based on:

1. **HTTP Status Codes**: 401 (Unauthorized), 403 (Forbidden)
2. **Error Messages**: Keywords like "forbidden", "unauthorized", "access denied", "permission denied", "rbac", "not allowed", "insufficient permissions"
3. **Kubernetes API Errors**: Structured errors from the Kubernetes API

## User Experience

### Error Display

- **Inline Errors**: Permission errors are displayed as banners within the affected component
- **Toast Notifications**: Global permission errors are shown as toast notifications
- **Full-Page Errors**: For critical permission errors, a dedicated error page is displayed

### Error Messages

Error messages are user-friendly and include:
- The specific action that was denied (e.g., "view", "list", "create")
- The resource that couldn't be accessed (e.g., "ConfigMaps", "Secrets")
- Clear instructions on what to do next

### Retry Mechanism

Users can retry failed operations, which will:
- Clear the current error state
- Reconnect to the EventSource
- Attempt the operation again

## Best Practices

### Backend

1. Always check for permission errors after Kubernetes API calls
2. Use the centralized error detection utilities
3. Log permission errors for debugging purposes
4. Return structured error responses

### Frontend

1. Use the appropriate permission error component for the context
2. Handle permission errors in EventSource callbacks
3. Provide clear retry mechanisms
4. Maintain error history for better UX

### Testing

1. Test with different RBAC configurations
2. Verify error messages are user-friendly
3. Ensure retry mechanisms work correctly
4. Test error state persistence

## Migration Guide

To add permission error handling to existing components:

1. **Backend Handlers**: Add permission error checks after Kubernetes API calls
2. **Frontend Components**: Add `onPermissionError` callback to EventSource usage
3. **UI Components**: Replace generic error displays with permission error components
4. **State Management**: Integrate with the permission errors Redux slice

## Example Implementation

See the following files for complete examples:
- `internal/api/handlers/configurations/configmaps.go` - Backend handler example
- `client/src/components/app/Common/Hooks/Table/index.tsx` - Frontend component example
- `client/src/components/app/Common/PermissionErrorBanner/index.tsx` - UI component example 