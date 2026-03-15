package mcp

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"

	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
)

func ProxyHandler(c echo.Context) error {
	remoteURLPart := c.Param("*")

	if remoteURLPart == "" {
		return c.String(http.StatusBadRequest, "Missing remote URL in path. Example: /proxy/https://api.example.com/data")
	}

	decodedURL, err := url.QueryUnescape(remoteURLPart)
	if err != nil {
		decodedURL = remoteURLPart
	}

	remoteURL, err := url.Parse(decodedURL)
	if err != nil {
		log.Error("Error parsing remote URL", "err", err)
		return c.String(http.StatusBadRequest, "Invalid remote URL provided.")
	}

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
		Timeout: time.Second * 30,
	}

	if incomingQuery := c.QueryParams(); len(incomingQuery) > 0 {
		existing := remoteURL.Query()
		for key, values := range incomingQuery {
			for _, v := range values {
				existing.Add(key, v)
			}
		}
		remoteURL.RawQuery = existing.Encode()
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

	proxyReq, err := http.NewRequest(c.Request().Method, remoteURL.String(), reqBody)
	if err != nil {
		log.Error("Error creating proxy request", "err", err)
		return c.String(http.StatusInternalServerError, "Failed to create proxy request.")
	}
	apiKey := c.Request().Header.Get("X-KW-AI-API-Key")
	provider := strings.ToLower(c.Request().Header.Get("X-KW-AI-Provider"))

	for name, values := range c.Request().Header {
		if strings.EqualFold(name, "Connection") ||
			strings.EqualFold(name, "Proxy-Connection") ||
			strings.EqualFold(name, "Keep-Alive") ||
			strings.EqualFold(name, "Transfer-Encoding") ||
			strings.EqualFold(name, "Upgrade") ||
			strings.EqualFold(name, "X-KW-AI-API-Key") ||
			strings.EqualFold(name, "X-KW-AI-Provider") {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(name, value)
		}
	}

	if apiKey != "" {
		setProviderAuthHeader(proxyReq, provider, apiKey)
	}

	proxyReq.Host = remoteURL.Host

	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Error("Error sending request to remote server", "url", remoteURL.String(), "err", err)
		return c.String(http.StatusBadGateway, err.Error())
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

// isHopByHopHeader checks if a header is a hop-by-hop header.
// These headers are meaningful only for a single transport-level connection.
// They should not be retransmitted by proxies.
// Based on RFC 2616, section 13.5.1
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

// setProviderAuthHeader sets the appropriate authentication header based on the AI provider.
// Most providers use the standard "Authorization: Bearer <key>" pattern.
// Exceptions:
//   - anthropic: uses "x-api-key: <key>"
//   - azure: uses "api-key: <key>"
func setProviderAuthHeader(req *http.Request, provider, apiKey string) {
	switch provider {
	case "anthropic":
		req.Header.Set("x-api-key", apiKey)
	case "azure":
		req.Header.Set("api-key", apiKey)
	default:
		// Standard Bearer token auth used by: openai, xai, groq, deepinfra,
		// mistral, togetherai, cohere, fireworks, deepseek, cerebras,
		// openrouter, ollama, lmstudio, and others.
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	}
}
