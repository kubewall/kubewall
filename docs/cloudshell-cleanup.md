# Cloud Shell Cleanup Feature

## Overview

The cloud shell cleanup feature automatically removes cloud shell sessions that have been running for more than 24 hours to prevent resource accumulation and ensure optimal performance.

## Features

### Automatic Cleanup
- **Interval**: Runs every hour
- **Age Threshold**: Sessions older than 24 hours are automatically cleaned up
- **Scope**: Checks all configured clusters and namespaces for cloud shell pods
- **Resources Cleaned**: 
  - Cloud shell pods
  - Associated ConfigMaps (kubeconfig files)
  - Orphaned ConfigMaps (ConfigMaps without associated pods)

### Manual Cleanup
- **Endpoint**: `POST /api/v1/cloudshell/cleanup`
- **Purpose**: Allows manual triggering of the cleanup routine
- **Response**: Returns immediately with status confirmation

## Configuration

The cleanup behavior is controlled by constants in `internal/api/handlers/cloudshell/cloudshell.go`:

```go
const (
    CloudShellCleanupInterval = 1 * time.Hour  // How often to run cleanup
    CloudShellMaxAge = 24 * time.Hour          // Maximum age before cleanup
)
```

## Permission Requirements

Before creating a cloud shell, the system checks for the following permissions:
- **ConfigMaps**: `create`, `list`, `delete`
- **Pods**: `create`, `list`, `delete`

These permissions are verified in the target namespace before proceeding with cloud shell creation.

## Implementation Details

### Cleanup Process
1. **Discovery**: Iterates through all stored kubeconfigs
2. **Cluster Scanning**: For each config, checks all clusters
3. **Namespace Scanning**: For each cluster, checks all namespaces
4. **Pod Identification**: Finds pods with `app=cloudshell` label
5. **Age Check**: Compares pod creation time against 24-hour threshold
6. **Cleanup**: Deletes old pods and associated ConfigMaps
7. **Orphaned ConfigMap Cleanup**: Removes ConfigMaps that don't have associated pods

### Logging
The cleanup process logs:
- Start/completion of cleanup routine
- Individual pod cleanup actions with details (pod name, namespace, cluster, age)
- Error conditions (failed deletions, permission issues)
- Summary statistics (total cleaned count)

### Error Handling
- **Permission Errors**: Logged but don't stop the cleanup process
- **ConfigMap Deletion**: Non-critical errors are logged at debug level
- **Client Connection**: Failed connections are logged and skipped

## Monitoring

### Log Messages
Look for these log patterns to monitor cleanup activity:

```
"Starting cloud shell cleanup routine"
"Cleaning up old cloud shell session"
"Successfully deleted cloud shell ConfigMap during cleanup"
"Starting orphaned ConfigMap cleanup routine"
"Successfully deleted orphaned cloud shell ConfigMap"
"Cloud shell cleanup routine completed"
"Orphaned ConfigMap cleanup routine completed"
```

### Metrics
The cleanup process logs the number of sessions cleaned:
```
"cleaned_count": 5
```

## API Usage

### Manual Cleanup
```bash
curl -X POST http://localhost:8080/api/v1/cloudshell/cleanup
```

Response:
```json
{
  "message": "Cloud shell cleanup started",
  "status": "initiated"
}
```

## Best Practices

1. **Monitor Logs**: Regularly check cleanup logs to ensure the process is working
2. **Adjust Intervals**: Consider adjusting cleanup interval based on usage patterns
3. **Test Manual Cleanup**: Use the manual endpoint to test cleanup functionality
4. **Review Age Threshold**: Adjust the 24-hour threshold if needed for your use case

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the service account has delete permissions on pods and configmaps
2. **No Cleanup Activity**: Check if cloud shell pods exist and are older than 24 hours
3. **High Resource Usage**: Consider reducing cleanup interval if there are many sessions

### Debug Commands

Check for old cloud shell pods:
```bash
kubectl get pods -l app=cloudshell --all-namespaces -o wide
```

Check pod creation times:
```bash
kubectl get pods -l app=cloudshell --all-namespaces -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,CREATED:.metadata.creationTimestamp
``` 