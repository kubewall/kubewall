package leases

import (
	"fmt"
	"sort"
	"time"

	"github.com/maruel/natural"
	v1 "k8s.io/api/coordination/v1"
	"k8s.io/apimachinery/pkg/types"
)

type Lease struct {
	UID                  types.UID `json:"uid"`
	Namespace            string    `json:"namespace"`
	Name                 string    `json:"name"`
	HolderIdentity       *string   `json:"holderIdentity"`
	LeaseDurationSeconds *int32    `json:"leaseDurationSeconds"`
	Age                  time.Time `json:"age"`
}

func TransformLeaseList(secrets []v1.Lease) []Lease {
	list := make([]Lease, 0)

	for _, d := range secrets {
		list = append(list, TransformRunTimeClassItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformRunTimeClassItem(item v1.Lease) Lease {
	return Lease{
		UID:                  item.GetUID(),
		Namespace:            item.GetNamespace(),
		Name:                 item.GetName(),
		HolderIdentity:       item.Spec.HolderIdentity,
		LeaseDurationSeconds: item.Spec.LeaseDurationSeconds,
		Age:                  item.CreationTimestamp.Time,
	}
}
