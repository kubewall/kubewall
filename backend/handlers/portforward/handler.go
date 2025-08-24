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
	Namespace  string `json:"namespace"`
	Pod        string `json:"pod"`
	LocalPort  int    `json:"localPort"`
	RemotePort int    `json:"remotePort"`
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
	if req.Namespace == "" || req.Pod == "" || req.RemotePort == 0 {
		return c.String(http.StatusBadRequest, "missing required fields")
	}

	// Note: Start signature changed to accept config and cluster strings first
	id, actualLocal, err := h.container.PortForwarder().Start(h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), config, cluster, req.Namespace, req.Pod, req.LocalPort, req.RemotePort)
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Sprintf("failed to start port forward: %v", err))
	}

	streamId := fmt.Sprint("%s-%s-portForwarder", config, cluster)
	list := h.container.PortForwarder().List(h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), config, cluster)
	b, _ := json.Marshal(list)
	go h.container.SSE().Publish(streamId, &sse.Event{
		Data: b,
	})

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":        id,
		"localPort": actualLocal,
	})
}

func (h *PortForwardHandler) ListPortForwarding(c echo.Context) error {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	streamId := fmt.Sprint("%s-%s-portForwarder", config, cluster)
	list := h.container.PortForwarder().List(h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), config, cluster)
	b, _ := json.Marshal(list)
	go h.container.SSE().Publish(streamId, &sse.Event{
		Data: b,
	})

	h.container.SSE().ServeHTTP(streamId, c.Response(), c.Request())

	return nil
}

func (h *PortForwardHandler) RemovePortForwarding(c echo.Context) error {
	type RemovePortForwardingRequest struct {
		Id string `json:"id"`
	}
	type Failures struct {
		Message string `json:"message"`
	}

	req := new([]RemovePortForwardingRequest)
	if err := c.Bind(req); err != nil {
		return c.String(http.StatusBadRequest, fmt.Sprintf("invalid request: %v", err))
	}
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	failures := make([]Failures, 0)

	for _, v := range *req {
		err := h.container.PortForwarder().Stop(config, cluster, h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), v.Id)
		if err != nil {
			failures = append(failures, Failures{
				Message: err.Error(),
			})
		}
	}

	streamId := fmt.Sprint("%s-%s-portForwarder", config, cluster)
	list := h.container.PortForwarder().List(h.container.RestConfig(config, cluster), h.container.ClientSet(config, cluster), config, cluster)
	b, _ := json.Marshal(list)
	go h.container.SSE().Publish(streamId, &sse.Event{
		Data: b,
	})

	return c.JSON(http.StatusOK, map[string]any{
		"failures": failures,
	})
}
