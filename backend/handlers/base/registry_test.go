package base

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetOrCreateHandler(t *testing.T) {
	t.Run("creates once and reuses the cached instance", func(t *testing.T) {
		defer Reset()

		created := 0
		build := func() *int {
			created++
			v := created
			return &v
		}

		first := GetOrCreateHandler("key", build)
		second := GetOrCreateHandler("key", build)

		assert.Same(t, first, second)
		assert.Equal(t, 1, created)
	})
}

func TestClusterInit(t *testing.T) {
	t.Run("runs once per key", func(t *testing.T) {
		defer Reset()

		runs := 0
		ClusterInit("config-cluster", func() { runs++ })
		ClusterInit("config-cluster", func() { runs++ })

		assert.Equal(t, 1, runs)
	})

	t.Run("keys are independent", func(t *testing.T) {
		defer Reset()

		runs := 0
		ClusterInit("config-a", func() { runs++ })
		ClusterInit("config-b", func() { runs++ })

		assert.Equal(t, 2, runs)
	})
}

func TestReset(t *testing.T) {
	t.Run("rebuilds handlers and re-runs cluster init after a reset", func(t *testing.T) {
		defer Reset()

		created := 0
		build := func() *int {
			created++
			v := created
			return &v
		}
		runs := 0
		init := func() { runs++ }

		before := GetOrCreateHandler("key", build)
		ClusterInit("config-cluster", init)

		Reset()

		after := GetOrCreateHandler("key", build)
		ClusterInit("config-cluster", init)

		assert.NotSame(t, before, after, "a reset must not hand back the handler built on the discarded clients")
		assert.Equal(t, 2, created)
		assert.Equal(t, 2, runs, "a reset must let the next request start informers again")
	})

	t.Run("clears the informer event-handler guard", func(t *testing.T) {
		defer Reset()

		key := informerGuardKey("config-cluster-podInformer", "Pod")
		registrations := 0
		register := func() {
			once, _ := informerInitOnce.LoadOrStore(key, &sync.Once{})
			once.(*sync.Once).Do(func() { registrations++ })
		}

		register()
		register()
		assert.Equal(t, 1, registrations)

		Reset()

		register()
		assert.Equal(t, 2, registrations, "rebuilt informers must be able to register their event handlers")
	})

	t.Run("is safe on empty registries", func(t *testing.T) {
		assert.NotPanics(t, Reset)
	})
}
