package ingresses

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"strconv"
	"time"

	networkingV1 "k8s.io/api/networking/v1"
)

type Endpoint struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Spec      Spec      `json:"spec"`
	Age       time.Time `json:"age"`
}

type Spec struct {
	Rules []string `json:"rules"`
}

func TransformIngress(pvs []networkingV1.Ingress) []Endpoint {
	list := make([]Endpoint, 0)

	for _, d := range pvs {
		list = append(list, TransformIngressItem(d))
	}
	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformIngressItem(item networkingV1.Ingress) Endpoint {
	// This will give empty array instead of null
	rules := make([]string, 0)

	for _, i := range item.Spec.Rules {
		if i.HTTP != nil {
			for _, p := range i.HTTP.Paths {
				if p.Backend.Service != nil {
					number := int(p.Backend.Service.Port.Number)
					rules = append(rules, fmt.Sprintf("%s --> %s:%s", p.Path, p.Backend.Service.Name, strconv.Itoa(number)))
				}
			}
		}
	}
	return Endpoint{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Spec: Spec{
			Rules: rules,
		},
		Age: item.CreationTimestamp.Time,
	}
}
