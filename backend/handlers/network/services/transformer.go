package services

import (
	"fmt"

	"github.com/maruel/natural"
	"k8s.io/apimachinery/pkg/types"

	"sort"
	"strings"
	"time"

	v1 "k8s.io/api/core/v1"
)

type Services struct {
	UID       types.UID `json:"uid"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Spec      Spec      `json:"spec"`
	Age       time.Time `json:"age"`
}

type Spec struct {
	Ports                 string                           `json:"ports"`
	ClusterIP             string                           `json:"clusterIP"`
	ExternalIPs           []string                         `json:"externalIPs"`
	Type                  v1.ServiceType                   `json:"type"`
	SessionAffinity       v1.ServiceAffinity               `json:"sessionAffinity"`
	IpFamilyPolicy        *v1.IPFamilyPolicy               `json:"ipFamilyPolicy"`
	InternalTrafficPolicy *v1.ServiceInternalTrafficPolicy `json:"internalTrafficPolicy"`
}

func TransformServices(pvs []v1.Service) []Services {
	list := make([]Services, 0)

	for _, d := range pvs {
		list = append(list, TransformServiceItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformServiceItem(item v1.Service) Services {
	ports := make([]string, 0)
	ips := make([]string, 0)

	for _, port := range item.Spec.Ports {
		ports = append(ports, fmt.Sprintf("%d/%s", port.Port, port.Protocol))
	}

	if item.Spec.Type == v1.ServiceTypeLoadBalancer {
		ingress := item.Status.LoadBalancer.Ingress
		for _, ingress := range ingress {
			ips = append(ips, ingress.IP)
		}
	}

	return Services{
		UID:       item.GetUID(),
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Spec: Spec{
			Ports:                 strings.Join(ports, ","),
			ClusterIP:             item.Spec.ClusterIP,
			ExternalIPs:           ips,
			Type:                  item.Spec.Type,
			SessionAffinity:       item.Spec.SessionAffinity,
			IpFamilyPolicy:        item.Spec.IPFamilyPolicy,
			InternalTrafficPolicy: item.Spec.InternalTrafficPolicy,
		},

		Age: item.CreationTimestamp.Time,
	}
}
