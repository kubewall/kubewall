#!/bin/bash

# Script to add permission error handling to existing handlers
# Usage: ./scripts/add-permission-error-handling.sh <handler-file>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <handler-file>"
    echo "Example: $0 internal/api/handlers/configurations/configmaps.go"
    exit 1
fi

HANDLER_FILE=$1

if [ ! -f "$HANDLER_FILE" ]; then
    echo "Error: File $HANDLER_FILE does not exist"
    exit 1
fi

echo "Adding permission error handling to $HANDLER_FILE..."

# Check if the file already has permission error handling
if grep -q "IsPermissionError" "$HANDLER_FILE"; then
    echo "Warning: File already contains permission error handling"
    exit 0
fi

# Create a backup
cp "$HANDLER_FILE" "${HANDLER_FILE}.backup"

# Add the import if not already present
if ! grep -q "kubewall-backend/internal/api/utils" "$HANDLER_FILE"; then
    # Find the import block and add the utils import
    sed -i '' '/^import (/a\
	"kubewall-backend/internal/api/utils"
' "$HANDLER_FILE"
fi

echo "Added permission error handling to $HANDLER_FILE"
echo "Backup created at ${HANDLER_FILE}.backup"
echo ""
echo "Next steps:"
echo "1. Review the changes in $HANDLER_FILE"
echo "2. Update the error handling in SSE methods to use utils.IsPermissionError(err)"
echo "3. Test the handler with different RBAC configurations"
echo "4. Remove the backup file if everything looks good: rm ${HANDLER_FILE}.backup" 