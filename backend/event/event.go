package event

import (
	"sync"
	"time"
)

type EventProcessor struct {
	key    map[string]func()
	ticker *time.Ticker
	mu     sync.Mutex
}

// NewEventCounter creates a new EventProcessor with the specified ticker interval.
func NewEventCounter(interval time.Duration) *EventProcessor {
	ec := &EventProcessor{
		ticker: time.NewTicker(interval),
		key:    make(map[string]func()),
	}
	return ec
}

// AddEvent adds a count to the event counter.
func (ec *EventProcessor) AddEvent(key string, f func()) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	ec.key[key] = f
}

func (ec *EventProcessor) Run() {
	for {
		select {
		case <-ec.ticker.C:
			ec.processEvents()
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
	ec.ticker.Stop()
}
