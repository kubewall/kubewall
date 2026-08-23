package networkpolicies

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/maruel/natural"
	networkingV1 "k8s.io/api/networking/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type NetworkPolicy struct {
	UID         types.UID `json:"uid"`
	Namespace   string    `json:"namespace"`
	Name        string    `json:"name"`
	Age         time.Time `json:"age"`
	PodSelector string    `json:"podSelector"`
	PolicyTypes string    `json:"policyTypes"`
}

func TransformNetworkPolicy(items []networkingV1.NetworkPolicy) []NetworkPolicy {
	list := make([]NetworkPolicy, 0)

	for _, d := range items {
		list = append(list, TransformNetworkPolicyItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformNetworkPolicyItem(item networkingV1.NetworkPolicy) NetworkPolicy {
	policyTypes := make([]string, 0, len(item.Spec.PolicyTypes))
	for _, policyType := range item.Spec.PolicyTypes {
		policyTypes = append(policyTypes, string(policyType))
	}

	return NetworkPolicy{
		UID:         item.GetUID(),
		Namespace:   item.GetNamespace(),
		Name:        item.GetName(),
		Age:         item.CreationTimestamp.Time,
		PodSelector: podSelector(item.Spec.PodSelector),
		PolicyTypes: strings.Join(policyTypes, ", "),
	}
}

// An empty selector selects every pod in the namespace, which is the opposite
// of selecting none - say so rather than printing nothing.
func podSelector(selector metaV1.LabelSelector) string {
	s := metaV1.FormatLabelSelector(&selector)
	if s == "" || s == "<none>" {
		return "<all pods>"
	}
	return s
}
