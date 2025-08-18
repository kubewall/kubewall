package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/restmapper"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/yaml"
)

// cleanObjectForPatch removes fields that should not be included in server-side apply patches
func cleanObjectForPatch(obj *unstructured.Unstructured) {
	// Remove status field - it's managed by Kubernetes
	delete(obj.Object, "status")

	// Remove metadata fields that are managed by Kubernetes
	if metadata, exists := obj.Object["metadata"].(map[string]interface{}); exists {
		// Remove resourceVersion - it's managed by Kubernetes and causes conflicts
		delete(metadata, "resourceVersion")
		// Remove generation - it's managed by Kubernetes
		delete(metadata, "generation")
		// Remove uid - it's managed by Kubernetes
		delete(metadata, "uid")
		// Remove creationTimestamp - it's managed by Kubernetes
		delete(metadata, "creationTimestamp")
		// Remove managedFields - it's managed by Kubernetes
		delete(metadata, "managedFields")
		// Remove finalizers - they should be managed carefully
		delete(metadata, "finalizers")
		// Remove ownerReferences - they should be managed carefully
		delete(metadata, "ownerReferences")
		// Remove generateName - it's managed by Kubernetes
		delete(metadata, "generateName")
		// Remove deletionGracePeriodSeconds - it's managed by Kubernetes
		delete(metadata, "deletionGracePeriodSeconds")
	}

	// Remove spec fields that might not be declared in schema
	if spec, exists := obj.Object["spec"].(map[string]interface{}); exists {
		// Remove minReadySeconds if it's not declared in schema for this resource
		delete(spec, "minReadySeconds")
		// Remove other potentially problematic fields
		delete(spec, "revisionHistoryLimit")
		delete(spec, "progressDeadlineSeconds")

		// Clean selector matchLabels if it exists
		if selector, exists := spec["selector"].(map[string]interface{}); exists {
			if _, exists := selector["matchLabels"].(map[string]interface{}); exists {
				// Remove matchLabels if it's causing schema issues
				delete(selector, "matchLabels")
			}
		}

		// Clean strategy rollingUpdate if it exists
		if strategy, exists := spec["strategy"].(map[string]interface{}); exists {
			if _, exists := strategy["rollingUpdate"].(map[string]interface{}); exists {
				// Remove rollingUpdate if it's causing schema issues
				delete(strategy, "rollingUpdate")
			}
		}

		// Clean template metadata if it exists
		if template, exists := spec["template"].(map[string]interface{}); exists {
			if templateMetadata, exists := template["metadata"].(map[string]interface{}); exists {
				// Remove problematic template metadata fields
				delete(templateMetadata, "generateName")
				delete(templateMetadata, "resourceVersion")
				delete(templateMetadata, "generation")
				delete(templateMetadata, "uid")
				delete(templateMetadata, "creationTimestamp")
				delete(templateMetadata, "managedFields")
			}
		}
	}
}

// ApplyResources handles applying one or more Kubernetes resources provided as YAML.
// It performs basic validation and uses server-side apply for idempotent creation/update.
// Request: multipart/form-data with field "yaml" containing one or more YAML documents (--- separated)
// Query params: config, cluster
func (h *ResourcesHandler) ApplyResources(c *gin.Context) {
	// Read YAML content from form field
	yamlContent := c.PostForm("yaml")
	if strings.TrimSpace(yamlContent) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "yaml field is required", "code": http.StatusBadRequest})
		return
	}

	// Prepare clients and REST mapper
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for apply")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}

	clientset, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get clientset for apply")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}

	disco := clientset.Discovery()
	restMapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(disco))

	// Prepare decoder for multi-document YAML
	decoder := utilyaml.NewYAMLOrJSONDecoder(strings.NewReader(yamlContent), 4096)

	type failure struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace,omitempty"`
		Kind      string `json:"kind,omitempty"`
		Group     string `json:"group,omitempty"`
		Version   string `json:"version,omitempty"`
		Message   string `json:"message"`
	}
	var failures []failure
	var appliedCount int
	type appliedResource struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace,omitempty"`
		Kind      string `json:"kind"`
		Group     string `json:"group"`
		Version   string `json:"version"`
		Resource  string `json:"resource"`
	}
	var appliedResources []appliedResource

	for {
		// Decode each document into a map first to allow empty docs to be skipped
		var raw map[string]interface{}
		if err := decoder.Decode(&raw); err != nil {
			if err == io.EOF {
				break
			}
			failures = append(failures, failure{Message: fmt.Sprintf("failed to decode YAML: %v", err)})
			break
		}

		if len(raw) == 0 {
			// Skip empty documents (e.g., extra --- at end)
			continue
		}

		obj := &unstructured.Unstructured{Object: raw}
		gvk := obj.GroupVersionKind()

		// Clean the object to remove fields that shouldn't be in patches
		cleanObjectForPatch(obj)

		// Enhanced validation for required fields
		if gvk.Empty() || gvk.Kind == "" || gvk.Version == "" {
			missingFields := []string{}
			if gvk.Kind == "" {
				missingFields = append(missingFields, "kind")
			}
			if gvk.Version == "" {
				missingFields = append(missingFields, "apiVersion")
			}

			failures = append(failures, failure{
				Name:    obj.GetName(),
				Message: fmt.Sprintf("missing required fields: %s", strings.Join(missingFields, ", ")),
			})
			continue
		}

		// Validate metadata and name
		if obj.GetName() == "" {
			failures = append(failures, failure{
				Name:    "unknown",
				Kind:    gvk.Kind,
				Group:   gvk.Group,
				Version: gvk.Version,
				Message: "missing required field: metadata.name",
			})
			continue
		}

		mapping, mapErr := restMapper.RESTMapping(schema.GroupKind{Group: gvk.Group, Kind: gvk.Kind}, gvk.Version)
		if mapErr != nil {
			failures = append(failures, failure{
				Name:    obj.GetName(),
				Kind:    gvk.Kind,
				Group:   gvk.Group,
				Version: gvk.Version,
				Message: fmt.Sprintf("failed to resolve GVK to resource: %v", mapErr),
			})
			continue
		}

		// Determine resource interface based on scope
		var ri dynamicResourceInterface
		if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
			ns := obj.GetNamespace()
			if strings.TrimSpace(ns) == "" {
				// Default to "default" namespace when not provided
				ns = "default"
				obj.SetNamespace(ns)
			}
			ri = dynamicResourceInterface{namespaced: true, ns: ns, resource: mapping.Resource}
		} else {
			ri = dynamicResourceInterface{namespaced: false, resource: mapping.Resource}
		}

		// Marshal object back to YAML for server-side apply
		payload, mErr := yaml.Marshal(obj.Object)
		if mErr != nil {
			failures = append(failures, failure{
				Name:    obj.GetName(),
				Kind:    gvk.Kind,
				Group:   gvk.Group,
				Version: gvk.Version,
				Message: fmt.Sprintf("failed to marshal object to YAML: %v", mErr),
			})
			continue
		}

		// Perform server-side apply (idempotent)
		var patchErr error
		if ri.namespaced {
			_, patchErr = dynamicClient.Resource(ri.resource).Namespace(ri.ns).Patch(
				c.Request.Context(),
				obj.GetName(),
				types.ApplyPatchType,
				payload,
				metav1.PatchOptions{FieldManager: "kube-dash", Force: ptr.To(true)},
			)
		} else {
			_, patchErr = dynamicClient.Resource(ri.resource).Patch(
				c.Request.Context(),
				obj.GetName(),
				types.ApplyPatchType,
				payload,
				metav1.PatchOptions{FieldManager: "kube-dash", Force: ptr.To(true)},
			)
		}

		if patchErr != nil {
			failures = append(failures, failure{
				Name:      obj.GetName(),
				Namespace: obj.GetNamespace(),
				Kind:      gvk.Kind,
				Group:     gvk.Group,
				Version:   gvk.Version,
				Message:   patchErr.Error(),
			})
			continue
		}

		appliedCount++
		appliedResources = append(appliedResources, appliedResource{
			Name:      obj.GetName(),
			Namespace: obj.GetNamespace(),
			Kind:      gvk.Kind,
			Group:     gvk.Group,
			Version:   gvk.Version,
			Resource:  mapping.Resource.Resource,
		})
	}

	if len(failures) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message":          "failed to apply one or more resources",
			"code":             http.StatusBadRequest,
			"details":          failures,
			"applied":          appliedCount,
			"failed":           len(failures),
			"appliedResources": appliedResources,
		})
		return
	}

	// Success: return 200 with applied resources for client navigation
	c.JSON(http.StatusOK, gin.H{
		"message":          "applied",
		"applied":          appliedCount,
		"appliedResources": appliedResources,
	})
}

type dynamicResourceInterface struct {
	namespaced bool
	ns         string
	resource   schema.GroupVersionResource
}
