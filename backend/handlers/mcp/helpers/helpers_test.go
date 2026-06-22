package helpers

import (
	"bufio"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// sseServer spins up a test server that writes a single SSE stream and closes.
func sseServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, body)
	}))
}

func TestReadFirstSSEMessage(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		wantData string
		wantErr  string
	}{
		{
			name:     "small payload",
			body:     "data: hello\n\n",
			wantData: "hello",
		},
		{
			name:     "128 KiB payload — above old 64 KiB scanner limit",
			body:     "data: " + strings.Repeat("x", 128*1024) + "\n\n",
			wantData: strings.Repeat("x", 128*1024),
		},
		{
			name:     "1 MiB payload",
			body:     "data: " + strings.Repeat("y", 1024*1024) + "\n\n",
			wantData: strings.Repeat("y", 1024*1024),
		},
		{
			name:     "10 MiB payload — no ceiling with bufio.Reader",
			body:     "data: " + strings.Repeat("z", 10*1024*1024) + "\n\n",
			wantData: strings.Repeat("z", 10*1024*1024),
		},
		{
			name:     "only first event is returned",
			body:     "data: first\n\ndata: second\n\n",
			wantData: "first",
		},
		{
			name: "multi-line event (multiple data: fields joined)",
			body: "data: line1\ndata: line2\n\n",
			// CutPrefix strips "data:" but keeps the space after the colon;
			// TrimSpace only trims the outer edges, so interior lines retain " line2".
			wantData: "line1\n line2",
		},
		{
			name:    "no SSE message — keepalive only",
			body:    ": keepalive\n\n",
			wantErr: "no SSE message received",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := sseServer(t, tt.body)
			defer srv.Close()

			got, err := ReadFirstSSEMessage(srv.URL)

			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantData, got)
		})
	}
}

func TestReadFirstSSEMessage_BadStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	_, err := ReadFirstSSEMessage(srv.URL)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "bad status code: 500")
}

// TestReadFirstSSEMessage_OldLimitWouldFail proves that the test payload
// genuinely trips the pre-fix bufio.Scanner default limit, confirming the
// test is exercising the right code path.
func TestReadFirstSSEMessage_OldLimitWouldFail(t *testing.T) {
	bigLine := "data: " + strings.Repeat("x", 128*1024)

	scanner := bufio.NewScanner(strings.NewReader(bigLine + "\n\n"))
	// no Buffer() override — same as old code
	for scanner.Scan() {
	}
	require.Error(t, scanner.Err(), "expected old default scanner to fail on 128 KiB line")
	assert.ErrorIs(t, scanner.Err(), bufio.ErrTooLong)
}
