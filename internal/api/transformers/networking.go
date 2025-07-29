package transformers

import (
	"fmt"
	"strings"

	"kubewall-backend/internal/api/types"

	v1 "k8s.io/api/core/v1"
	networkingV1 "k8s.io/api/networking/v1"
)

// TransformServiceToResponse transforms a Kubernetes service to the frontend-expected format
func TransformServiceToResponse(service *v1.Service) types.ServiceListResponse {
	age := types.TimeFormat(service.CreationTimestamp.Time)

	// Format ports
	var ports []string
	for _, port := range service.Spec.Ports {
		portStr := fmt.Sprintf("%d/%s", port.Port, port.Protocol)
		if port.NodePort != 0 {
			portStr = fmt.Sprintf("%s:%d", portStr, port.NodePort)
		}
		ports = append(ports, portStr)
	}

	// Format external IPs
	var externalIPs []string
	if service.Spec.ExternalIPs != nil {
		externalIPs = service.Spec.ExternalIPs
	}

	return types.ServiceListResponse{
		Age:        age,
		HasUpdated: false, // This would be set based on resource version comparison
		Name:       service.Name,
		Namespace:  service.Namespace,
		UID:        string(service.UID),
		Spec: struct {
			Ports                 string `json:"ports"`
			ClusterIP             string `json:"clusterIP"`
			Type                  string `json:"type"`
			SessionAffinity       string `json:"sessionAffinity"`
			IPFamilyPolicy        string `json:"ipFamilyPolicy"`
			InternalTrafficPolicy string `json:"internalTrafficPolicy"`
			ExternalIPs           string `json:"externalIPs"`
		}{
			Ports:                 strings.Join(ports, ", "),
			ClusterIP:             service.Spec.ClusterIP,
			Type:                  string(service.Spec.Type),
			SessionAffinity:       string(service.Spec.SessionAffinity),
			IPFamilyPolicy:        func() string {
				if service.Spec.IPFamilyPolicy != nil {
					return string(*service.Spec.IPFamilyPolicy)
				}
				return ""
			}(),
			InternalTrafficPolicy: func() string {
				if service.Spec.InternalTrafficPolicy != nil {
					return string(*service.Spec.InternalTrafficPolicy)
				}
				return ""
			}(),
			ExternalIPs:           strings.Join(externalIPs, ", "),
		},
	}
}

// TransformIngressToResponse transforms a Kubernetes ingress to the frontend-expected format
func TransformIngressToResponse(ingress *networkingV1.Ingress) types.IngressListResponse {
	age := types.TimeFormat(ingress.CreationTimestamp.Time)

	// Format rules
	var rules []string
	for _, rule := range ingress.Spec.Rules {
		ruleStr := rule.Host
		if rule.Host == "" {
			ruleStr = "*"
		}
		rules = append(rules, ruleStr)
	}

	return types.IngressListResponse{
		Age:        age,
		HasUpdated: false, // This would be set based on resource version comparison
		Name:       ingress.Name,
		Namespace:  ingress.Namespace,
		UID:        string(ingress.UID),
		Spec: struct {
			Rules []string `json:"rules"`
		}{
			Rules: rules,
		},
	}
}

// TransformEndpointToResponse transforms a Kubernetes endpoint to the frontend-expected format
func TransformEndpointToResponse(endpoint *v1.Endpoints) types.EndpointListResponse {
	age := types.TimeFormat(endpoint.CreationTimestamp.Time)

	// Format addresses and ports
	var addresses []string
	var ports []string

	for _, subset := range endpoint.Subsets {
		for _, address := range subset.Addresses {
			addresses = append(addresses, address.IP)
		}
		for _, port := range subset.Ports {
			portStr := fmt.Sprintf("%d/%s", port.Port, port.Protocol)
			ports = append(ports, portStr)
		}
	}

	return types.EndpointListResponse{
		Age:        age,
		HasUpdated: false, // This would be set based on resource version comparison
		Name:       endpoint.Name,
		Namespace:  endpoint.Namespace,
		UID:        string(endpoint.UID),
		Subsets: struct {
			Addresses []string `json:"addresses"`
			Ports     []string `json:"ports"`
		}{
			Addresses: addresses,
			Ports:     ports,
		},
	}
}
