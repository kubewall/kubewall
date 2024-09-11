package rolebindings

import (
	"github.com/maruel/natural"
	rbacV1 "k8s.io/api/rbac/v1"
	"sort"
	"time"
)

type RoleBinding struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Subjects  Subjects  `json:"subjects"`
}

type Subjects struct {
	Bindings []string `json:"bindings"`
}

func TransformRoleBindingList(itemList []rbacV1.RoleBinding) []RoleBinding {
	list := make([]RoleBinding, 0)

	for _, d := range itemList {
		list = append(list, TransformRoleBindingItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformRoleBindingItem(item rbacV1.RoleBinding) RoleBinding {
	bindings := make([]string, 0)

	for _, v := range item.Subjects {
		bindings = append(bindings, v.Name)
	}
	return RoleBinding{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
		Subjects: Subjects{
			Bindings: bindings,
		},
	}
}
