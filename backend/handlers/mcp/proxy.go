package mcp

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

func ProxyHandler(c echo.Context) error {
	remoteURLPart := c.Param("*")

	if remoteURLPart == "" {
		return c.String(http.StatusBadRequest, "Missing remote URL in path. Example: /proxy/https://api.example.com/data")
	}

	remoteURL, err := url.Parse(remoteURLPart)
	if err != nil {
		log.Printf("Error parsing remote URL: %v", err)
		return c.String(http.StatusBadRequest, "Invalid remote URL provided.")
	}

	client := &http.Client{}

	var reqBody io.Reader
	if c.Request().Body != nil {
		bodyBytes, err := io.ReadAll(c.Request().Body)
		if err != nil {
			log.Printf("Error reading request body: %v", err)
			return c.String(http.StatusInternalServerError, "Failed to read request body.")
		}
		reqBody = bytes.NewBuffer(bodyBytes)
		c.Request().Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	proxyReq, err := http.NewRequest(c.Request().Method, remoteURL.String(), reqBody)
	if err != nil {
		log.Printf("Error creating proxy request: %v", err)
		return c.String(http.StatusInternalServerError, "Failed to create proxy request.")
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

	proxyReq.Host = remoteURL.Host

	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Printf("Error sending request to remote server %s: %v", remoteURL.String(), err)
		return c.String(http.StatusBadGateway, "Failed to reach remote server.")
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
		log.Printf("Error copying response body: %v", err)
		return c.String(http.StatusInternalServerError, "Failed to send response back to UI.")
	}

	return nil
}

func baseURL(appContainer container.Container) string {
	host, port, err := net.SplitHostPort(appContainer.Config().ListenAddr)
	if err != nil {
		host = "localhost"
		port = "7080"
	}
	if host == "" || host == "::" {
		host = "localhost"
	}
	scheme := "http"
	if appContainer.Config().IsSecure {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s:%s", scheme, host, port)
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
