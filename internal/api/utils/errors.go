package utils

import (
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
)

// PermissionError represents a permission-related error
type PermissionError struct {
	Resource    string `json:"resource"`
	Verb        string `json:"verb"`
	APIGroup    string `json:"apiGroup"`
	APIVersion  string `json:"apiVersion"`
	Message     string `json:"message"`
	StatusCode  int    `json:"statusCode"`
}

// IsPermissionError checks if the given error is a permission-related error
func IsPermissionError(err error) bool {
	if err == nil {
		return false
	}

	// Check if it's a Kubernetes API error
	if k8sErr, ok := err.(*errors.StatusError); ok {
		status := k8sErr.ErrStatus
		
		// Check for 403 Forbidden status
		if status.Code == 403 {
			return true
		}
		
		// Check for 401 Unauthorized status
		if status.Code == 401 {
			return true
		}
		
		// Check error message for permission-related keywords
		if status.Message != "" {
			message := strings.ToLower(status.Message)
			permissionKeywords := []string{
				"forbidden",
				"unauthorized",
				"access denied",
				"permission denied",
				"rbac",
				"not allowed",
				"insufficient permissions",
			}
			
			for _, keyword := range permissionKeywords {
				if strings.Contains(message, keyword) {
					return true
				}
			}
		}
	}
	
	// Check error message for permission-related keywords
	errMsg := strings.ToLower(err.Error())
	permissionKeywords := []string{
		"forbidden",
		"unauthorized", 
		"access denied",
		"permission denied",
		"rbac",
		"not allowed",
		"insufficient permissions",
	}
	
	for _, keyword := range permissionKeywords {
		if strings.Contains(errMsg, keyword) {
			return true
		}
	}
	
	return false
}

// ExtractPermissionError extracts permission error details from a Kubernetes error
func ExtractPermissionError(err error) *PermissionError {
	if !IsPermissionError(err) {
		return nil
	}
	
	permissionErr := &PermissionError{
		Message: err.Error(),
	}
	
	// Try to extract details from Kubernetes API error
	if k8sErr, ok := err.(*errors.StatusError); ok {
		status := k8sErr.ErrStatus
		permissionErr.StatusCode = int(status.Code)
		
		// Extract resource details from status details if available
		if status.Details != nil {
			permissionErr.Resource = status.Details.Kind
			permissionErr.APIGroup = status.Details.Group
		}
		
		// Try to extract verb from error message
		if status.Message != "" {
			message := strings.ToLower(status.Message)
			verbs := []string{"get", "list", "watch", "create", "update", "patch", "delete", "deletecollection"}
			for _, verb := range verbs {
				if strings.Contains(message, verb) {
					permissionErr.Verb = verb
					break
				}
			}
		}
	}
	
	return permissionErr
}

// CreatePermissionErrorResponse creates a standardized permission error response
func CreatePermissionErrorResponse(err error) map[string]interface{} {
	permissionErr := ExtractPermissionError(err)
	if permissionErr == nil {
		// Fallback for non-permission errors
		return map[string]interface{}{
			"error": map[string]interface{}{
				"type":    "permission_error",
				"message": err.Error(),
				"code":    403,
			},
		}
	}
	
	return map[string]interface{}{
		"error": map[string]interface{}{
			"type":        "permission_error",
			"message":     permissionErr.Message,
			"code":        permissionErr.StatusCode,
			"resource":    permissionErr.Resource,
			"verb":        permissionErr.Verb,
			"apiGroup":    permissionErr.APIGroup,
			"apiVersion":  permissionErr.APIVersion,
		},
	}
} 