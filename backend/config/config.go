package config

import (
	"os"
	"path/filepath"
	"sync"

	"k8s.io/client-go/util/homedir"
)

var K8SQPS = 100
var K8SBURST = 200

const (
	defaultKubeConfigDir = ".kube"
	appConfigDir         = ".kubewall"
	appKubeConfigDir     = "kubeconfigs"
	InClusterKey         = "incluster"
)

type Env struct {
	KubeConfigs []KubeConfig `json:"kubeconfigs"`
}

type KubeConfig struct {
	Name         string `json:"name"`
	AbsolutePath string `json:"absolutePath"`
}

type AppConfig struct {
	Version    string                     `json:"version"`
	KubeConfig map[string]*KubeConfigInfo `json:"kubeConfigs"`
	mu         sync.Mutex
}

func NewEnv() *Env {
	env := Env{
		KubeConfigs: make([]KubeConfig, 0),
	}
	createEnvDirAndFile()

	return &env
}

func NewAppConfig(version string, k8sClientQPS, k8sClientBurst int) *AppConfig {
	K8SQPS = k8sClientQPS
	K8SBURST = k8sClientBurst
	return &AppConfig{
		Version:    version,
		KubeConfig: make(map[string]*KubeConfigInfo),
	}
}

func (c *AppConfig) LoadAppConfig() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.buildKubeConfigs(filepath.Join(homedir.HomeDir(), defaultKubeConfigDir))
	c.buildKubeConfigs(filepath.Join(homedir.HomeDir(), appConfigDir, appKubeConfigDir))

	i, err := LoadInClusterConfig()
	if err == nil {
		c.KubeConfig[InClusterKey] = &i
	}
}

func (c *AppConfig) ReloadConfig() {
	c.KubeConfig = make(map[string]*KubeConfigInfo)
	c.LoadAppConfig()
}

func (c *AppConfig) buildKubeConfigs(dirPath string) {
	for _, filePath := range readAllFilesInDir(dirPath) {
		if clusters, err := LoadK8ConfigFromFile(filePath); err == nil {
			if len(clusters) > 0 {
				c.KubeConfig[filepath.Base(filePath)] = &KubeConfigInfo{
					Name:         filePath,
					AbsolutePath: filePath,
					FileExists:   true,
					Clusters:     clusters,
				}
			}
		}
	}
}

func readAllFilesInDir(dirPath string) []string {
	var files []string
	dirFiles, err := os.ReadDir(dirPath)
	if err != nil {
		return files
	}
	for _, file := range dirFiles {
		if file.IsDir() {
			continue
		}
		files = append(files, filepath.Join(dirPath, file.Name()))
	}
	return files
}

func (c *AppConfig) RemoveKubeConfig(uuid string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.KubeConfig, uuid)
	return os.Remove(filepath.Join(homedir.HomeDir(), appConfigDir, appKubeConfigDir, uuid))
}

func (c *AppConfig) SaveKubeConfig(uuid string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	filePath := filepath.Join(homedir.HomeDir(), appConfigDir, appKubeConfigDir, uuid)
	if clusters, err := LoadK8ConfigFromFile(filePath); err == nil {
		if len(clusters) > 0 {
			c.KubeConfig[filepath.Base(filePath)] = &KubeConfigInfo{
				Name:         filePath,
				AbsolutePath: filePath,
				FileExists:   true,
				Clusters:     clusters,
			}
		}
	}
}

func createEnvDirAndFile() {
	ensureDirExists(filepath.Join(homedir.HomeDir(), appConfigDir))
	ensureDirExists(filepath.Join(homedir.HomeDir(), appConfigDir, appKubeConfigDir))
}

func ensureDirExists(dirPath string) {
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		os.MkdirAll(dirPath, 0755)
	}
}
