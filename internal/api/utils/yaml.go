package utils

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// YAMLHandler provides utility functions for YAML operations
type YAMLHandler struct {
	logger *logger.Logger
}

// NewYAMLHandler creates a new YAML handler
func NewYAMLHandler(log *logger.Logger) *YAMLHandler {
	return &YAMLHandler{
		logger: log,
	}
}

// getGVKFromTypedObject attempts to get GVK information from a typed Kubernetes object
func (h *YAMLHandler) getGVKFromTypedObject(obj interface{}) (schema.GroupVersionKind, bool) {
	h.logger.WithField("object_type", fmt.Sprintf("%T", obj)).Debug("Attempting to get GVK from typed object")

	// Use reflection to get the TypeMeta information
	val := reflect.ValueOf(obj)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	// Log all available fields for debugging
	typ := val.Type()
	h.logger.WithField("struct_type", typ.Name()).Debug("Analyzing struct type")

	for i := 0; i < val.NumField(); i++ {
		field := val.Type().Field(i)
		h.logger.WithFields(map[string]interface{}{
			"field_name": field.Name,
			"field_type": field.Type.String(),
		}).Debug("Found struct field")
	}

	// Try to get APIVersion and Kind fields
	apiVersionField := val.FieldByName("APIVersion")
	kindField := val.FieldByName("Kind")

	h.logger.WithFields(map[string]interface{}{
		"apiVersionField_valid": apiVersionField.IsValid(),
		"kindField_valid":       kindField.IsValid(),
	}).Debug("Field validation results")

	if apiVersionField.IsValid() && kindField.IsValid() {
		apiVersion := apiVersionField.String()
		kind := kindField.String()

		h.logger.WithFields(map[string]interface{}{
			"apiVersion": apiVersion,
			"kind":       kind,
		}).Debug("Extracted APIVersion and Kind from fields")

		if apiVersion != "" && kind != "" {
			// Parse the APIVersion to get Group and Version
			gv, err := schema.ParseGroupVersion(apiVersion)
			if err == nil {
				gvk := schema.GroupVersionKind{
					Group:   gv.Group,
					Version: gv.Version,
					Kind:    kind,
				}
				h.logger.WithField("gvk", gvk).Debug("Successfully parsed GVK from typed object")
				return gvk, true
			} else {
				h.logger.WithError(err).WithField("apiVersion", apiVersion).Warn("Failed to parse APIVersion")
			}
		} else {
			h.logger.WithFields(map[string]interface{}{
				"apiVersion_empty": apiVersion == "",
				"kind_empty":       kind == "",
			}).Debug("APIVersion or Kind is empty")
		}
	} else {
		h.logger.Debug("APIVersion or Kind fields not found in object")

		// Try to get TypeMeta field directly
		typeMetaField := val.FieldByName("TypeMeta")
		if typeMetaField.IsValid() {
			h.logger.Debug("Found TypeMeta field, attempting to access its fields")
			typeMetaVal := typeMetaField
			if typeMetaVal.Kind() == reflect.Ptr {
				typeMetaVal = typeMetaVal.Elem()
			}

			if typeMetaVal.IsValid() {
				apiVersionField := typeMetaVal.FieldByName("APIVersion")
				kindField := typeMetaVal.FieldByName("Kind")

				if apiVersionField.IsValid() && kindField.IsValid() {
					apiVersion := apiVersionField.String()
					kind := kindField.String()

					h.logger.WithFields(map[string]interface{}{
						"apiVersion": apiVersion,
						"kind":       kind,
					}).Debug("Extracted APIVersion and Kind from TypeMeta field")

					if apiVersion != "" && kind != "" {
						gv, err := schema.ParseGroupVersion(apiVersion)
						if err == nil {
							gvk := schema.GroupVersionKind{
								Group:   gv.Group,
								Version: gv.Version,
								Kind:    kind,
							}
							h.logger.WithField("gvk", gvk).Debug("Successfully parsed GVK from TypeMeta field")
							return gvk, true
						}
					}
				}
			}
		}
	}

	return schema.GroupVersionKind{}, false
}

// ensureCompleteYAML ensures that the YAML includes all necessary Kubernetes resource fields
func (h *YAMLHandler) EnsureCompleteYAML(resource interface{}) ([]byte, error) {
	// Log the resource type for debugging
	h.logger.WithField("resource_type", fmt.Sprintf("%T", resource)).Info("Processing resource for YAML conversion")

	// First, marshal the resource to YAML
	yamlData, err := yaml.Marshal(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal resource to YAML: %w", err)
	}

	// Log the initial YAML for debugging
	h.logger.WithField("initial_yaml", string(yamlData)).Debug("Initial YAML marshaled from resource")

	// Parse the YAML to check for missing fields
	var resourceMap map[string]interface{}
	if err := yaml.Unmarshal(yamlData, &resourceMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal YAML for validation: %w", err)
	}

	// If the serialized structure contains a top-level "object" (common for
	// k8s unstructured.Unstructured), flatten it by promoting its contents to
	// the root and discarding the wrapper. This yields standard k8s YAML with
	// apiVersion/kind/metadata at the top level.
	if rawObj, ok := resourceMap["object"].(map[string]interface{}); ok {
		resourceMap = rawObj
	} else if rawObj, ok := resourceMap["Object"].(map[string]interface{}); ok {
		resourceMap = rawObj
	}

	// Log the resource map keys for debugging
	keys := make([]string, 0, len(resourceMap))
	for k := range resourceMap {
		keys = append(keys, k)
	}
	h.logger.WithField("resource_map_keys", keys).Debug("Resource map keys after unmarshaling")

	// Check for Kubernetes-style field names (typemeta/objectmeta) and convert them
	// Kubernetes objects often marshal to typemeta/objectmeta instead of apiVersion/kind/metadata
	if typemeta, ok := resourceMap["typemeta"].(map[string]interface{}); ok {
		h.logger.Info("Found typemeta field, converting to standard Kubernetes format")

		// Log all fields in typemeta for debugging
		typemetaKeys := make([]string, 0, len(typemeta))
		for k := range typemeta {
			typemetaKeys = append(typemetaKeys, k)
		}
		h.logger.WithField("typemeta_keys", typemetaKeys).Debug("All keys in typemeta field")

		// Log the actual values
		for key, value := range typemeta {
			h.logger.WithFields(map[string]interface{}{
				"typemeta_key":   key,
				"typemeta_value": value,
				"value_type":     fmt.Sprintf("%T", value),
			}).Debug("Typemeta field details")
		}

		if apiVersion, exists := typemeta["apiversion"]; exists {
			resourceMap["apiVersion"] = apiVersion
			h.logger.WithField("apiVersion", apiVersion).Info("Set apiVersion from typemeta")
		} else {
			h.logger.Warn("apiversion field not found in typemeta")
		}
		if kind, exists := typemeta["kind"]; exists {
			resourceMap["kind"] = kind
			h.logger.WithField("kind", kind).Info("Set kind from typemeta")
		} else {
			h.logger.Warn("kind field not found in typemeta")
		}
		// Remove the typemeta field as it's not standard Kubernetes YAML
		delete(resourceMap, "typemeta")
	} else {
		h.logger.Debug("typemeta field not found in resource map")
	}

	if objectmeta, ok := resourceMap["objectmeta"].(map[string]interface{}); ok {
		h.logger.Info("Found objectmeta field, converting to standard Kubernetes format")
		resourceMap["metadata"] = objectmeta
		// Remove the objectmeta field as it's not standard Kubernetes YAML
		delete(resourceMap, "objectmeta")
	}

	// Ensure required fields are present
	hasApiVersion := resourceMap["apiVersion"] != nil && resourceMap["apiVersion"] != ""
	hasKind := resourceMap["kind"] != nil && resourceMap["kind"] != ""
	hasMetadata := resourceMap["metadata"] != nil

	// Log the current state of required fields
	h.logger.WithFields(map[string]interface{}{
		"hasApiVersion": hasApiVersion,
		"hasKind":       hasKind,
		"hasMetadata":   hasMetadata,
		"apiVersion":    resourceMap["apiVersion"],
		"kind":          resourceMap["kind"],
	}).Debug("Required fields status before processing")

	// Check if metadata and name exist
	if hasMetadata {
		if metadata, ok := resourceMap["metadata"].(map[string]interface{}); ok {
			// Ensure name exists in metadata
			if metadata["name"] == nil || metadata["name"] == "" {
				// Try to get name from root level if it exists
				if resourceMap["name"] != nil && resourceMap["name"] != "" {
					metadata["name"] = resourceMap["name"]
				}
			}
		}
	}

	// If any required fields are missing, try to infer them from the resource type
	if !hasApiVersion || !hasKind {
		h.logger.Info("Missing required fields, attempting to infer from resource type")
		var gvk schema.GroupVersionKind
		var found bool

		// Try to get GVK from unstructured object first
		if unstructuredObj, ok := resource.(*unstructured.Unstructured); ok {
			gvk = unstructuredObj.GroupVersionKind()
			found = true
			h.logger.WithField("gvk", gvk).Debug("Got GVK from unstructured object")
		} else {
			// Try to get GVK from typed object using reflection
			gvk, found = h.getGVKFromTypedObject(resource)
			if found {
				h.logger.WithField("gvk", gvk).Debug("Got GVK from typed object using reflection")
			} else {
				h.logger.Warn("Could not determine GVK from resource type")

				// Try to infer GVK from the resource type name
				resourceType := fmt.Sprintf("%T", resource)
				h.logger.WithField("resource_type", resourceType).Debug("Attempting to infer GVK from resource type name")

				// Check for common Kubernetes resource types
				switch {
				// Workloads
				case strings.Contains(resourceType, "HorizontalPodAutoscaler"):
					gvk = schema.GroupVersionKind{Group: "autoscaling", Version: "v2", Kind: "HorizontalPodAutoscaler"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Deployment"):
					gvk = schema.GroupVersionKind{Group: "apps", Version: "v1", Kind: "Deployment"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "DaemonSet"):
					gvk = schema.GroupVersionKind{Group: "apps", Version: "v1", Kind: "DaemonSet"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "StatefulSet"):
					gvk = schema.GroupVersionKind{Group: "apps", Version: "v1", Kind: "StatefulSet"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "ReplicaSet"):
					gvk = schema.GroupVersionKind{Group: "apps", Version: "v1", Kind: "ReplicaSet"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Pod"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Pod"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Job"):
					gvk = schema.GroupVersionKind{Group: "batch", Version: "v1", Kind: "Job"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "CronJob"):
					gvk = schema.GroupVersionKind{Group: "batch", Version: "v1", Kind: "CronJob"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")

				// Core resources
				case strings.Contains(resourceType, "Service"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Service"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Endpoints"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Endpoints"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Ingress"):
					gvk = schema.GroupVersionKind{Group: "networking.k8s.io", Version: "v1", Kind: "Ingress"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "ConfigMap"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "ConfigMap"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Secret"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Secret"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Namespace"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Namespace"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Node"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Node"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Event"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Event"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "Lease"):
					gvk = schema.GroupVersionKind{Group: "coordination.k8s.io", Version: "v1", Kind: "Lease"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")

				// Storage
				case strings.Contains(resourceType, "PersistentVolume"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "PersistentVolume"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "PersistentVolumeClaim"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "PersistentVolumeClaim"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "StorageClass"):
					gvk = schema.GroupVersionKind{Group: "storage.k8s.io", Version: "v1", Kind: "StorageClass"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")

				// Access Control
				case strings.Contains(resourceType, "Role"):
					gvk = schema.GroupVersionKind{Group: "rbac.authorization.k8s.io", Version: "v1", Kind: "Role"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "RoleBinding"):
					gvk = schema.GroupVersionKind{Group: "rbac.authorization.k8s.io", Version: "v1", Kind: "RoleBinding"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "ClusterRole"):
					gvk = schema.GroupVersionKind{Group: "rbac.authorization.k8s.io", Version: "v1", Kind: "ClusterRole"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "ClusterRoleBinding"):
					gvk = schema.GroupVersionKind{Group: "rbac.authorization.k8s.io", Version: "v1", Kind: "ClusterRoleBinding"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "ServiceAccount"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "ServiceAccount"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")

				// Configuration
				case strings.Contains(resourceType, "LimitRange"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "LimitRange"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "ResourceQuota"):
					gvk = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "ResourceQuota"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "PriorityClass"):
					gvk = schema.GroupVersionKind{Group: "scheduling.k8s.io", Version: "v1", Kind: "PriorityClass"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "RuntimeClass"):
					gvk = schema.GroupVersionKind{Group: "node.k8s.io", Version: "v1", Kind: "RuntimeClass"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")
				case strings.Contains(resourceType, "PodDisruptionBudget"):
					gvk = schema.GroupVersionKind{Group: "policy", Version: "v1", Kind: "PodDisruptionBudget"}
					found = true
					h.logger.WithField("gvk", gvk).Info("Inferred GVK from resource type name")

				default:
					h.logger.WithField("resource_type", resourceType).Warn("Could not infer GVK from resource type name")
				}
			}
		}

		if found {
			if !hasApiVersion && gvk.Version != "" {
				apiVersion := ""
				if gvk.Group != "" {
					apiVersion = gvk.Group + "/" + gvk.Version
				} else {
					apiVersion = gvk.Version
				}
				resourceMap["apiVersion"] = apiVersion
				h.logger.WithField("apiVersion", apiVersion).Info("Set apiVersion from GVK")
			}
			if !hasKind && gvk.Kind != "" {
				resourceMap["kind"] = gvk.Kind
				h.logger.WithField("kind", gvk.Kind).Info("Set kind from GVK")
			}
		}
	}

	// Ensure metadata exists
	if !hasMetadata {
		resourceMap["metadata"] = map[string]interface{}{
			"name": resourceMap["name"], // Try to preserve name if it exists at root level
		}
	}

	// Log the final resource map keys
	finalKeys := make([]string, 0, len(resourceMap))
	for k := range resourceMap {
		finalKeys = append(finalKeys, k)
	}
	h.logger.WithField("final_resource_map_keys", finalKeys).Debug("Final resource map keys before marshaling")

	// Re-marshal the complete resource
	completeYAML, err := yaml.Marshal(resourceMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal complete YAML: %w", err)
	}

	// Log the final YAML for debugging
	h.logger.WithField("final_yaml", string(completeYAML)).Debug("Final YAML after processing")

	return completeYAML, nil
}

// SendYAMLResponse sends a YAML response in the appropriate format based on the Accept header
func (h *YAMLHandler) SendYAMLResponse(c *gin.Context, resource interface{}, resourceName string) {
	// Ensure the YAML is complete with all necessary fields
	yamlData, err := h.EnsureCompleteYAML(resource)
	if err != nil {
		h.logger.WithError(err).Error("Failed to ensure complete YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send proper SSE format
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Cache-Control")

		// Send the YAML data as base64 encoded string in SSE format
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		c.SSEvent("message", gin.H{"data": encodedYAML})
		c.Writer.Flush()
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// SendYAMLResponseWithSSE sends a YAML response with SSE support
func (h *YAMLHandler) SendYAMLResponseWithSSE(c *gin.Context, resource interface{}, sseHandler func(*gin.Context, interface{})) {
	// Ensure the YAML is complete with all necessary fields
	yamlData, err := h.EnsureCompleteYAML(resource)
	if err != nil {
		h.logger.WithError(err).Error("Failed to ensure complete YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send the YAML data as base64 encoded string
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		sseHandler(c, gin.H{"data": encodedYAML})
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// ValidateYAML validates YAML content and returns validation errors
func (h *YAMLHandler) ValidateYAML(yamlContent string) ([]string, error) {
	var errors []string

	// Check for basic YAML syntax
	var resourceMap map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &resourceMap); err != nil {
		return []string{fmt.Sprintf("Invalid YAML syntax: %v", err)}, nil
	}

	// Check for required Kubernetes fields
	if resourceMap["apiVersion"] == nil || resourceMap["apiVersion"] == "" {
		errors = append(errors, "Missing required field: apiVersion")
	}

	if resourceMap["kind"] == nil || resourceMap["kind"] == "" {
		errors = append(errors, "Missing required field: kind")
	}

	if resourceMap["metadata"] == nil {
		errors = append(errors, "Missing required field: metadata")
	} else {
		if metadata, ok := resourceMap["metadata"].(map[string]interface{}); ok {
			if metadata["name"] == nil || metadata["name"] == "" {
				errors = append(errors, "Missing required field: metadata.name")
			}
		} else {
			errors = append(errors, "Invalid metadata format")
		}
	}

	return errors, nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// getMapKeys returns a slice of keys from a map
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
