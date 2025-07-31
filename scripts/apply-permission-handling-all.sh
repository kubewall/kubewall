#!/bin/bash

# Comprehensive script to apply permission error handling to ALL Kubernetes resource handlers
# This script will update all remaining handlers that haven't been updated yet

echo "Applying permission error handling to ALL Kubernetes resource handlers..."

# List of all handler directories
HANDLER_DIRS=(
    "internal/api/handlers/access-control"
    "internal/api/handlers/cluster"
    "internal/api/handlers/configurations"
    "internal/api/handlers/custom-resources"
    "internal/api/handlers/networking"
    "internal/api/handlers/storage"
    "internal/api/handlers/workloads"
    "internal/api/handlers/helm"
)

# Function to update a handler file
update_handler() {
    local file=$1
    echo "Processing $file..."
    
    # Check if file already has permission error handling
    if grep -q "IsPermissionError" "$file"; then
        echo "  ✓ Already has permission error handling"
        return
    fi
    
    # Create backup
    cp "$file" "${file}.backup"
    
    # Add utils import if not present
    if ! grep -q "kubewall-backend/internal/api/utils" "$file"; then
        # Find the import block and add utils import
        sed -i '' '/^import (/a\
	"kubewall-backend/internal/api/utils"
' "$file"
    fi
    
    # Update SSE methods to include permission error handling
    # Pattern 1: Direct SendSSEError calls
    if grep -q "h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError" "$file"; then
        sed -i '' '/h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError, err\.Error())/a\
		// Check if this is a permission error\
		if utils.IsPermissionError(err) {\
			h.sseHandler.SendSSEPermissionError(c, err)\
		} else {\
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())\
		}\
		return\
' "$file"
        
        # Remove the original error line
        sed -i '' '/h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError, err\.Error())/d' "$file"
        echo "  ✓ Updated SSE error handling"
    fi
    
    # Pattern 2: Error handling with err2 variable
    if grep -q "h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError, err2\.Error())" "$file"; then
        sed -i '' '/h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError, err2\.Error())/a\
		// Check if this is a permission error\
		if utils.IsPermissionError(err2) {\
			h.sseHandler.SendSSEPermissionError(c, err2)\
		} else {\
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err2.Error())\
		}\
		return\
' "$file"
        
        # Remove the original error line
        sed -i '' '/h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError, err2\.Error())/d' "$file"
        echo "  ✓ Updated SSE error handling (err2)"
    fi
    
    # Pattern 3: Generic error handling
    if grep -q "h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError" "$file"; then
        sed -i '' '/h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError/a\
		// Check if this is a permission error\
		if utils.IsPermissionError(err) {\
			h.sseHandler.SendSSEPermissionError(c, err)\
		} else {\
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())\
		}\
		return\
' "$file"
        
        # Remove the original error line (generic pattern)
        sed -i '' '/h\.sseHandler\.SendSSEError(c, http\.StatusInternalServerError/d' "$file"
        echo "  ✓ Updated generic SSE error handling"
    fi
    
    echo "  ✓ Updated with permission error handling"
}

# Process all handler directories
for dir in "${HANDLER_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo ""
        echo "Processing directory: $dir"
        for file in "$dir"/*.go; do
            if [ -f "$file" ]; then
                update_handler "$file"
            fi
        done
    else
        echo "Directory not found: $dir"
    fi
done

echo ""
echo "=========================================="
echo "Permission error handling applied to all handlers!"
echo "=========================================="
echo ""
echo "Summary of changes:"
echo "1. Added utils import to all handler files"
echo "2. Updated SSE error handling to detect permission errors"
echo "3. Added permission error detection for all Kubernetes API calls"
echo ""
echo "Next steps:"
echo "1. Review the changes in the handler files"
echo "2. Test with different RBAC configurations"
echo "3. Remove backup files if everything looks good: find . -name '*.backup' -delete"
echo "4. Run 'make build' to verify everything compiles correctly"
echo ""
echo "The permission error handling system is now complete!" 