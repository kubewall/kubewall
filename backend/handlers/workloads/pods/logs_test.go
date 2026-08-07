package pods

import (
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func collect(t *testing.T, r io.Reader) ([]string, error) {
	t.Helper()
	var got []string
	err := readLogLines(r, func(line string) bool {
		got = append(got, line)
		return true
	})
	return got, err
}

// The regression that motivated replacing bufio.Scanner: it fails the whole
// stream with ErrTooLong the first time a line exceeds its buffer, so one
// oversized line silently discarded every log line after it.
func TestReadLogLinesDeliversLinesAfterAnOversizedLine(t *testing.T) {
	big := strings.Repeat("X", 2*maxLogLineSize)
	input := "first\n" + big + "\nafter-1\nafter-2\n"

	got, err := collect(t, strings.NewReader(input))
	require.NoError(t, err)

	require.GreaterOrEqual(t, len(got), 4, "oversized line must not terminate the stream")
	assert.Equal(t, "first", got[0])
	// The lines following the oversized one are what used to be lost entirely.
	assert.Equal(t, "after-1", got[len(got)-2])
	assert.Equal(t, "after-2", got[len(got)-1])
}

func TestReadLogLinesChunksOversizedLineWithoutLosingBytes(t *testing.T) {
	big := strings.Repeat("Y", 5*maxLogLineSize+1234)

	got, err := collect(t, strings.NewReader(big+"\n"))
	require.NoError(t, err)

	require.Greater(t, len(got), 1, "an oversized line should arrive as several chunks")
	// Nothing may be dropped: the chunks must reassemble into the original line.
	assert.Equal(t, big, strings.Join(got, ""))
}

func TestReadLogLinesDeliversFinalLineWithoutTrailingNewline(t *testing.T) {
	got, err := collect(t, strings.NewReader("alpha\nbeta"))
	require.NoError(t, err)
	assert.Equal(t, []string{"alpha", "beta"}, got)
}

func TestReadLogLinesTrimsCarriageReturns(t *testing.T) {
	got, err := collect(t, strings.NewReader("alpha\r\nbeta\r\n"))
	require.NoError(t, err)
	assert.Equal(t, []string{"alpha", "beta"}, got)
}

func TestReadLogLinesEmptyInput(t *testing.T) {
	got, err := collect(t, strings.NewReader(""))
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestReadLogLinesPreservesBlankLines(t *testing.T) {
	got, err := collect(t, strings.NewReader("a\n\nb\n"))
	require.NoError(t, err)
	assert.Equal(t, []string{"a", "", "b"}, got)
}

func TestReadLogLinesStopsWhenEmitDeclines(t *testing.T) {
	var got []string
	err := readLogLines(strings.NewReader("one\ntwo\nthree\n"), func(line string) bool {
		got = append(got, line)
		return len(got) < 2 // simulate ctx cancellation after two lines
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"one", "two"}, got)
}

// errAfterReader yields data, then fails. Lines read before the failure must
// still be delivered rather than discarded with the error.
type errAfterReader struct {
	data []byte
	err  error
	done bool
}

func (e *errAfterReader) Read(p []byte) (int, error) {
	if !e.done {
		e.done = true
		n := copy(p, e.data)
		return n, nil
	}
	return 0, e.err
}

func TestReadLogLinesDeliversLinesBeforeAReadError(t *testing.T) {
	boom := errors.New("connection reset")
	r := &errAfterReader{data: []byte("kept-1\nkept-2\n"), err: boom}

	got, err := collect(t, r)
	require.ErrorIs(t, err, boom)
	assert.Equal(t, []string{"kept-1", "kept-2"}, got)
}

func TestNewLogMessageParsesKubeletTimestamp(t *testing.T) {
	var last time.Time
	msg := newLogMessage("2026-08-07T10:00:00.123456789Z hello world", "api", &last)

	assert.Equal(t, "api", msg.ContainerName)
	assert.Equal(t, "hello world", msg.Log)
	assert.Equal(t, "2026-08-07 10:00:00.123Z", msg.Timestamp)
	assert.False(t, last.IsZero(), "the parsed timestamp should be remembered")
}

// These four shapes were all silently discarded before, each one a lost log line.
func TestNewLogMessageKeepsLinesItCannotParse(t *testing.T) {
	for _, raw := range []string{
		"nospaceline",
		"not-a-timestamp hello world",
		"2026-08-07T10:00:00.000000000Z",
		"",
	} {
		t.Run(raw, func(t *testing.T) {
			var last time.Time
			msg := newLogMessage(raw, "api", &last)
			assert.Equal(t, raw, msg.Log, "the raw line must be delivered, not dropped")
			assert.NotEmpty(t, msg.Timestamp, "a fallback timestamp is required")
		})
	}
}

func TestNewLogMessageCarriesLastTimestampForward(t *testing.T) {
	var last time.Time
	newLogMessage("2026-08-07T10:00:00.000000000Z first", "api", &last)

	// An unparseable line inherits the previous timestamp so ordering holds.
	msg := newLogMessage("continuation without timestamp", "api", &last)
	assert.Equal(t, "2026-08-07 10:00:00.000Z", msg.Timestamp)
	assert.Equal(t, "continuation without timestamp", msg.Log)
}

func TestIsBenignStreamClose(t *testing.T) {
	assert.True(t, isBenignStreamClose(t.Context(), errors.New("http2: response body closed")))
	assert.True(t, isBenignStreamClose(t.Context(), errors.New("use of closed network connection")))
	assert.True(t, isBenignStreamClose(t.Context(), io.ErrClosedPipe))
	assert.False(t, isBenignStreamClose(t.Context(), errors.New("unexpected EOF from kubelet")))
}

func TestNoticeMessageIsAVisibleLogLine(t *testing.T) {
	msg := noticeMessage("api", "log stream ended")
	assert.Equal(t, "api", msg.ContainerName)
	assert.Equal(t, "log stream ended", msg.Log)
	_, err := time.Parse(timestampLayout, msg.Timestamp)
	assert.NoError(t, err, "notices must carry a timestamp the UI can sort on")
}
