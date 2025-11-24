package config

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"k8s.io/client-go/util/homedir"

	"github.com/stretchr/testify/assert"
)

func TestNewEnv(t *testing.T) {
	tests := []struct {
		name    string
		envHome string
	}{
		{
			name:    "environment setup correctly",
			envHome: "/tmp/home",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("HOME", tt.envHome)
			defer os.Unsetenv("HOME")

			env := NewEnv()
			assert.NotNil(t, env)
			assert.Empty(t, env.KubeConfigs)

			expectedDir := filepath.Join(tt.envHome, appConfigDir, appKubeConfigDir)
			_, err := os.Stat(expectedDir)
			assert.NoError(t, err)
		})
	}
}

func TestNewAppConfig(t *testing.T) {
	t.Run("app config initialization", func(t *testing.T) {
		config := NewAppConfig("appTest", "7080", 10, 10, false, "", "")
		assert.NotNil(t, config)
		assert.NotNil(t, config.KubeConfig)
	})
}

func TestAppConfigLoadAppConfig(t *testing.T) {
	t.Run("load app config with invalid paths", func(t *testing.T) {
		os.Setenv("HOME", "/invalid/home/path")
		defer os.Unsetenv("HOME")

		config := NewAppConfig("appTest", "7080", 10, 10, false, "", "")
		config.LoadAppConfig()
		assert.NotContains(t, config.KubeConfig, InClusterKey)
	})
}

func TestAppConfigBuildKubeConfigs(t *testing.T) {
	tests := []struct {
		name      string
		dirPath   string
		expectErr bool
	}{
		{
			name:      "error path - invalid kube config directory",
			dirPath:   "/invalid/path",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := NewAppConfig("appTest", "7080", 10, 10, false, "", "")
			config.buildKubeConfigs(tt.dirPath)
			if tt.expectErr {
				assert.Empty(t, config.KubeConfig)
			} else {
				assert.NotEmpty(t, config.KubeConfig)
			}
		})
	}
}

func TestAppConfigRemoveKubeConfig(t *testing.T) {
	tests := []struct {
		name    string
		uuid    string
		setup   func()
		cleanup func()
	}{
		{
			name: "happy path - kubeconfig file exists",
			uuid: "test-config",
			setup: func() {
				os.MkdirAll(filepath.Join(homedir.HomeDir(), appConfigDir, appKubeConfigDir), 0755)
				os.WriteFile(filepath.Join(homedir.HomeDir(), appConfigDir, appKubeConfigDir, "test-config"), []byte("test content"), 0644)
			},
			cleanup: func() {
				os.RemoveAll(filepath.Join(homedir.HomeDir(), appConfigDir))
			},
		},
		{
			name:    "error path - kubeconfig file does not exist",
			uuid:    "nonexistent-config",
			setup:   func() {},
			cleanup: func() {},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			defer tt.cleanup()

			config := NewAppConfig("appTest", "7080", 10, 10, false, "", "")
			err := config.RemoveKubeConfig(tt.uuid)
			if tt.name == "error path - kubeconfig file does not exist" {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAppConfigSaveKubeConfig(t *testing.T) {
	tests := []struct {
		name  string
		uuid  string
		setup func()
	}{
		{
			name:  "error path - invalid kubeconfig file",
			uuid:  "invalid-config",
			setup: func() {},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			defer os.RemoveAll(filepath.Join(homedir.HomeDir(), appConfigDir))

			config := NewAppConfig("appTest", "7080", 10, 10, false, "", "")
			config.SaveKubeConfig(tt.uuid)
			if tt.name == "error path - invalid kubeconfig file" {
				assert.Empty(t, config.KubeConfig)
			} else {
				assert.NotEmpty(t, config.KubeConfig)
			}
		})
	}
}

func TestHomeDir(t *testing.T) {
	tests := []struct {
		name     string
		envHome  string
		expected string
	}{
		{
			name:     "happy path - HOME environment variable is set",
			envHome:  "/tmp/home",
			expected: "/tmp/home",
		},
		{
			name:     "error path - HOME environment variable is not set",
			envHome:  "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("HOME", tt.envHome)
			defer os.Unsetenv("HOME")

			home := homedir.HomeDir()
			assert.Equal(t, tt.expected, home)
		})
	}
}

func TestReadAllFilesInDir(t *testing.T) {
	// Create a temporary directory
	tempDir, err := os.MkdirTemp("", "example-dir-*")
	if err != nil {
		fmt.Println("Error creating temp directory:", err)
		return
	}
	defer os.RemoveAll(tempDir) // Clean up the directory and files after use

	// Create two empty files within the directory
	file1Path := filepath.Join(tempDir, "file1.txt")
	file2Path := filepath.Join(tempDir, "file2.txt")

	_, err = os.Create(file1Path)
	if err != nil {
		fmt.Println("Error creating file1:", err)
		return
	}

	_, err = os.Create(file2Path)
	if err != nil {
		fmt.Println("Error creating file2:", err)
		return
	}

	tests := []struct {
		name        string
		dirPath     string
		expectedLen int
	}{
		{
			name:        "happy path - directory exists",
			dirPath:     tempDir,
			expectedLen: 2,
		},
		{
			name:        "error path - directory does not exist",
			dirPath:     "/invalid/path",
			expectedLen: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			files := readAllFilesInDir(tt.dirPath)
			assert.Equal(t, tt.expectedLen, len(files))
		})
	}
}
