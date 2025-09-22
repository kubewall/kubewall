package portforward

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
)

type PortForwardRequest struct {
	Namespace     string `json:"namespace"`
	Pod           string `json:"pod"`
	LocalPort     int    `json:"localPort"`
	ContainerPort int    `json:"containerPort"`
	ContainerName string `json:"containerName"`
}

type PortForwardHandler struct {
	container container.Container
}

func NewPortForwardingHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		pf := &PortForwardHandler{
			container: container,
		}
		switch routeType {
		case base.GetList:
			return pf.ListPortForwarding(c)
		case base.Create:
			return pf.StartPortForwarding(c)
		case base.Delete:
			return pf.RemovePortForwarding(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func (h *PortForwardHandler) StartPortForwarding(c echo.Context) error {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	req := new(PortForwardRequest)
	if err := c.Bind(req); err != nil {
		return c.String(http.StatusBadRequest, fmt.Sprintf("invalid request: %v", err))
	}
	if req.Namespace == "" || req.Pod == "" || req.ContainerPort == 0 {
		return c.JSON(http.StatusBadRequest, echo.Map{"message": "missing required fields"})
	}

	// Note: Start signature changed to accept config and cluster strings first
	id, actualLocal, err := h.container.PortForwarder().Start(h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), config, cluster, req.Namespace, req.Pod, req.ContainerName, req.LocalPort, req.ContainerPort)
	if err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"message": err.Error()})
	}

	h.publishList(config, cluster)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":        id,
		"localPort": actualLocal,
	})
}

func (h *PortForwardHandler) ListPortForwarding(c echo.Context) error {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	streamID := fmt.Sprintf("%s-%s-portForwarder", config, cluster)
	h.publishList(config, cluster)

	h.container.SSE().ServeHTTP(streamID, c.Response(), c.Request())

	return nil
}

func (h *PortForwardHandler) RemovePortForwarding(c echo.Context) error {
	type RemovePortForwardingRequest struct {
		ID string `json:"id"`
	}
	type Failures struct {
		Message string `json:"message"`
	}

	req := new([]RemovePortForwardingRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"message": err})
	}
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	failures := make([]Failures, 0)

	for _, v := range *req {
		err := h.container.PortForwarder().Stop(config, cluster, h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), v.ID)
		if err != nil {
			failures = append(failures, Failures{
				Message: err.Error(),
			})
		}
	}

	h.publishList(config, cluster)
	return c.JSON(http.StatusOK, echo.Map{"message": failures})
}

func (h *PortForwardHandler) publishList(config, cluster string) {
	list := h.container.PortForwarder().List(h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), config, cluster)
	streamID := fmt.Sprintf("%s-%s-portForwarder", config, cluster)
	b, _ := json.Marshal(list)
	go h.container.SSE().Publish(streamID, &sse.Event{Data: b})
}
