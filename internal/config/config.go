package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the application
type Config struct {
	Server      ServerConfig
	Logging     LoggingConfig
	K8s         K8sConfig
	StaticFiles StaticFilesConfig
	Tracing     TracingConfig
}

// ServerConfig holds server-specific configuration
type ServerConfig struct {
	Port         string
	Host         string
	ReadTimeout  int // in seconds
	WriteTimeout int // in seconds
	IdleTimeout  int // in seconds
}

// LoggingConfig holds logging-specific configuration
type LoggingConfig struct {
	Level string
}

// K8sConfig holds Kubernetes-specific configuration
type K8sConfig struct {
	DefaultNamespace string
}

// StaticFilesConfig holds static files configuration
type StaticFilesConfig struct {
	Path string
}

// TracingConfig holds OpenTelemetry tracing configuration
type TracingConfig struct {
	Enabled         bool    `json:"enabled"`
	SamplingRate    float64 `json:"samplingRate"`
	MaxTraces       int     `json:"maxTraces"`
	RetentionHours  int     `json:"retentionHours"`
	ExportEnabled   bool    `json:"exportEnabled"`
	JaegerEndpoint  string  `json:"jaegerEndpoint"`
	ServiceName     string  `json:"serviceName"`
	ServiceVersion  string  `json:"serviceVersion"`
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "7080"),
			Host:         getEnv("HOST", "0.0.0.0"),
			ReadTimeout:  getEnvAsInt("SERVER_READ_TIMEOUT", 60),
			WriteTimeout: getEnvAsInt("SERVER_WRITE_TIMEOUT", 60),
			IdleTimeout:  getEnvAsInt("SERVER_IDLE_TIMEOUT", 120),
		},
		Logging: LoggingConfig{
			Level: getEnv("LOG_LEVEL", "info"),
		},
		K8s: K8sConfig{
			DefaultNamespace: getEnv("K8S_DEFAULT_NAMESPACE", "default"),
		},
		StaticFiles: StaticFilesConfig{
			Path: getEnv("STATIC_FILES_PATH", "client/dist"),
		},
		Tracing: TracingConfig{
			Enabled:         getEnvAsBool("TRACING_ENABLED", true),
			SamplingRate:    getEnvAsFloat("TRACING_SAMPLING_RATE", 1.0),
			MaxTraces:       getEnvAsInt("TRACING_MAX_TRACES", 10000),
			RetentionHours:  getEnvAsInt("TRACING_RETENTION_HOURS", 24),
			ExportEnabled:   getEnvAsBool("TRACING_EXPORT_ENABLED", false),
			JaegerEndpoint:  getEnv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces"),
			ServiceName:     getEnv("TRACING_SERVICE_NAME", "kube-dash"),
			ServiceVersion:  getEnv("TRACING_SERVICE_VERSION", "1.0.0"),
		},
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt gets an environment variable as integer or returns a default value
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvAsBool gets an environment variable as boolean or returns a default value
func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

// getEnvAsFloat gets an environment variable as float64 or returns a default value
func getEnvAsFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}
