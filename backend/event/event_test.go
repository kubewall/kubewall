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
		assert.NotNil(t, ep.events)
		assert.NotNil(t, ep.order)
		assert.NotNil(t, ep.done)
		assert.Empty(t, ep.events)
		assert.Equal(t, 1000, ep.maxEvents)
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

			assert.Len(t, ep.events, len(tt.expKeys))
			for _, k := range tt.expKeys {
				_, ok := ep.events[k]
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

		time.Sleep(30 * time.Millisecond)
		ep.Stop()

		// Give some time for the goroutine to stop
		time.Sleep(10 * time.Millisecond)

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
		assert.Empty(t, ep.events)
	})
}

func TestEventProcessor_MaxEvents(t *testing.T) {
	t.Run("respect max events limit", func(t *testing.T) {
		ep := NewEventCounter(10 * time.Millisecond)
		ep.maxEvents = 2

		ep.AddEvent("event1", func() {})
		ep.AddEvent("event2", func() {})
		ep.AddEvent("event3", func() {})

		assert.Len(t, ep.events, 2)
		_, exists := ep.events["event1"]
		assert.False(t, exists, "event1 should have been removed (oldest)")
		_, exists = ep.events["event2"]
		assert.True(t, exists, "event2 should still exist")
		_, exists = ep.events["event3"]
		assert.True(t, exists, "event3 should exist")
	})
}
