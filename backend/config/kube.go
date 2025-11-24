package config

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/charmbracelet/log"
	apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	apiextensionsinformers "k8s.io/apiextensions-apiserver/pkg/client/informers/externalversions"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
	ctrlconf "sigs.k8s.io/controller-runtime/pkg/client/config"
)

const (
	KubeWallClusterLabel = "kubewall/cluster"
	KubeWallNamespace    = "kubewall"
)

type KubeConfigInfo struct {
	Name         string              `json:"name"`
	AbsolutePath string              `json:"absolutePath"`
	FileExists   bool                `json:"fileExists"`
	Clusters     map[string]*Cluster `json:"clusters"`
}

type Cluster struct {
	Name                     string                                       `json:"name"`
	Namespace                string                                       `json:"namespace"`
	AuthInfo                 string                                       `json:"authInfo"`
	Connected                bool                                         `json:"connected"`
	RestConfig               *rest.Config                                 `json:"-"`
	ClientSet                *kubernetes.Clientset                        `json:"-"`
	DynamicClient            *dynamic.DynamicClient                       `json:"-"`
	DiscoveryClient          *discovery.DiscoveryClient                   `json:"-"`
	SharedInformerFactory    informers.SharedInformerFactory              `json:"-"`
	ExtensionInformerFactory apiextensionsinformers.SharedInformerFactory `json:"-"`
	DynamicInformerFactory   dynamicinformer.DynamicSharedInformerFactory `json:"-"`
	MetricClient             *metricsclient.Clientset                     `json:"-"`
	mu                       sync.Mutex                                   `json:"-"`
}

type SecretClusterConfig struct {
	BearerToken     string `json:"bearerToken"`
	TlsClientConfig struct {
		Insecure bool   `json:"insecure"`
		KeyData  string `json:"keyData,omitempty"`
		CertData string `json:"certData,omitempty"`
		CaData   string `json:"caData,omitempty"`
	} `json:"tlsClientConfig"`
}

func (clusterConfig *SecretClusterConfig) toRestConfig(server string) *rest.Config {
	restConfig := &rest.Config{
		Host:        server,
		BearerToken: clusterConfig.BearerToken,
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true,
		},
	}
	clusterConfig.addTLSConfigurationsInto(restConfig)
	return restConfig
}

func (clusterConfig *SecretClusterConfig) addTLSConfigurationsInto(restConfig *rest.Config) {
	restConfig.TLSClientConfig = rest.TLSClientConfig{Insecure: clusterConfig.TlsClientConfig.Insecure}
	if !clusterConfig.TlsClientConfig.Insecure {
		restConfig.TLSClientConfig.ServerName = restConfig.ServerName
		restConfig.TLSClientConfig.KeyData = []byte(clusterConfig.TlsClientConfig.KeyData)
		restConfig.TLSClientConfig.CertData = []byte(clusterConfig.TlsClientConfig.CertData)
		restConfig.TLSClientConfig.CAData = []byte(clusterConfig.TlsClientConfig.CaData)
	}
}

func (c *Cluster) GetClientSet() *kubernetes.Clientset {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.ClientSet
}

func (c *Cluster) GetDynamicClient() *dynamic.DynamicClient {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.DynamicClient
}

func (c *Cluster) GetDiscoveryClient() *discovery.DiscoveryClient {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.DiscoveryClient
}

func (c *Cluster) GetSharedInformerFactory() informers.SharedInformerFactory {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.SharedInformerFactory
}

func (c *Cluster) GetDynamicSharedInformerFactory() dynamicinformer.DynamicSharedInformerFactory {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.DynamicInformerFactory
}

func (c *Cluster) GetExtensionInformerFactory() apiextensionsinformers.SharedInformerFactory {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.ExtensionInformerFactory
}

func (c *Cluster) GetMetricClient() *metricsclient.Clientset {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.MetricClient
}

func (c *Cluster) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.Connected
}

func (c *Cluster) MarkAsConnected() *Cluster {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.Connected = true
	return c
}

func LoadInClusterConfig() (KubeConfigInfo, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return KubeConfigInfo{}, err
	}
	kubeConfig, err := loadClientConfig(config)
	if err != nil {
		return KubeConfigInfo{}, err
	}
	kubeConfig.Name = InClusterKey
	newConfig := KubeConfigInfo{
		Name:         InClusterKey,
		AbsolutePath: "",
		FileExists:   true,
		Clusters: map[string]*Cluster{
			InClusterKey: kubeConfig,
		},
	}
	return newConfig, nil
}

func GetApplicationNamespace() string {
	if namespace := os.Getenv("NAMESPACE"); namespace != "" {
		return namespace
	}

	contents, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
	if err != nil {
		return "default"
	}
	return string(contents)
}

func GetAllClusters() (map[string]*Cluster, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := ctrlconf.GetConfig()
	if err != nil {
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	namespace := GetApplicationNamespace()

	labelSelector := metav1.LabelSelector{MatchLabels: map[string]string{
		KubeWallClusterLabel: "true",
	}}
	secrets, err := clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labels.Set(labelSelector.MatchLabels).String(),
	})
	if err != nil {
		return nil, err
	}

	if secrets != nil && len(secrets.Items) == 0 {
		return nil, fmt.Errorf("kubewall cluster secrets not found")
	}

	clusters := make(map[string]*Cluster)
	for _, secret := range secrets.Items {
		if secret.Data != nil {
			if server, ok := secret.Data["server"]; ok {
				if name, ok := secret.Data["name"]; ok {
					if config, ok := secret.Data["config"]; ok {
						var clusterConfig SecretClusterConfig
						err = json.Unmarshal(config, &clusterConfig)
						if err != nil {
							continue
						}
						restConfig := clusterConfig.toRestConfig(string(server))
						clusterConfig.addTLSConfigurationsInto(restConfig)

						kubeConfig, err := loadClientConfig(restConfig)
						if err != nil {
							log.Warn("failed to load clientConfig for cluster", "err", err)
							continue
						}
						cfg := &Cluster{
							Name:                     string(name),
							Namespace:                "default",
							AuthInfo:                 string(name),
							RestConfig:               restConfig,
							ClientSet:                kubeConfig.ClientSet,
							DynamicClient:            kubeConfig.DynamicClient,
							DiscoveryClient:          kubeConfig.DiscoveryClient,
							SharedInformerFactory:    kubeConfig.SharedInformerFactory,
							ExtensionInformerFactory: kubeConfig.ExtensionInformerFactory,
							DynamicInformerFactory:   kubeConfig.DynamicInformerFactory,
							MetricClient:             kubeConfig.MetricClient,
						}
						clusters[string(name)] = cfg
					}
				}
			}
		}
	}

	return clusters, nil
}

func LoadK8ConfigFromFile(path string) (map[string]*Cluster, error) {
	cmdConfig, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig from file: %v", err)
	}

	// save from nil map
	clusters := make(map[string]*Cluster)

	for key, cluster := range cmdConfig.Contexts {
		rc, err := restConfig(path, key)
		if err != nil {
			log.Warn("failed to load restConfig for cluster", "err", err)
			// here we will ignore any invalid context and continue for next
			continue
		}

		kubeConfig, err := loadClientConfig(rc)
		if err != nil {
			log.Warn("failed to load clientConfig for cluster", "err", err)
			// here we will ignore any invalid context and continue for next
			continue
		}

		cfg := &Cluster{
			Name:                     key,
			Namespace:                cluster.Namespace,
			AuthInfo:                 cluster.AuthInfo,
			RestConfig:               kubeConfig.RestConfig,
			ClientSet:                kubeConfig.ClientSet,
			DynamicClient:            kubeConfig.DynamicClient,
			DiscoveryClient:          kubeConfig.DiscoveryClient,
			SharedInformerFactory:    kubeConfig.SharedInformerFactory,
			ExtensionInformerFactory: kubeConfig.ExtensionInformerFactory,
			DynamicInformerFactory:   kubeConfig.DynamicInformerFactory,
			MetricClient:             kubeConfig.MetricClient,
		}

		clusters[key] = cfg
	}

	return clusters, nil
}

func restConfig(path string, contextName string) (*rest.Config, error) {
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: path}
	overrides := &clientcmd.ConfigOverrides{CurrentContext: contextName}
	cc := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, overrides)

	restConfig, err := cc.ClientConfig()
	if err != nil {
		log.Error("failed to Kubernetes ClientConfig", "err", err)
		return nil, fmt.Errorf("failed to create kubernetes ClientConfig: %w", err)
	}
	restConfig.ContentType = runtime.ContentTypeProtobuf
	restConfig.AcceptContentTypes = fmt.Sprintf("%s,%s", runtime.ContentTypeProtobuf, runtime.ContentTypeJSON)
	restConfig.QPS = float32(K8SQPS)
	restConfig.Burst = K8SBURST
	if restConfig.BearerToken != "" && isTLSClientConfigEmpty(restConfig) {
		restConfig.Insecure = true
	}

	return restConfig, nil
}

func isTLSClientConfigEmpty(restConfig *rest.Config) bool {
	tlsConfig := restConfig.TLSClientConfig
	return tlsConfig.CertFile == "" && tlsConfig.KeyFile == "" && tlsConfig.CAFile == "" &&
		tlsConfig.CertData == nil && tlsConfig.KeyData == nil && tlsConfig.CAData == nil
}

func loadClientConfig(restConfig *rest.Config) (*Cluster, error) {
	if restConfig == nil {
		return nil, fmt.Errorf("restConfig is nil")
	}
	clientSet, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	sharedInformerFactory := informers.NewSharedInformerFactory(clientSet, 0)

	clientset, err := apiextensionsclientset.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes apiextensionsClientset: %w", err)
	}
	externalInformer := apiextensionsinformers.NewSharedInformerFactory(clientset, 0)

	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes dynamicClient: %w", err)
	}
	dynamicInformer := dynamicinformer.NewDynamicSharedInformerFactory(dynamicClient, 0)

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes DiscoveryClient: %w", err)
	}

	metricClient, err := metricsclient.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes metricClientSet: %w", err)
	}

	return &Cluster{
		RestConfig:               restConfig,
		ClientSet:                clientSet,
		DynamicClient:            dynamicClient,
		DiscoveryClient:          discoveryClient,
		SharedInformerFactory:    sharedInformerFactory,
		ExtensionInformerFactory: externalInformer,
		DynamicInformerFactory:   dynamicInformer,
		MetricClient:             metricClient,
	}, nil
}
