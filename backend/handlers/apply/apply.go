package apply

import (
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/labstack/echo/v4"
	"net/http"
)

const POSTApply = 8

type ApplyHandler struct {
	BaseHandler base.BaseHandler
}

func NewApplyHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		config := c.QueryParam("config")
		cluster := c.QueryParam("cluster")

		handler := &ApplyHandler{
			BaseHandler: base.BaseHandler{
				Kind:         "Node",
				Container:    container,
				QueryConfig:  config,
				QueryCluster: cluster,
			},
		}
		switch routeType {
		case POSTApply:
			return handler.PostApply(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func (h *ApplyHandler) PostApply(c echo.Context) error {
	dynamicClient := h.BaseHandler.Container.DynamicClient(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster)
	discoveryClient := h.BaseHandler.Container.DiscoveryClient(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster)
	inputYaml := []byte(c.FormValue("yaml"))

	if checkKubectlCLIPresent() {
		cluster := h.BaseHandler.Container.Config().KubeConfig[h.BaseHandler.QueryConfig]
		output, err := applyYAML(cluster.AbsolutePath, h.BaseHandler.QueryCluster, string(inputYaml))
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, echo.Map{
			"success": output,
		})
	}

	applyOptions := NewApplyOptions(dynamicClient, discoveryClient)
	err := applyOptions.Apply(c.Request().Context(), inputYaml)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, echo.Map{
		"success": true,
	})
}
