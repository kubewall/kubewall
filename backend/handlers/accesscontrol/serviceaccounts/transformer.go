package serviceaccounts

import (
	"github.com/maruel/natural"
	"sort"
	"time"

	coreV1 "k8s.io/api/core/v1"
)

type ServiceAccount struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Spec      Spec      `json:"spec"`
}

type Spec struct {
	Secrets int `json:"secrets"`
}

func TransformServiceAccountsList(itemList []coreV1.ServiceAccount) []ServiceAccount {
	list := make([]ServiceAccount, 0)

	for _, d := range itemList {
		list = append(list, TransformServiceAccountsItems(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformServiceAccountsItems(item coreV1.ServiceAccount) ServiceAccount {
	return ServiceAccount{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
		Spec: Spec{
			Secrets: len(item.Secrets),
		},
	}
}
