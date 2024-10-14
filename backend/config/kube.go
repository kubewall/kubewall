package config

import (
	"fmt"
	"sync"

	"github.com/charmbracelet/log"
	apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	apiextensionsinformers "k8s.io/apiextensions-apiserver/pkg/client/informers/externalversions"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
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

func LoadK8ConfigFromFile(path string) (map[string]*Cluster, error) {
	cmdConfig, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig from file: %v", err)
	}

	// save from nil map
	clusters := make(map[string]*Cluster)

	for key, cluster := range cmdConfig.Contexts {
		rc, err := restConfig(*cmdConfig, key)
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

func restConfig(config api.Config, key string) (*rest.Config, error) {
	config.CurrentContext = key
	cc := clientcmd.NewDefaultClientConfig(config, &clientcmd.ConfigOverrides{CurrentContext: key})

	restConfig, err := cc.ClientConfig()
	if err != nil {
		log.Error("failed to Kubernetes ClientConfig", "err", err)
		return nil, fmt.Errorf("failed to create kubernetes ClientConfig: %w", err)
	}
	restConfig.ContentType = runtime.ContentTypeProtobuf
	restConfig.QPS = float32(K8SQPS)
	restConfig.Burst = K8SBURST
	if restConfig.BearerToken != "" {
		if isTLSClientConfigEmpty(restConfig) {
			restConfig.Insecure = true
		}
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
