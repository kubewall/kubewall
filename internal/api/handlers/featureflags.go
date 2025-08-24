package handlers

import (
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/Facets-cloud/kube-dash/pkg/logger"
	"github.com/gin-gonic/gin"
)

// FeatureFlagsHandler handles feature flag requests
type FeatureFlagsHandler struct {
	logger *logger.Logger
}

// FeatureFlagsResponse represents the response structure for feature flags
type FeatureFlagsResponse struct {
	EnableTracing    bool `json:"enableTracing"`
	EnableCloudShell bool `json:"enableCloudShell"`
}

// NewFeatureFlagsHandler creates a new feature flags handler
func NewFeatureFlagsHandler(log *logger.Logger) *FeatureFlagsHandler {
	return &FeatureFlagsHandler{
		logger: log,
	}
}

// GetFeatureFlags returns the current feature flag configuration
// @Summary Get Feature Flags
// @Description Get the current feature flag configuration including tracing and cloud shell enablement
// @Tags System
// @Accept json
// @Produce json
// @Success 200 {object} FeatureFlagsResponse "Feature flags configuration"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/feature-flags [get]
func (h *FeatureFlagsHandler) GetFeatureFlags(c *gin.Context) {
	// Read runtime environment variables
	enableTracing := h.getBoolEnvVar("ENABLE_TRACING", false)
	enableCloudShell := h.getBoolEnvVar("ENABLE_CLOUD_SHELL", false)

	h.logger.WithField("enableTracing", enableTracing).WithField("enableCloudShell", enableCloudShell).Debug("Serving feature flags")

	response := FeatureFlagsResponse{
		EnableTracing:    enableTracing,
		EnableCloudShell: enableCloudShell,
	}

	c.JSON(http.StatusOK, response)
}

// getBoolEnvVar reads a boolean environment variable with a default value
func (h *FeatureFlagsHandler) getBoolEnvVar(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	// Handle common boolean representations
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "true", "1", "yes", "on", "enabled":
		return true
	case "false", "0", "no", "off", "disabled":
		return false
	default:
		// Try to parse as boolean
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
		h.logger.WithField("key", key).WithField("value", value).Warn("Invalid boolean value for environment variable, using default")
		return defaultValue
	}
}