package crds

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/handlers/crds/resources"
	"github.com/maruel/natural"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"sort"
	"time"
)

type CustomResourceDefinition struct {
	Name                     string                                           `json:"name"`
	Versions                 int                                              `json:"versions"`
	ActiveVersion            string                                           `json:"activeVersion"`
	QueryParam               string                                           `json:"queryParam"`
	AdditionalPrinterColumns []apiextensionsv1.CustomResourceColumnDefinition `json:"additionalPrinterColumns"`
	Scope                    apiextensionsv1.ResourceScope                    `json:"scope"`
	Spec                     Spec                                             `json:"spec"`
	Age                      time.Time                                        `json:"age"`
}

type Spec struct {
	Group string `json:"group"`
	Scope string `json:"scope"`
	Names Names  `json:"names"`
}

type Names struct {
	Kind       string   `json:"kind"`
	ListKind   string   `json:"listKind"`
	Plural     string   `json:"plural"`
	ShortNames []string `json:"shortNames"`
	Singular   string   `json:"singular"`
}

func TransformCRD(definitions []apiextensionsv1.CustomResourceDefinition) []CustomResourceDefinition {
	list := []CustomResourceDefinition{}

	for _, p := range definitions {
		list = append(list, TransformCRDItem(p))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformCRDItem(item apiextensionsv1.CustomResourceDefinition) CustomResourceDefinition {
	activeVersion := selectedVersion(item)
	return CustomResourceDefinition{
		Name:                     item.Name,
		Scope:                    item.Spec.Scope,
		Versions:                 len(item.Spec.Versions),
		ActiveVersion:            activeVersion,
		QueryParam:               fmt.Sprintf("group=%s&version=%s&resource=%s&kind=%s", item.Spec.Group, activeVersion, item.Spec.Names.Plural, item.Spec.Names.Kind),
		AdditionalPrinterColumns: customResourceColumnDefinition(item, activeVersion),
		Spec: Spec{
			Group: item.Spec.Group,
			Names: Names{
				Kind:       item.Spec.Names.Kind,
				ListKind:   item.Spec.Names.ListKind,
				Plural:     item.Spec.Names.Plural,
				ShortNames: item.Spec.Names.ShortNames,
				Singular:   item.Spec.Names.Singular,
			},
		},

		Age: item.CreationTimestamp.Time,
	}
}

func customResourceColumnDefinition(item apiextensionsv1.CustomResourceDefinition, activeVersion string) []apiextensionsv1.CustomResourceColumnDefinition {
	printerColumns := make([]apiextensionsv1.CustomResourceColumnDefinition, 0)
	for _, v := range item.Spec.Versions {
		if v.Name == activeVersion {
			printerColumns = resources.FilterAdditionalPrinterColumns(v.AdditionalPrinterColumns)
		}
	}
	return printerColumns
}

func selectedVersion(item apiextensionsv1.CustomResourceDefinition) string {
	for _, v := range item.Spec.Versions {
		if v.Deprecated == false && v.Served == true {
			return v.Name
		}
	}

	return ""
}
