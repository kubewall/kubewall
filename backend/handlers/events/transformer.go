package events

import (
	"encoding/json"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"
)

type Event struct {
	Count          int       `json:"count"`
	FirstTimestamp time.Time `json:"firstTimestamp"`
	HasUpdated     bool      `json:"hasUpdated"`
	InvolvedObject struct {
		ApiVersion      string `json:"apiVersion"`
		FieldPath       string `json:"fieldPath"`
		Kind            string `json:"kind"`
		Name            string `json:"name"`
		Namespace       string `json:"namespace"`
		ResourceVersion string `json:"resourceVersion"`
		Uid             string `json:"uid"`
	} `json:"involvedObject"`
	Kind          string    `json:"kind"`
	LastTimestamp time.Time `json:"lastTimestamp"`
	Message       string    `json:"message"`
	Metadata      struct {
		CreationTimestamp time.Time `json:"creationTimestamp"`
		Name              string    `json:"name"`
		Namespace         string    `json:"namespace"`
		ResourceVersion   string    `json:"resourceVersion"`
		Uid               string    `json:"uid"`
	} `json:"metadata"`
	Reason             string `json:"reason"`
	ReportingComponent string `json:"reportingComponent"`
	ReportingInstance  string `json:"reportingInstance"`
	Source             struct {
		Component string `json:"component"`
		Host      string `json:"host"`
	} `json:"source"`
	Type string `json:"type"`
}

func TransformEvents(namespaces []v1.Event) []Event {
	list := []Event{}

	for _, p := range namespaces {
		list = append(list, TransformEvent(p))
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].Metadata.Name < list[j].Metadata.Name
	})

	return list
}

func TransformEvent(item v1.Event) Event {
	var transformed Event
	b, err := json.Marshal(item)
	if err != nil {
		return Event{}
	}
	err = json.Unmarshal(b, &transformed)
	if err != nil {
		return Event{}
	}

	return transformed
}
