package endpoints

import (
	"fmt"

	"github.com/maruel/natural"
	"k8s.io/apimachinery/pkg/types"

	"sort"
	"strconv"
	"time"

	discoveryv1 "k8s.io/api/discovery/v1"
)

type Endpoint struct {
	UID       types.UID `json:"uid"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Subsets   Subsets   `json:"subsets"`
	Age       time.Time `json:"age"`
}

type Subsets struct {
	Addresses []string `json:"addresses"`
	Ports     []string `json:"ports"`
}

func TransformEndpoint(pvs []discoveryv1.EndpointSlice) []Endpoint {
	list := make([]Endpoint, 0)

	for _, d := range pvs {
		list = append(list, TransformEndpointSliceItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformEndpointSliceItem(item discoveryv1.EndpointSlice) Endpoint {
	ports := make([]string, 0)
	ips := make([]string, 0)

	for _, ep := range item.Endpoints {
		ips = append(ips, ep.Addresses...)
	}

	for _, p := range item.Ports {
		portNum := "unknown"
		protocol := "unknown"

		if p.Port != nil {
			portNum = strconv.Itoa(int(*p.Port))
		}
		if p.Protocol != nil {
			protocol = string(*p.Protocol)
		}
		if p.Name != nil && *p.Name != "" {
			ports = append(ports, fmt.Sprintf("%s/%s (%s)", portNum, protocol, *p.Name))
		} else {
			ports = append(ports, fmt.Sprintf("%s/%s", portNum, protocol))
		}
	}

	return Endpoint{
		UID:       item.GetUID(),
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Subsets: Subsets{
			Addresses: ips,
			Ports:     ports,
		},
		Age: item.CreationTimestamp.Time,
	}
}
