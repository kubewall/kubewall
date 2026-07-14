package tools

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/handlers/mcp/helpers"
	"github.com/labstack/echo/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const postLogsTemplate = `Retrieve all the logs of a specific pod and all it's containers.
If namespace is missing, use podsList tool to determine it or leverage other tools based on input.
Use Cases:
Fetch latest logs of pods and it's container.
Helps in further investigation about failure.
`

// LogEntry represents the structure of each SSE event data.
type LogEntry struct {
	ContainerName string `json:"containerName"`
	Timestamp     string `json:"timestamp"`
	Log           string `json:"log"`
}

func NewLogsTool(c echo.Context) server.ServerTool {
	tool := mcp.NewTool("podsLogs",
		mcp.WithDescription(postLogsTemplate),
		mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: mcp.ToBoolPtr(true)}),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Name of the pod"),
		),
		mcp.WithString("namespace",
			mcp.Required(),
			mcp.Description("Namespace in which the pods is present. Call podsList to figure it out if missing."),
		),
	)

	handler := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		name, err := request.RequireString("name")
		if err != nil {
			log.Error(err.Error())
			return mcp.NewToolResultError(err.Error()), err
		}
		namespace, err := request.RequireString("namespace")
		if err != nil {
			log.Error(err.Error())
			return mcp.NewToolResultError(err.Error()), err
		}

		url := helpers.BuildURL(c, "podsLogs", name, namespace)
		logsEntry, err := ReadLogsStream(fmt.Sprintf("%s&all-containers=true", url))
		if err != nil {
			log.Error(err.Error())
			return mcp.NewToolResultError(err.Error()), err
		}

		b, err := json.Marshal(logsEntry)
		if err != nil {
			log.Error(err.Error())
			return mcp.NewToolResultError(err.Error()), err
		}
		return mcp.NewToolResultText(string(b)), nil
	}

	return NewServerTool(tool, handler)
}

// ReadLogsStream connects to the SSE URL, reads events for 200ms after receiving the response,
// collects parsed log entries, then disconnects and returns the collected entries.
func ReadLogsStream(sseURL string) ([]LogEntry, error) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", sseURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "text/event-stream")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Start the 200ms timer after receiving the response.
	time.AfterFunc(250*time.Millisecond, cancel)

	var collected []LogEntry

	reader := bufio.NewReader(resp.Body)
	var currentData strings.Builder

	for {
		line, err := reader.ReadString('\n')
		line = strings.TrimRight(line, "\r\n")

		if line == "" {
			// End of event.
			if currentData.Len() > 0 {
				var entry LogEntry
				if jsonErr := json.Unmarshal([]byte(currentData.String()), &entry); jsonErr != nil {
					return collected, jsonErr
				}
				collected = append(collected, entry)
				currentData.Reset()
			}
		} else if after, ok := strings.CutPrefix(line, "data:"); ok {
			if currentData.Len() > 0 {
				currentData.WriteString("\n")
			}
			currentData.WriteString(after)
		}
		// Ignore other line types (e.g., id:, event:, :keepalive).

		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, context.Canceled) {
				break
			}
			return collected, err
		}
	}

	// Process any remaining data after the loop.
	if currentData.Len() > 0 {
		var entry LogEntry
		if err := json.Unmarshal([]byte(currentData.String()), &entry); err != nil {
			return collected, err
		}
		collected = append(collected, entry)
	}

	return collected, nil
}
