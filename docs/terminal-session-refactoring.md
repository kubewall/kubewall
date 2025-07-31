# Terminal Session Refactoring

## Overview

This document describes the refactoring done to reuse the same pod exec logic for cloud shell terminal rendering and communication.

## Problem

The cloud shell and pod exec implementations had duplicate terminal session logic:

- **CloudShellTerminalSession** in `internal/api/handlers/cloudshell/cloudshell.go`
- **TerminalSession** in `internal/api/handlers/websocket/pod_exec.go`
- **TerminalSession** in `internal/api/handlers/websockets/pod_exec.go`

Both implementations were nearly identical, handling:
- WebSocket message parsing for input (`{"input": "..."}`)
- WebSocket message formatting for output (`{"type": "stdout", "data": "..."}`)
- Error handling (`{"error": "..."}`)
- Connection management

## Solution

### 1. Created Shared Terminal Session

Created a new shared package `internal/api/handlers/shared/terminal_session.go` that provides:

```go
type TerminalSession struct {
    conn   *websocket.Conn
    logger *logger.Logger
}

// Methods:
- NewTerminalSession(conn, logger) *TerminalSession
- Read(p []byte) (int, error)      // Handles {"input": "..."} messages
- Write(p []byte) (int, error)     // Sends {"type": "stdout", "data": "..."} messages
- Close() error                    // Closes WebSocket connection
- SendError(message string) error  // Sends {"error": "..."} messages
```

### 2. Updated Cloud Shell Handler

Modified `internal/api/handlers/cloudshell/cloudshell.go`:

- Added import for shared package
- Replaced `CloudShellTerminalSession` with `shared.NewTerminalSession()`
- Removed duplicate terminal session implementation
- Kept cloud shell specific logic (pod creation, session management)

### 3. Updated Pod Exec Handlers

Modified both pod exec handlers:

- `internal/api/handlers/websocket/pod_exec.go`
- `internal/api/handlers/websockets/pod_exec.go`

- Added import for shared package
- Replaced `TerminalSession` with `shared.NewTerminalSession()`
- Removed duplicate terminal session implementations

## Benefits

### Code Reuse
- **Eliminated duplication**: Removed ~150 lines of duplicate code
- **Single source of truth**: All terminal communication logic is now centralized
- **Consistent behavior**: Both cloud shell and pod exec use identical terminal handling

### Maintainability
- **Easier updates**: Changes to terminal logic only need to be made in one place
- **Better testing**: Shared logic can be tested once and reused
- **Reduced bugs**: Less chance of inconsistencies between implementations

### Frontend Compatibility
- **No frontend changes needed**: The WebSocket message format remains identical
- **Same terminal experience**: Users get consistent behavior across cloud shell and pod exec

## Implementation Details

### WebSocket Message Format (Unchanged)

**Input from frontend:**
```json
{"input": "ls -la\n"}
```

**Output to frontend:**
```json
{"type": "stdout", "data": "total 8\ndrwxr-xr-x..."}
```

**Error messages:**
```json
{"error": "Pod not found"}
```

### Backend Integration

Both cloud shell and pod exec now use:

```go
// Create terminal session using shared implementation
session := shared.NewTerminalSession(conn, h.logger)

// Start the exec session
err = exec.Stream(remotecommand.StreamOptions{
    Stdin:  session,
    Stdout: session,
    Stderr: session,
    Tty:    true,
})
```

## Testing

The refactoring maintains backward compatibility:

1. **Build verification**: `go build ./cmd/server` passes
2. **No API changes**: All existing endpoints work unchanged
3. **Same message format**: Frontend code requires no modifications

## Future Enhancements

With the shared terminal session, future improvements can be easily applied to both cloud shell and pod exec:

- Terminal resizing support
- Better error handling
- Performance optimizations
- Additional terminal features

## Files Modified

### Added
- `internal/api/handlers/shared/terminal_session.go` - New shared terminal session implementation

### Modified
- `internal/api/handlers/cloudshell/cloudshell.go` - Uses shared terminal session
- `internal/api/handlers/websocket/pod_exec.go` - Uses shared terminal session  
- `internal/api/handlers/websockets/pod_exec.go` - Uses shared terminal session

### Removed
- Duplicate `CloudShellTerminalSession` implementation
- Duplicate `TerminalSession` implementations from both pod exec handlers 