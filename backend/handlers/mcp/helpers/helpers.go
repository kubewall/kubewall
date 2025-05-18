package helpers

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
)

func BuildURL(c echo.Context, reverse string, name, namespace string, params ...any) string {
	url := c.Scheme() + "://" + c.Request().Host + c.Echo().Reverse(reverse, name)
	if namespace == "" {
		url = fmt.Sprintf("%s?config=%s&cluster=%s", url, c.QueryParam("config"), c.QueryParam("cluster"))
	} else {
		url = fmt.Sprintf("%s?config=%s&cluster=%s&namespace=%s", url, c.QueryParam("config"), c.QueryParam("cluster"), namespace)
	}
	log.Info("url", "url", url)
	return url
}

func ReadFirstSSEMessage(url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("error connecting to SSE stream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("bad status code: %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	var data strings.Builder

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "data:") {
			data.WriteString(strings.TrimPrefix(line, "data:"))
			data.WriteString("\n")
		}

		// End of an event
		if line == "" && data.Len() > 0 {
			return strings.TrimSpace(data.String()), nil
		}
	}

	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("error reading SSE stream: %w", err)
	}

	return "", fmt.Errorf("no SSE message received")
}
