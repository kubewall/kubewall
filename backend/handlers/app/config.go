package app

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"k8s.io/client-go/tools/clientcmd"
)

type AppConfigHandler struct {
	container container.Container
}

func NewAppConfigHandler(container container.Container) *AppConfigHandler {
	return &AppConfigHandler{container: container}
}

func (h *AppConfigHandler) Get(c echo.Context) error {
	return c.JSON(http.StatusOK, h.container.Config())
}

func (h *AppConfigHandler) Reload(c echo.Context) error {
	h.container.Cache().Clear()
	h.container.Config().ReloadConfig()
	return c.Redirect(http.StatusTemporaryRedirect, "/")
}

func (h *AppConfigHandler) Post(c echo.Context) error {
	kubeconfig := c.FormValue("file")
	if strings.TrimSpace(kubeconfig) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "kubeconfig is empty")
	}

	uuidStr, path := generateConfigPath()

	if err := writeKubeconfigToFile(path, kubeconfig); err != nil {
		return err
	}
	if err := validateKubeconfigFile(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(uuidStr)
	return c.JSON(http.StatusOK, echo.Map{"success": true})
}

func (h *AppConfigHandler) PostBearer(c echo.Context) error {
	serverIP := strings.TrimSpace(c.FormValue("serverIP"))
	name := strings.TrimSpace(c.FormValue("name"))
	token := strings.TrimSpace(c.FormValue("token"))

	if serverIP == "" || name == "" || token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing required fields: serverIP, name, or token")
	}

	kubeconfig := generateBearerConfig(serverIP, name, token)
	uuidStr, path := generateConfigPath()

	if err := writeKubeconfigToFile(path, kubeconfig); err != nil {
		return err
	}
	if err := validateKubeconfigFile(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(uuidStr)
	return c.JSON(http.StatusOK, echo.Map{"success": true})
}

func (h *AppConfigHandler) PostCertificate(c echo.Context) error {
	serverIP := strings.TrimSpace(c.FormValue("serverIP"))
	name := strings.TrimSpace(c.FormValue("name"))
	cert := strings.TrimSpace(c.FormValue("clientCertData"))
	key := strings.TrimSpace(c.FormValue("clientKeyData"))

	if serverIP == "" || name == "" || cert == "" || key == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing required fields: serverIP, name, clientCertData, or clientKeyData")
	}

	encodedCert := base64.StdEncoding.EncodeToString([]byte(cert))
	encodedKey := base64.StdEncoding.EncodeToString([]byte(key))
	kubeconfig := generateCertificateConfig(serverIP, name, encodedCert, encodedKey)

	uuidStr, path := generateConfigPath()
	if err := writeKubeconfigToFile(path, kubeconfig); err != nil {
		return err
	}

	if err := validateKubeconfigFile(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(uuidStr)
	return c.JSON(http.StatusOK, echo.Map{"success": true})
}

func (h *AppConfigHandler) Delete(c echo.Context) error {
	if err := h.container.Config().RemoveKubeConfig(c.Param("uuid")); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to remove kubeconfig").SetInternal(err)
	}
	return c.JSON(http.StatusOK, echo.Map{"success": true})
}

// ---------- Helper Functions Below ----------
func homeDir() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	return os.Getenv("USERPROFILE") // For Windows
}

func generateConfigPath() (uuidStr string, fullPath string) {
	uuidStr = uuid.New().String()
	fullPath = filepath.Join(homeDir(), ".kubewall", "kubeconfigs", uuidStr)
	return
}

func writeKubeconfigToFile(path, content string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create directory").SetInternal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to write kubeconfig").SetInternal(err)
	}
	return nil
}

func validateKubeconfigFile(path string) error {
	_, err := clientcmd.LoadFromFile(path)
	return err
}

func generateBearerConfig(serverIP, name, token string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Config
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

func generateCertificateConfig(serverIP, name, certData, keyData string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Config
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
`, certData, serverIP, name, name, name, name, name, name, certData, keyData)
}
