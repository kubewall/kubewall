package endpoints

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"strconv"
	"time"

	v1 "k8s.io/api/core/v1"
)

type Endpoint struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Subsets   Subsets   `json:"subsets"`
	Age       time.Time `json:"age"`
}

type Subsets struct {
	Addresses []string `json:"addresses"`
	Ports     []string `json:"ports"`
}

func TransformEndpoint(pvs []v1.Endpoints) []Endpoint {
	list := make([]Endpoint, 0)

	for _, d := range pvs {
		list = append(list, TransformEndpointItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformEndpointItem(item v1.Endpoints) Endpoint {
	ports := make([]string, 0)
	ips := make([]string, 0)

	for _, i := range item.Subsets {
		for _, v := range i.Addresses {
			ips = append(ips, v.IP)
		}
		for _, p := range i.Ports {
			if len(p.Name) > 0 {
				ports = append(ports, fmt.Sprintf("%s/%s (%s)", strconv.Itoa(int(p.Port)), p.Protocol, p.Name))
			} else {
				ports = append(ports, fmt.Sprintf("%s/%s", strconv.Itoa(int(p.Port)), p.Protocol))
			}
		}
	}
	return Endpoint{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Subsets: Subsets{
			Addresses: ips,
			Ports:     ports,
		},
		Age: item.CreationTimestamp.Time,
	}
}
