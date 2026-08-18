package base

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOwnerStreamsDiff(t *testing.T) {
	t.Run("reports nothing on the first pass", func(t *testing.T) {
		o := NewOwnerStreams()

		assert.Empty(t, o.Diff([]string{"a", "b"}))
	})

	t.Run("reports the streams that lost their last child", func(t *testing.T) {
		o := NewOwnerStreams()
		o.Diff([]string{"a", "b", "c"})

		assert.ElementsMatch(t, []string{"a", "c"}, o.Diff([]string{"b"}))
	})

	t.Run("reports an emptied stream only once", func(t *testing.T) {
		o := NewOwnerStreams()
		o.Diff([]string{"a"})

		assert.Equal(t, []string{"a"}, o.Diff(nil))
		assert.Empty(t, o.Diff(nil))
	})

	t.Run("a stream that comes back can empty again", func(t *testing.T) {
		o := NewOwnerStreams()
		o.Diff([]string{"a"})
		o.Diff(nil)
		o.Diff([]string{"a"})

		assert.Equal(t, []string{"a"}, o.Diff(nil))
	})

	t.Run("keeps streams that are still populated", func(t *testing.T) {
		o := NewOwnerStreams()
		o.Diff([]string{"a", "b"})

		assert.Empty(t, o.Diff([]string{"a", "b"}))
	})
}

func TestOwnerStreamsBegin(t *testing.T) {
	t.Run("serialises concurrent passes", func(t *testing.T) {
		o := NewOwnerStreams()

		inFlight := 0
		overlapped := false
		var guard sync.Mutex
		var wg sync.WaitGroup

		for range 8 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer o.Begin()()

				guard.Lock()
				inFlight++
				overlapped = overlapped || inFlight > 1
				guard.Unlock()

				o.Diff([]string{"a"})

				guard.Lock()
				inFlight--
				guard.Unlock()
			}()
		}
		wg.Wait()

		assert.False(t, overlapped)
	})
}
