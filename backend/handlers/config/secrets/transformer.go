package secrets

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"
)

type SecretsList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Keys      []string  `json:"keys"`
	Data      int       `json:"data"`
	Age       time.Time `json:"age"`
}

func TransformSecretsList(secrets []v1.Secret) []SecretsList {
	list := make([]SecretsList, 0)

	for _, d := range secrets {
		list = append(list, TransConfigMapsItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransConfigMapsItem(configMap v1.Secret) SecretsList {
	return SecretsList{
		Namespace: configMap.GetNamespace(),
		Name:      configMap.GetName(),
		Keys:      getKeys(configMap.Data),
		Type:      string(configMap.Type),
		Data:      len(getKeys(configMap.Data)),
		Age:       configMap.CreationTimestamp.Time,
	}
}

func getKeys(data map[string][]byte) []string {
	output := make([]string, 0)
	for k := range data {
		output = append(output, k)
	}
	// sorting will prevent list of keys switching array position
	sort.Strings(output)

	return output
}
