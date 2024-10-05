package events

import (
	"encoding/json"
	"github.com/charmbracelet/log"
	v1 "k8s.io/api/core/v1"
	"sort"
	"time"
)

type Event struct {
	Count          int    `json:"count"`
	FirstTimestamp string `json:"firstTimestamp"`
	HasUpdated     bool   `json:"hasUpdated"`
	InvolvedObject struct {
		ApiVersion      string `json:"apiVersion"`
		FieldPath       string `json:"fieldPath"`
		Kind            string `json:"kind"`
		Name            string `json:"name"`
		Namespace       string `json:"namespace"`
		ResourceVersion string `json:"resourceVersion"`
		Uid             string `json:"uid"`
	} `json:"involvedObject"`
	Kind          string `json:"kind"`
	LastTimestamp string `json:"lastTimestamp"`
	Message       string `json:"message"`
	Metadata      struct {
		CreationTimestamp string `json:"creationTimestamp"`
		Name              string `json:"name"`
		Namespace         string `json:"namespace"`
		ResourceVersion   string `json:"resourceVersion"`
		Uid               string `json:"uid"`
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

func TransformEvents(events []v1.Event) []Event {
	list := []Event{}

	for _, p := range events {
		list = append(list, TransformEvent(p))
	}

	sort.Slice(list, func(i, j int) bool {
		layout := "2006-01-02T15:04:05Z"
		first, err := time.Parse(layout, list[i].Metadata.CreationTimestamp)
		if err != nil {
			log.Warn("failed to parse time", "err", err)
		}
		second, err := time.Parse(layout, list[j].Metadata.CreationTimestamp)
		if err != nil {
			log.Warn("failed to parse time", "err", err)
		}
		return first.After(second)
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
	if item.FirstTimestamp.IsZero() {
		transformed.FirstTimestamp = ""
	} else {
		transformed.FirstTimestamp = item.FirstTimestamp.Format("2006-01-02T15:04:05-07:00")
	}
	if item.LastTimestamp.IsZero() {
		transformed.LastTimestamp = ""
	} else {
		transformed.LastTimestamp = item.LastTimestamp.Format("2006-01-02T15:04:05-07:00")
	}
	if err != nil {
		return Event{}
	}

	return transformed
}
