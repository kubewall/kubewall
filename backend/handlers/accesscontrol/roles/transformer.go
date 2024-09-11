package roles

import (
	"fmt"
	"github.com/maruel/natural"
	rbacV1 "k8s.io/api/rbac/v1"
	"sort"
	"time"
)

type Role struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Spec      Spec      `json:"spec"`
}

type Spec struct {
	Rules int `json:"rules"`
}

func TransformRoleList(itemList []rbacV1.Role) []Role {
	list := make([]Role, 0)

	for _, d := range itemList {
		list = append(list, TransformServiceAccountsItems(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformServiceAccountsItems(item rbacV1.Role) Role {
	return Role{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
		Spec: Spec{
			Rules: len(item.Rules),
		},
	}
}
