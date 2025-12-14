package event

import (
	"sync"
	"time"
)

type EventProcessor struct {
	key       map[string]func()
	ticker    *time.Ticker
	mu        sync.Mutex
	maxEvents int
	done      chan struct{}
}

// NewEventCounter creates a new EventProcessor with the specified ticker interval.
func NewEventCounter(interval time.Duration) *EventProcessor {
	ec := &EventProcessor{
		ticker:    time.NewTicker(interval),
		key:       make(map[string]func()),
		maxEvents: 1000, // Limit to prevent unbounded growth
		done:      make(chan struct{}),
	}
	return ec
}

// AddEvent adds a count to the event counter.
func (ec *EventProcessor) AddEvent(key string, f func()) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	// Prevent unbounded growth
	if len(ec.key) >= ec.maxEvents {
		// Remove oldest entry (simple FIFO approach)
		for k := range ec.key {
			delete(ec.key, k)
			break
		}
	}

	ec.key[key] = f
}

func (ec *EventProcessor) Run() {
	defer ec.ticker.Stop()
	for {
		select {
		case <-ec.ticker.C:
			ec.processEvents()
		case <-ec.done:
			return
		}
	}
}

func (ec *EventProcessor) processEvents() {
	ec.mu.Lock()
	defer ec.mu.Unlock()
	if len(ec.key) > 0 {
		for k, v := range ec.key {
			v()
			delete(ec.key, k)
		}
	}
}

func (ec *EventProcessor) Stop() {
	close(ec.done)
}
