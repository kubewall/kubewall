package event

import (
	"container/list"
	"sync"
	"time"
)

type eventEntry struct {
	key string
	fn  func()
}

type EventProcessor struct {
	events    map[string]*list.Element
	order     *list.List
	ticker    *time.Ticker
	mu        sync.Mutex
	maxEvents int
	done      chan struct{}
}

// NewEventCounter creates a new EventProcessor with the specified ticker interval.
func NewEventCounter(interval time.Duration) *EventProcessor {
	ec := &EventProcessor{
		ticker:    time.NewTicker(interval),
		events:    make(map[string]*list.Element),
		order:     list.New(),
		maxEvents: 1000, // Limit to prevent unbounded growth
		done:      make(chan struct{}),
	}
	return ec
}

// AddEvent adds a count to the event counter.
func (ec *EventProcessor) AddEvent(key string, f func()) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	if elem, exists := ec.events[key]; exists {
		ec.order.Remove(elem)
		delete(ec.events, key)
	}
	if len(ec.events) >= ec.maxEvents {
		oldest := ec.order.Front()
		if oldest != nil {
			entry := oldest.Value.(*eventEntry)
			delete(ec.events, entry.key)
			ec.order.Remove(oldest)
		}
	}
	entry := &eventEntry{key: key, fn: f}
	elem := ec.order.PushBack(entry)
	ec.events[key] = elem
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
	if len(ec.events) == 0 {
		ec.mu.Unlock()
		return
	}
	toProcess := make([]eventEntry, 0, len(ec.events))
	for elem := ec.order.Front(); elem != nil; elem = elem.Next() {
		entry := elem.Value.(*eventEntry)
		toProcess = append(toProcess, *entry)
	}
	ec.events = make(map[string]*list.Element)
	ec.order.Init()
	ec.mu.Unlock()
	for i := range toProcess {
		toProcess[i].fn()
	}
}

func (ec *EventProcessor) Stop() {
	close(ec.done)
}
