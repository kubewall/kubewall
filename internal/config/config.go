package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the application
type Config struct {
	Server  ServerConfig
	Logging LoggingConfig
	K8s     K8sConfig
}

// ServerConfig holds server-specific configuration
type ServerConfig struct {
	Port string
	Host string
}

// LoggingConfig holds logging-specific configuration
type LoggingConfig struct {
	Level string
}

// K8sConfig holds Kubernetes-specific configuration
type K8sConfig struct {
	DefaultNamespace string
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port: getEnv("PORT", "7080"),
			Host: getEnv("HOST", "0.0.0.0"),
		},
		Logging: LoggingConfig{
			Level: getEnv("LOG_LEVEL", "info"),
		},
		K8s: K8sConfig{
			DefaultNamespace: getEnv("K8S_DEFAULT_NAMESPACE", "default"),
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
