package app

import (
	"encoding/base64"
	"fmt"
	"github.com/google/uuid"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"k8s.io/client-go/tools/clientcmd"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type AppConfigHandler struct {
	container container.Container
}

func NewAppConfigHandler(container container.Container) *AppConfigHandler {
	return &AppConfigHandler{container: container}
}

func (h *AppConfigHandler) Get(c echo.Context) error {
	return c.JSON(200, h.container.Config())
}

func (h *AppConfigHandler) Post(c echo.Context) error {
	file := c.FormValue("file")

	if len(file) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "file is empty")
	}

	uuidStr := uuid.New().String()
	path := filepath.Join(homeDir(), ".kubewall", "kubeconfigs", uuidStr)

	if err := os.WriteFile(path, []byte(file), 0666); err != nil {
		return echo.NewHTTPError(500, "Failed to write kubeconfig").SetInternal(err)
	}

	if err := validateKubeConfig(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(400, "Invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(uuidStr)

	return c.JSON(200, echo.Map{
		"success": true,
	})
}

func (h *AppConfigHandler) PostBearer(c echo.Context) error {
	serverIP := strings.TrimSpace(c.FormValue("serverIP"))
	name := strings.TrimSpace(c.FormValue("name"))
	token := strings.TrimSpace(c.FormValue("token"))
	if serverIP == "" || name == "" || token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "serverIP or name or token is empty")
	}

	uuidStr := uuid.New().String()
	path := filepath.Join(homeDir(), ".kubewall", "kubeconfigs", uuidStr)

	config := createBearerConfig(
		serverIP,
		name,
		token,
	)

	if err := os.WriteFile(path, []byte(config), 0666); err != nil {
		return echo.NewHTTPError(500, "Failed to write kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(uuidStr)

	return c.JSON(200, echo.Map{
		"success": true,
	})
}

func (h *AppConfigHandler) PostCertificate(c echo.Context) error {
	serverIP := strings.TrimSpace(c.FormValue("serverIP"))
	name := strings.TrimSpace(c.FormValue("name"))
	clientCertData := base64.StdEncoding.EncodeToString([]byte(strings.TrimSpace(c.FormValue("clientCertData"))))
	clientKeyData := base64.StdEncoding.EncodeToString([]byte(strings.TrimSpace(c.FormValue("clientKeyData"))))

	if serverIP == "" || name == "" || clientCertData == "" || clientKeyData == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "serverIP or name or clientCertData  or clientKeyData is empty")
	}

	uuidStr := uuid.New().String()
	path := filepath.Join(homeDir(), ".kubewall", "kubeconfigs", uuidStr)

	config := createCertificateConfig(
		serverIP,
		name,
		clientCertData,
		clientKeyData,
	)

	if err := os.WriteFile(path, []byte(config), 0666); err != nil {
		return echo.NewHTTPError(500, "Failed to write kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(uuidStr)

	return c.JSON(200, echo.Map{
		"success": true,
	})
}

func (h *AppConfigHandler) Delete(c echo.Context) error {
	uuid := c.Param("uuid")
	if err := h.container.Config().RemoveKubeConfig(uuid); err != nil {
		return echo.NewHTTPError(500, "Failed to remove kubeconfig").SetInternal(err)
	}
	return c.JSON(http.StatusOK, echo.Map{
		"success": true,
	})
}

func homeDir() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	return os.Getenv("USERPROFILE")
}

func validateKubeConfig(path string) error {
	_, err := clientcmd.LoadFromFile(path)
	return err
}

func createBearerConfig(serverIP, name, token string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Config
preferences: {}
clusters:
- cluster:
    server: %s
  name: %s
contexts:
- context:
    cluster: %s
    user: %s
  name: %s
current-context: %s
users:
- name: %s
  user:
    token: %s
`, serverIP, name, name, name, name, name, name, token)
}

func createCertificateConfig(serverIP, name, clientCertData, clientKeyData string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Config
preferences: {}
clusters:
- cluster:
    certificate-authority-data: %s
    server: %s
  name: %s
contexts:
- context:
    cluster: %s
    user: %s
  name: %s
current-context: %s
users:
- name: %s
  user:
    client-certificate-data: %s
    client-key-data: %s
`, clientCertData, serverIP, name, name, name, name, name, name, clientCertData, clientKeyData)
}
