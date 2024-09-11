package configmaps

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"
)

type ConfigMapList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Keys      []string  `json:"keys"`
	Count     int       `json:"count"`
	Age       time.Time `json:"age"`
}

func TransformConfigMapList(configMaps []v1.ConfigMap) []ConfigMapList {
	list := make([]ConfigMapList, 0)

	for _, d := range configMaps {
		list = append(list, TransConfigMapsItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransConfigMapsItem(configMap v1.ConfigMap) ConfigMapList {
	return ConfigMapList{
		Namespace: configMap.GetNamespace(),
		Name:      configMap.GetName(),
		Keys:      getKeysNames(configMap.Data),
		Count:     len(configMap.Data),
		Age:       configMap.CreationTimestamp.Time,
	}
}

func getKeysNames(data map[string]string) []string {
	output := make([]string, 0)
	for k := range data {
		output = append(output, k)
	}
	// sorting will prevent list of keys switching array position
	sort.Strings(output)

	return output
}
