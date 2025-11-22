package mcp

import (
	"net/http"
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
		server.WithAppendQueryToMessageEndpoint(),
		server.WithUseFullURLForMessageEndpoint(true),
	)

	e.GET("api/v1/mcp/sse", echo.WrapHandler(sseServer.SSEHandler()))
	e.POST("/api/v1/mcp/message", echo.WrapHandler(sseServer.MessageHandler()))

	e.Any("/api/v1/mcp/llm/v1/*", func(c echo.Context) error {
		return AnthropicProxyHandler(appContainer, c)
	})
}
