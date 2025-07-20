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
	"github.com/kubewall/kubewall/backend/handlers/mcp/tools"
	"github.com/labstack/echo/v4"
	"github.com/mark3labs/mcp-go/server"
)

func Server(e *echo.Echo, appContainer container.Container) {
	mcpServer := server.NewMCPServer("kubewall-mcp-server", "0.0.1",
		server.WithToolCapabilities(true),
		server.WithRecovery(),
	)

	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if strings.Contains(c.Path(), "mcp") {
				toolSet := tools.ListTool(c, appContainer)
				for _, v := range toolSet.ReadOnlyTools {
					mcpServer.AddTool(v.Tool, v.Handler)
				}
			}
			return next(c)
		}
	})

	// Use a dynamic base path based on a path parameter (Go 1.22+)
	sseServer := server.NewSSEServer(
		mcpServer,
		server.WithDynamicBasePath(func(r *http.Request, sessionID string) string {
			return "api/v1/mcp"
		}),
		server.WithKeepAlive(true),
		server.WithBaseURL(baseURL(appContainer)),
		server.WithAppendQueryToMessageEndpoint(),
		server.WithUseFullURLForMessageEndpoint(true),
	)

	e.GET("api/v1/mcp/sse", echo.WrapHandler(sseServer.SSEHandler()))
	e.POST("/api/v1/mcp/message", echo.WrapHandler(sseServer.MessageHandler()))

	// Proxy handler
	e.Any("api/v1/mcp/proxy/*", ProxyHandler)
}

func ProxyHandler(c echo.Context) error {
	remoteURLPart := c.Param("*") // Capture all after the defined path (e.g., /proxy/*)

	// Basic validation for the remote URL part
	if remoteURLPart == "" {
		return c.String(http.StatusBadRequest, "Missing remote URL in path. Example: /proxy/https://api.example.com/data")
	}

	// Construct the full remote URL.
	// You might want to implement more robust URL parsing and validation here.
	// For simplicity, we'll assume the entire remoteURLPart is a valid absolute URL.
	remoteURL, err := url.Parse(remoteURLPart)
	if err != nil {
		log.Printf("Error parsing remote URL: %v", err)
		return c.String(http.StatusBadRequest, "Invalid remote URL provided.")
	}

	// Create a new HTTP client
	client := &http.Client{}

	// Create a new request to the remote server
	var reqBody io.Reader
	if c.Request().Body != nil {
		// Read the request body. We need to read it once and then reuse it
		// since c.Request().Body is a ReadCloser and can only be read once.
		bodyBytes, err := io.ReadAll(c.Request().Body)
		if err != nil {
			log.Printf("Error reading request body: %v", err)
			return c.String(http.StatusInternalServerError, "Failed to read request body.")
		}
		reqBody = bytes.NewBuffer(bodyBytes)
		c.Request().Body = io.NopCloser(bytes.NewBuffer(bodyBytes)) // Restore the body for potential future use (though not needed for proxying)
	}

	proxyReq, err := http.NewRequest(c.Request().Method, remoteURL.String(), reqBody)
	if err != nil {
		log.Printf("Error creating proxy request: %v", err)
		return c.String(http.StatusInternalServerError, "Failed to create proxy request.")
	}

	// Copy headers from the incoming request to the proxy request
	// Exclude hop-by-hop headers that are handled by the transport
	for name, values := range c.Request().Header {
		// These headers are typically handled by HTTP transport or are not relevant for proxying directly
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

	// Set the Host header to the remote host. This is crucial for some remote servers.
	proxyReq.Host = remoteURL.Host

	// Send the request to the remote server
	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Printf("Error sending request to remote server %s: %v", remoteURL.String(), err)
		// For network errors, you might want to return a specific status code like Bad Gateway
		return c.String(http.StatusBadGateway, "Failed to reach remote server.")
	}
	defer resp.Body.Close()

	// Copy headers from the remote response back to the UI response
	for name, values := range resp.Header {
		// Exclude hop-by-hop headers from the response as well
		if isHopByHopHeader(name) {
			continue
		}
		for _, value := range values {
			c.Response().Header().Add(name, value)
		}
	}

	// Set the status code from the remote response
	c.Response().WriteHeader(resp.StatusCode)

	// Stream the response body back to the UI
	_, err = io.Copy(c.Response().Writer, resp.Body)
	if err != nil {
		log.Printf("Error copying response body: %v", err)
		return c.String(http.StatusInternalServerError, "Failed to send response back to UI.")
	}

	return nil
}

func baseURL(appContainer container.Container) string {
	// Split IP and Port
	host, port, err := net.SplitHostPort(appContainer.Config().ListenAddr)
	if err != nil {
		// fallback if listenAddr is invalid
		host = "localhost"
		port = "7080"
	}
	// Default to localhost if no IP is provided (e.g., ":7080")
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
