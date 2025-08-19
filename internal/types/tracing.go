package types

import (
	"time"
)

// Trace represents a complete distributed trace
type Trace struct {
	TraceID       string            `json:"traceId"`
	OperationName string            `json:"operationName"`
	StartTime     time.Time         `json:"startTime"`
	Duration      time.Duration     `json:"duration"`
	Status        string            `json:"status"`
	Services      []string          `json:"services"`
	SpanCount     int               `json:"spanCount"`
	Spans         []Span            `json:"spans"`
	Tags          map[string]string `json:"tags"`
}

// Span represents an individual operation within a trace
type Span struct {
	SpanID        string            `json:"spanId"`
	TraceID       string            `json:"traceId"`
	ParentSpanID  string            `json:"parentSpanId,omitempty"`
	OperationName string            `json:"operationName"`
	ServiceName   string            `json:"serviceName"`
	StartTime     time.Time         `json:"startTime"`
	Duration      time.Duration     `json:"duration"`
	Status        string            `json:"status"`
	Tags          map[string]string `json:"tags"`
	Logs          []SpanLog         `json:"logs"`
}

// SpanLog represents a log entry within a span
type SpanLog struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields"`
}

// TraceFilter represents filters for trace queries
type TraceFilter struct {
	Service     string
	Operation   string
	StartTime   *time.Time
	EndTime     *time.Time
	MinDuration *time.Duration
	MaxDuration *time.Duration
	Status      string
	Limit       int
	Offset      int
}