package transformers

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// CustomResourceDefinition represents a transformed CRD for the frontend
type CustomResourceDefinition struct {
	ActiveVersion            string                    `json:"activeVersion"`
	AdditionalPrinterColumns []AdditionalPrinterColumn `json:"additionalPrinterColumns"`
	Age                      string                    `json:"age"`
	HasUpdated               bool                      `json:"hasUpdated"`
	Name                     string                    `json:"name"`
	QueryParam               string                    `json:"queryParam"`
	Scope                    string                    `json:"scope"`
	Spec                     CRDSpec                   `json:"spec"`
	Versions                 int                       `json:"versions"`
	UID                      string                    `json:"uid"`
}

// CRDSpec represents the spec section of a CRD
type CRDSpec struct {
	Group string   `json:"group"`
	Icon  string   `json:"icon"`
	Names CRDNames `json:"names"`
	Scope string   `json:"scope"`
}

// CRDNames represents the names section of a CRD
type CRDNames struct {
	Kind       string  `json:"kind"`
	ListKind   string  `json:"listKind"`
	Plural     string  `json:"plural"`
	ShortNames *string `json:"shortNames"`
	Singular   string  `json:"singular"`
}

// AdditionalPrinterColumn represents additional printer columns for a CRD
type AdditionalPrinterColumn struct {
	Name     string `json:"name"`
	JSONPath string `json:"jsonPath"`
}

// TransformCustomResourceDefinitions transforms raw CRD data to the expected frontend format
func TransformCustomResourceDefinitions(crds []unstructured.Unstructured) []CustomResourceDefinition {
	var transformed []CustomResourceDefinition

	for _, crd := range crds {
		transformed = append(transformed, transformCRD(crd))
	}

	return transformed
}

// transformCRD transforms a single CRD from Kubernetes format to frontend format
func transformCRD(crd unstructured.Unstructured) CustomResourceDefinition {
	// Extract metadata
	metadata := crd.Object["metadata"].(map[string]interface{})
	name := metadata["name"].(string)
	uid := metadata["uid"].(string)
	creationTimestamp := metadata["creationTimestamp"].(string)

	// Send creation timestamp instead of calculated age (frontend will handle age calculation)
	age := creationTimestamp

	// Extract spec
	spec := crd.Object["spec"].(map[string]interface{})
	group := spec["group"].(string)
	scope := spec["scope"].(string)

	// Extract names
	names := spec["names"].(map[string]interface{})
	kind := names["kind"].(string)
	plural := names["plural"].(string)
	singular := names["singular"].(string)
	listKind := names["listKind"].(string)

	// Handle shortNames (can be null)
	var shortNames *string
	if shortNamesVal, exists := names["shortNames"]; exists && shortNamesVal != nil {
		if shortNamesSlice, ok := shortNamesVal.([]interface{}); ok && len(shortNamesSlice) > 0 {
			shortNamesStr := shortNamesSlice[0].(string)
			shortNames = &shortNamesStr
		}
	}

	// Extract versions
	versions := spec["versions"].([]interface{})
	activeVersion := ""
	if len(versions) > 0 {
		// Find the served version
		for _, version := range versions {
			versionMap := version.(map[string]interface{})
			if served, exists := versionMap["served"]; exists && served.(bool) {
				activeVersion = versionMap["name"].(string)
				break
			}
		}
		// If no served version found, use the first one
		if activeVersion == "" {
			activeVersion = versions[0].(map[string]interface{})["name"].(string)
		}
	}

	// Extract additional printer columns (ensure non-nil slice so JSON encodes as [])
	additionalPrinterColumns := make([]AdditionalPrinterColumn, 0)
	if additionalPrinterColumnsVal, exists := spec["additionalPrinterColumns"]; exists {
		if columns, ok := additionalPrinterColumnsVal.([]interface{}); ok {
			for _, col := range columns {
				colMap := col.(map[string]interface{})
				additionalPrinterColumns = append(additionalPrinterColumns, AdditionalPrinterColumn{
					Name:     colMap["name"].(string),
					JSONPath: colMap["jsonPath"].(string),
				})
			}
		}
	}

	// Generate query param
	queryParam := "group=" + group + "&kind=" + kind + "&resource=" + plural + "&version=" + activeVersion

	// Backend default icon key; UI will try to map CRD group to a known SVG
	icon := group

	return CustomResourceDefinition{
		ActiveVersion:            activeVersion,
		AdditionalPrinterColumns: additionalPrinterColumns,
		Age:                      age,
		HasUpdated:               false, // This would need to be calculated based on resourceVersion changes
		Name:                     name,
		QueryParam:               queryParam,
		Scope:                    scope,
		Spec: CRDSpec{
			Group: group,
			Icon:  icon,
			Names: CRDNames{
				Kind:       kind,
				ListKind:   listKind,
				Plural:     plural,
				ShortNames: shortNames,
				Singular:   singular,
			},
			Scope: scope,
		},
		Versions: len(versions),
		UID:      uid,
	}
}
