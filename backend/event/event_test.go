package event

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewEventCounter(t *testing.T) {
	t.Run("create new event processor with ticker", func(t *testing.T) {
		interval := 100 * time.Millisecond
		ep := NewEventCounter(interval)

		assert.NotNil(t, ep)
		assert.NotNil(t, ep.ticker)
		assert.NotNil(t, ep.key)
		assert.Empty(t, ep.key)
	})
}

func TestEventProcessor_AddEvent(t *testing.T) {
	tests := []struct {
		name    string
		events  map[string]func()
		expKeys []string
	}{
		{
			name: "add multiple events",
			events: map[string]func(){
				"event1": func() {},
				"event2": func() {},
				"event3": func() {},
			},
			expKeys: []string{"event1", "event2", "event3"},
		},
		{
			name: "add single event",
			events: map[string]func(){
				"event4": func() {},
			},
			expKeys: []string{"event4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ep := NewEventCounter(100 * time.Millisecond)

			for k, v := range tt.events {
				ep.AddEvent(k, v)
			}

			assert.Len(t, ep.key, len(tt.expKeys))
			for _, k := range tt.expKeys {
				_, ok := ep.key[k]
				assert.True(t, ok, "expected key not found: %s", k)
			}
		})
	}
}

func TestEventProcessor_RunAndStop(t *testing.T) {
	t.Run("process events and stop ticker", func(t *testing.T) {
		ep := NewEventCounter(10 * time.Millisecond)
		var count int32

		ep.AddEvent("event1", func() { atomic.AddInt32(&count, 1) })
		ep.AddEvent("event2", func() { atomic.AddInt32(&count, 1) })

		go ep.Run()

		time.Sleep(30 * time.Millisecond) // Wait to allow the event to be processed at least once
		ep.Stop()

		assert.GreaterOrEqual(t, atomic.LoadInt32(&count), int32(2))
	})
}

func TestEventProcessor_ProcessEvents(t *testing.T) {
	t.Run("process multiple events", func(t *testing.T) {
		ep := NewEventCounter(10 * time.Millisecond)
		var count int32

		ep.AddEvent("event1", func() { atomic.AddInt32(&count, 1) })
		ep.AddEvent("event2", func() { atomic.AddInt32(&count, 1) })

		ep.processEvents()

		assert.Equal(t, int32(2), atomic.LoadInt32(&count))
		assert.Empty(t, ep.key) // Ensure all events are processed and removed
	})
}
