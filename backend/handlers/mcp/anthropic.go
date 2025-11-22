package mcp

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"time"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

func AnthropicProxyHandler(appContainer container.Container, c echo.Context) error {
	remoteURLPart := c.Param("*")

	llmAPIEndpoint := appContainer.Config().LLMAPIEndpoint
	llmAPIKey := appContainer.Config().LLMAPIKey

	if llmAPIEndpoint == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "LLM API endpoint not configured",
		})
	}

	llmAPIEndpoint = llmAPIEndpoint + "/" + remoteURLPart

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
		Timeout: time.Second * 120, // LLM requests can take longer
	}

	var reqBody io.Reader
	if c.Request().Body != nil {
		bodyBytes, err := io.ReadAll(c.Request().Body)
		if err != nil {
			log.Error("Error reading request body", "err", err)
			return c.String(http.StatusInternalServerError, "Failed to read request body.")
		}
		reqBody = bytes.NewBuffer(bodyBytes)
		c.Request().Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	proxyReq, err := http.NewRequest(c.Request().Method, llmAPIEndpoint, reqBody)
	if err != nil {
		log.Error("Error creating proxy request", "err", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create proxy request",
		})
	}

	for name, values := range c.Request().Header {
		if strings.EqualFold(name, "Connection") ||
			strings.EqualFold(name, "Proxy-Connection") ||
			strings.EqualFold(name, "Keep-Alive") ||
			strings.EqualFold(name, "Transfer-Encoding") ||
			strings.EqualFold(name, "Upgrade") {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(name, value)
		}
	}
	// Set required headers
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("Accept", "application/json")
	proxyReq.Header.Set("Anthropic-Version", "2023-06-01")

	// Set API key if available
	if llmAPIKey != "" {
		proxyReq.Header.Set("X-Api-Key", llmAPIKey)
		proxyReq.Header.Set("Authorization", "Bearer "+llmAPIKey)
	}

	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Error("Error sending request to LLM provider", "err", err)
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("Failed to communicate with LLM provider: %s", err.Error()),
		})
	}
	defer resp.Body.Close()

	for name, values := range resp.Header {
		if isHopByHopHeader(name) {
			continue
		}
		for _, value := range values {
			c.Response().Header().Add(name, value)
		}
	}

	c.Response().WriteHeader(resp.StatusCode)

	_, err = io.Copy(c.Response().Writer, resp.Body)
	if err != nil {
		log.Error("Error copying response body", "err", err)
		return c.String(http.StatusInternalServerError, err.Error())
	}

	return nil
}

func isHopByHopHeader(header string) bool {
	switch http.CanonicalHeaderKey(header) {
	case "Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Te", // except when used with "trailers"
		"Trailers",
		"Transfer-Encoding",
		"Upgrade":
		return true
	default:
		return false
	}
}
