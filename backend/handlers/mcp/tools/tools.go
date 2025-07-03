package tools

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/mcp/helpers"
	"github.com/labstack/echo/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Toolset struct {
	ReadOnlyTools []server.ServerTool
}

func NewServerTool(tool mcp.Tool, handler server.ToolHandlerFunc) server.ServerTool {
	return server.ServerTool{Tool: tool, Handler: handler}
}

var readOnlyTools []string

const listTemplate = `Retrieves list of all {{.kindName}}.
Use this tool when you need to fetch information about all {{.kindName}} in the cluster.
When to Use:
- To list all {{.kindName}} in a cluster.
- Filter list of {{.kindName}} by namespace, age, status.
- List status of all the {{.kindName}}.
- When a high-level overview of {{.kindName}} is required.
Response of this tool is in JSON format.
`

const yamlDetailsTemplate = `Get details and status of a single {{.kindName}}.
It includes the full spec and current status of {{.kindName}}.
If namespace is missing:
- Call {{.kindName}}List tool to figure out the namespace.
- Other tools may help based on input.
Response of this tool is in YAML format.`

func ListTool(c echo.Context, appContainer container.Container) Toolset {
	var toolset Toolset

	for _, route := range c.Echo().Routes() {
		switch {
		case strings.Contains(route.Name, "List"):
			toolset.ReadOnlyTools = append(toolset.ReadOnlyTools, NewListTool(c, route.Name))
		case strings.Contains(route.Name, "Yaml"):
			toolset.ReadOnlyTools = append(toolset.ReadOnlyTools, NewYamlDetailsTool(c, route.Name))
		}
	}

	return toolset
}

func NewListTool(c echo.Context, routeName string) server.ServerTool {
	kindName := strings.ReplaceAll(routeName, "List", "")

	description := parseTemplate(listTemplate, map[string]string{
		"kindName": kindName,
	})

	tool := mcp.NewTool(routeName,
		mcp.WithDescription(description),
		mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: mcp.ToBoolPtr(true)}),
	)

	handler := func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		url := helpers.BuildURL(c, routeName, "", "")
		message, err := helpers.ReadFirstSSEMessage(url)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), err
		}
		return mcp.NewToolResultText(message), nil
	}

	return NewServerTool(tool, handler)
}

func NewYamlDetailsTool(c echo.Context, routeName string) server.ServerTool {
	// podsYamlDetails
	toolName := fmt.Sprintf("%sDetails", routeName)
	// pods
	kindName := strings.ReplaceAll(routeName, "Yaml", "")

	description := parseTemplate(yamlDetailsTemplate, map[string]string{
		"kindName": kindName,
	})

	tool := mcp.NewTool(toolName,
		mcp.WithDescription(description),
		mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: mcp.ToBoolPtr(true)}),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Name of the "+kindName),
		),
		mcp.WithString("namespace",
			mcp.Required(),
			mcp.Description("Namespace in which the "+kindName+" is present. Call "+kindName+"List to figure it out if missing."),
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

		url := helpers.BuildURL(c, routeName, name, namespace)
		message, err := helpers.ReadFirstSSEMessage(url)
		if err != nil {
			log.Error("failed to read SSE message", "err", err)
			return mcp.NewToolResultError(err.Error()), err
		}

		// Clean SSE prefix/suffix
		message = strings.TrimPrefix(message, "{\"data\":\"")
		message = strings.TrimSuffix(message, "\"}")

		decoded, err := base64.StdEncoding.DecodeString(message)
		if err != nil {
			log.Error("failed to decode YAML", "err", err)
			return mcp.NewToolResultError(err.Error()), err
		}

		return mcp.NewToolResultText(string(decoded)), nil
	}

	return NewServerTool(tool, handler)
}
