package app

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/kubewall/kubewall/backend/config"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"k8s.io/client-go/tools/clientcmd"
)

var configNameRegex = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)

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
	h.container.Cache().InvalidateAll()
	h.container.Config().ReloadConfig()
	return c.Redirect(http.StatusTemporaryRedirect, "/")
}

func (h *AppConfigHandler) Post(c echo.Context) error {
	kubeconfig := c.FormValue("file")
	if strings.TrimSpace(kubeconfig) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "kubeconfig is empty")
	}

	// Get and validate config name
	configName := strings.TrimSpace(c.FormValue("configName"))
	if err := validateConfigName(configName); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Normalize to lowercase (validateConfigName already does this, but be explicit)
	configName = strings.ToLower(strings.TrimSpace(configName))

	// Check for duplicates
	if h.container.Config().ConfigExists(configName) {
		return echo.NewHTTPError(http.StatusConflict, fmt.Sprintf("config '%s' already exists", configName))
	}

	path := filepath.Join(homeDir(), config.AppConfigDir, config.AppKubeConfigDir, configName)

	if err := writeKubeconfigToFile(path, kubeconfig); err != nil {
		return err
	}
	if err := validateKubeconfigFile(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(configName)
	return c.JSON(http.StatusOK, echo.Map{"success": true, "configId": configName})
}

func (h *AppConfigHandler) PostBearer(c echo.Context) error {
	serverIP := strings.TrimSpace(c.FormValue("serverIP"))
	name := strings.TrimSpace(c.FormValue("name"))
	token := strings.TrimSpace(c.FormValue("token"))
	configName := strings.TrimSpace(c.FormValue("configName"))

	if serverIP == "" || name == "" || token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing required fields: serverIP, name, or token")
	}

	// Validate config name
	if err := validateConfigName(configName); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Normalize to lowercase
	configName = strings.ToLower(strings.TrimSpace(configName))

	// Check for duplicates
	if h.container.Config().ConfigExists(configName) {
		return echo.NewHTTPError(http.StatusConflict, fmt.Sprintf("config '%s' already exists", configName))
	}

	kubeconfig := generateBearerConfig(serverIP, name, token)
	path := filepath.Join(homeDir(), config.AppConfigDir, config.AppKubeConfigDir, configName)

	if err := writeKubeconfigToFile(path, kubeconfig); err != nil {
		return err
	}
	if err := validateKubeconfigFile(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(configName)
	return c.JSON(http.StatusOK, echo.Map{"success": true, "configId": configName})
}

func (h *AppConfigHandler) PostCertificate(c echo.Context) error {
	serverIP := strings.TrimSpace(c.FormValue("serverIP"))
	name := strings.TrimSpace(c.FormValue("name"))
	cert := strings.TrimSpace(c.FormValue("clientCertData"))
	key := strings.TrimSpace(c.FormValue("clientKeyData"))
	configName := strings.TrimSpace(c.FormValue("configName"))

	if serverIP == "" || name == "" || cert == "" || key == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing required fields: serverIP, name, clientCertData, or clientKeyData")
	}

	// Validate config name
	if err := validateConfigName(configName); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Normalize to lowercase
	configName = strings.ToLower(strings.TrimSpace(configName))

	// Check for duplicates
	if h.container.Config().ConfigExists(configName) {
		return echo.NewHTTPError(http.StatusConflict, fmt.Sprintf("config '%s' already exists", configName))
	}

	encodedCert := base64.StdEncoding.EncodeToString([]byte(cert))
	encodedKey := base64.StdEncoding.EncodeToString([]byte(key))
	kubeconfig := generateCertificateConfig(serverIP, name, encodedCert, encodedKey)

	path := filepath.Join(homeDir(), config.AppConfigDir, config.AppKubeConfigDir, configName)
	if err := writeKubeconfigToFile(path, kubeconfig); err != nil {
		return err
	}

	if err := validateKubeconfigFile(path); err != nil {
		defer os.Remove(path)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid kubeconfig").SetInternal(err)
	}

	h.container.Config().SaveKubeConfig(configName)
	return c.JSON(http.StatusOK, echo.Map{"success": true, "configId": configName})
}

func (h *AppConfigHandler) Delete(c echo.Context) error {
	if err := h.container.Config().RemoveKubeConfig(c.Param("configId")); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to remove kubeconfig").SetInternal(err)
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

func validateConfigName(name string) error {
	name = strings.TrimSpace(name)

	// Explicit empty check for better UX error message
	if name == "" {
		return fmt.Errorf("config name is required")
	}

	name = strings.ToLower(name)

	if len(name) < 1 || len(name) > 63 {
		return fmt.Errorf("config name must be 1-63 characters")
	}

	if name == config.InClusterKey {
		return fmt.Errorf("'%s' is a reserved name", config.InClusterKey)
	}

	if !configNameRegex.MatchString(name) {
		return fmt.Errorf("config name must start and end with a lowercase letter or number, and can only contain lowercase letters, numbers, and hyphens")
	}

	return nil
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
