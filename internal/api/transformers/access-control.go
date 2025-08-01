package transformers

import (
	"strings"
	"time"

	v1 "k8s.io/api/core/v1"
	rbacV1 "k8s.io/api/rbac/v1"

	"github.com/Facets-cloud/kube-dash/internal/api/types"
)

// TransformServiceAccountToResponse transforms a ServiceAccount to the frontend-expected format
func TransformServiceAccountToResponse(serviceAccount *v1.ServiceAccount) types.ServiceAccountListResponse {
	age := ""
	if !serviceAccount.CreationTimestamp.IsZero() {
		age = serviceAccount.CreationTimestamp.Time.Format(time.RFC3339)
	}

	return types.ServiceAccountListResponse{
		BaseResponse: types.BaseResponse{
			Age:        age,
			HasUpdated: false,
			Name:       serviceAccount.Name,
			UID:        string(serviceAccount.UID),
		},
		Namespace: serviceAccount.Namespace,
		Spec: struct {
			Secrets int `json:"secrets"`
		}{
			Secrets: len(serviceAccount.Secrets),
		},
	}
}

// TransformRoleToResponse transforms a Role to the frontend-expected format
func TransformRoleToResponse(role *rbacV1.Role) types.RoleListResponse {
	age := ""
	if !role.CreationTimestamp.IsZero() {
		age = role.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Transform rules to string format
	var rules []string
	for _, rule := range role.Rules {
		var ruleStr strings.Builder
		if len(rule.APIGroups) > 0 {
			ruleStr.WriteString("APIGroups: " + strings.Join(rule.APIGroups, ", "))
		}
		if len(rule.Resources) > 0 {
			if ruleStr.Len() > 0 {
				ruleStr.WriteString("; ")
			}
			ruleStr.WriteString("Resources: " + strings.Join(rule.Resources, ", "))
		}
		if len(rule.Verbs) > 0 {
			if ruleStr.Len() > 0 {
				ruleStr.WriteString("; ")
			}
			ruleStr.WriteString("Verbs: " + strings.Join(rule.Verbs, ", "))
		}
		if ruleStr.Len() > 0 {
			rules = append(rules, ruleStr.String())
		}
	}

	return types.RoleListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       role.Name,
				UID:        string(role.UID),
			},
			Namespace: role.Namespace,
		},
		Spec: struct {
			Rules []string `json:"rules"`
		}{
			Rules: rules,
		},
	}
}

// TransformRoleBindingToResponse transforms a RoleBinding to the frontend-expected format
func TransformRoleBindingToResponse(roleBinding *rbacV1.RoleBinding) types.RoleBindingListResponse {
	age := ""
	if !roleBinding.CreationTimestamp.IsZero() {
		age = roleBinding.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Transform subjects to string format
	var bindings []string
	for _, subject := range roleBinding.Subjects {
		binding := subject.Kind + "/" + subject.Name
		if subject.Namespace != "" {
			binding += " in " + subject.Namespace
		}
		bindings = append(bindings, binding)
	}

	return types.RoleBindingListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       roleBinding.Name,
				UID:        string(roleBinding.UID),
			},
			Namespace: roleBinding.Namespace,
		},
		Subjects: struct {
			Bindings []string `json:"bindings"`
		}{
			Bindings: bindings,
		},
	}
}

// TransformClusterRoleToResponse transforms a ClusterRole to the frontend-expected format
func TransformClusterRoleToResponse(clusterRole *rbacV1.ClusterRole) types.ClusterRoleListResponse {
	age := ""
	if !clusterRole.CreationTimestamp.IsZero() {
		age = clusterRole.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Transform rules to string format
	var rules []string
	for _, rule := range clusterRole.Rules {
		var ruleStr strings.Builder
		if len(rule.APIGroups) > 0 {
			ruleStr.WriteString("APIGroups: " + strings.Join(rule.APIGroups, ", "))
		}
		if len(rule.Resources) > 0 {
			if ruleStr.Len() > 0 {
				ruleStr.WriteString("; ")
			}
			ruleStr.WriteString("Resources: " + strings.Join(rule.Resources, ", "))
		}
		if len(rule.Verbs) > 0 {
			if ruleStr.Len() > 0 {
				ruleStr.WriteString("; ")
			}
			ruleStr.WriteString("Verbs: " + strings.Join(rule.Verbs, ", "))
		}
		if ruleStr.Len() > 0 {
			rules = append(rules, ruleStr.String())
		}
	}

	return types.ClusterRoleListResponse{
		BaseResponse: types.BaseResponse{
			Age:        age,
			HasUpdated: false,
			Name:       clusterRole.Name,
			UID:        string(clusterRole.UID),
		},
		Spec: struct {
			Rules []string `json:"rules"`
		}{
			Rules: rules,
		},
	}
}

// TransformClusterRoleBindingToResponse transforms a ClusterRoleBinding to the frontend-expected format
func TransformClusterRoleBindingToResponse(clusterRoleBinding *rbacV1.ClusterRoleBinding) types.ClusterRoleBindingListResponse {
	age := ""
	if !clusterRoleBinding.CreationTimestamp.IsZero() {
		age = clusterRoleBinding.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Transform subjects to string format
	var bindings []string
	for _, subject := range clusterRoleBinding.Subjects {
		binding := subject.Kind + "/" + subject.Name
		if subject.Namespace != "" {
			binding += " in " + subject.Namespace
		}
		bindings = append(bindings, binding)
	}

	return types.ClusterRoleBindingListResponse{
		BaseResponse: types.BaseResponse{
			Age:        age,
			HasUpdated: false,
			Name:       clusterRoleBinding.Name,
			UID:        string(clusterRoleBinding.UID),
		},
		Subjects: struct {
			Bindings []string `json:"bindings"`
		}{
			Bindings: bindings,
		},
	}
}
