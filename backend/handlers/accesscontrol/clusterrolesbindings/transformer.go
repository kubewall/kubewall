package clusterrolebindings

import (
	"github.com/maruel/natural"
	rbacV1 "k8s.io/api/rbac/v1"
	"sort"
	"time"
)

type ClusterRoleBinding struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Subjects  Subjects  `json:"subjects"`
}

type Subjects struct {
	Bindings []string `json:"bindings"`
}

func TransformClusterRoleBindingList(itemList []rbacV1.ClusterRoleBinding) []ClusterRoleBinding {
	list := make([]ClusterRoleBinding, 0)

	for _, d := range itemList {
		list = append(list, TransformClusterRoleBindingItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformClusterRoleBindingItem(item rbacV1.ClusterRoleBinding) ClusterRoleBinding {
	bindings := make([]string, 0)

	for _, v := range item.Subjects {
		bindings = append(bindings, v.Name)
	}
	return ClusterRoleBinding{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
		Subjects: Subjects{
			Bindings: bindings,
		},
	}
}
