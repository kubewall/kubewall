package mcp

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"

	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
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
