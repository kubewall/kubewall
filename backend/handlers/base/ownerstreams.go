package base

import "sync"

// OwnerStreams remembers which per-owner streams a publisher last wrote to.
type OwnerStreams struct {
	pass sync.Mutex
	mu   sync.Mutex
	seen map[string]struct{}
}

func NewOwnerStreams() *OwnerStreams {
	return &OwnerStreams{seen: make(map[string]struct{})}
}

func (o *OwnerStreams) Begin() func() {
	o.pass.Lock()
	return o.pass.Unlock
}

// Diff adopts current as the new baseline and returns the streams that were
// published to on the previous pass but hold no children in this one.
func (o *OwnerStreams) Diff(current []string) []string {
	o.mu.Lock()
	defer o.mu.Unlock()

	next := make(map[string]struct{}, len(current))
	for _, id := range current {
		next[id] = struct{}{}
	}

	emptied := make([]string, 0)
	for id := range o.seen {
		if _, populated := next[id]; !populated {
			emptied = append(emptied, id)
		}
	}
	o.seen = next

	return emptied
}
