package clusterroles

import (
	"sort"
	"time"

	"github.com/maruel/natural"
	rbacV1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/types"
)

type ClusterRole struct {
	UID       types.UID `json:"uid"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Spec      Spec      `json:"spec"`
}

type Spec struct {
	Rules int `json:"rules"`
}

func TransformClusterRoleList(itemList []rbacV1.ClusterRole) []ClusterRole {
	list := make([]ClusterRole, 0)

	for _, d := range itemList {
		list = append(list, TransformClusterRoleListItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformClusterRoleListItem(item rbacV1.ClusterRole) ClusterRole {
	return ClusterRole{
		UID:       item.GetUID(),
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
		Spec: Spec{
			Rules: len(item.Rules),
		},
	}
}
