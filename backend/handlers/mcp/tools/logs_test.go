package tools

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeSSEEvent(entry LogEntry) string {
	b, _ := json.Marshal(entry)
	return fmt.Sprintf("data: %s\n\n", string(b))
}

func TestReadLogsStream(t *testing.T) {
	entry1 := LogEntry{ContainerName: "main", Timestamp: "2024-01-01 00:00:00.000Z", Log: "hello"}
	entry2 := LogEntry{ContainerName: "sidecar", Timestamp: "2024-01-01 00:00:01.000Z", Log: "world"}

	t.Run("normal multiple log entries", func(t *testing.T) {
		body := makeSSEEvent(entry1) + makeSSEEvent(entry2)
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, body)
		}))
		defer srv.Close()

		got, err := ReadLogsStream(srv.URL)
		require.NoError(t, err)
		require.Len(t, got, 2)
		assert.Equal(t, entry1, got[0])
		assert.Equal(t, entry2, got[1])
	})

	t.Run("128 KiB log line — above old 64 KiB scanner limit", func(t *testing.T) {
		bigLog := strings.Repeat("z", 128*1024)
		big := LogEntry{ContainerName: "app", Timestamp: "2024-01-01 00:00:00.000Z", Log: bigLog}
		body := makeSSEEvent(big)

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, body)
		}))
		defer srv.Close()

		got, err := ReadLogsStream(srv.URL)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, bigLog, got[0].Log)
	})

	t.Run("1 MiB log line", func(t *testing.T) {
		bigLog := strings.Repeat("m", 1024*1024)
		big := LogEntry{ContainerName: "app", Timestamp: "2024-01-01 00:00:00.000Z", Log: bigLog}
		body := makeSSEEvent(big)

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, body)
		}))
		defer srv.Close()

		got, err := ReadLogsStream(srv.URL)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, bigLog, got[0].Log)
	})

	t.Run("10 MiB log line — no ceiling with bufio.Reader", func(t *testing.T) {
		bigLog := strings.Repeat("n", 10*1024*1024)
		big := LogEntry{ContainerName: "app", Timestamp: "2024-01-01 00:00:00.000Z", Log: bigLog}
		body := makeSSEEvent(big)

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, body)
		}))
		defer srv.Close()

		got, err := ReadLogsStream(srv.URL)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, bigLog, got[0].Log)
	})

	t.Run("empty stream returns no entries", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
		}))
		defer srv.Close()

		got, err := ReadLogsStream(srv.URL)
		require.NoError(t, err)
		assert.Empty(t, got)
	})
}

// TestReadLogsStream_OldLimitWouldFail confirms the 128 KiB JSON payload
// genuinely trips the pre-fix bufio.Scanner default, proving the test cases
// above exercise the right code path.
func TestReadLogsStream_OldLimitWouldFail(t *testing.T) {
	bigLog := strings.Repeat("z", 128*1024)
	entry := LogEntry{ContainerName: "app", Timestamp: "2024-01-01 00:00:00.000Z", Log: bigLog}
	b, _ := json.Marshal(entry)
	line := "data: " + string(b)

	scanner := bufio.NewScanner(strings.NewReader(line + "\n\n"))
	// no Buffer() override — same as old code
	for scanner.Scan() {
	}
	require.Error(t, scanner.Err(), "expected old default scanner to fail on 128 KiB line")
	assert.ErrorIs(t, scanner.Err(), bufio.ErrTooLong)
}
