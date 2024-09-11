package namespaces

import (
	"encoding/json"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"
)

type Namespace struct {
	Metadata struct {
		Name              string            `json:"name"`
		UID               string            `json:"uid"`
		ResourceVersion   string            `json:"resourceVersion"`
		CreationTimestamp time.Time         `json:"creationTimestamp"`
		Labels            map[string]string `json:"labels"`
	} `json:"metadata"`
	Spec struct {
		Finalizers []string `json:"finalizers"`
	} `json:"spec"`
	Status struct {
		Phase string `json:"phase"`
	} `json:"status"`
}

func TransformNamespaces(namespaces []v1.Namespace) []Namespace {
	list := []Namespace{}

	for _, p := range namespaces {
		list = append(list, TransformNamespace(p))
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].Metadata.Name < list[j].Metadata.Name
	})

	return list
}

func TransformNamespace(pods v1.Namespace) Namespace {
	var transformed Namespace
	b, err := json.Marshal(pods)
	if err != nil {
		return Namespace{}
	}
	err = json.Unmarshal(b, &transformed)
	if err != nil {
		return Namespace{}
	}

	return transformed
}
