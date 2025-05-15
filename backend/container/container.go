package container

import (
	"net/http"
	"sync"
	"time"

	"github.com/kubewall/kubewall/backend/event"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"

	"github.com/r3labs/sse/v2"

	apiextensionsinformers "k8s.io/apiextensions-apiserver/pkg/client/informers/externalversions"

	"github.com/charmbracelet/log"
	"github.com/gorilla/websocket"
	"github.com/kubewall/kubewall/backend/config"
	"github.com/maypok86/otter"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
)

// Container represents interface for accessing the data which sharing in overall application.
type Container interface {
	Env() *config.Env
	Config() *config.AppConfig
	RestConfig(config, cluster string) *rest.Config
	ClientSet(config, cluster string) *kubernetes.Clientset
	DynamicClient(config, cluster string) *dynamic.DynamicClient
	DiscoveryClient(config, cluster string) *discovery.DiscoveryClient
	MetricClient(config, cluster string) *metricsclient.Clientset
	SharedInformerFactory(config, cluster string) informers.SharedInformerFactory
	ExtensionSharedFactoryInformer(config, cluster string) apiextensionsinformers.SharedInformerFactory
	DynamicSharedInformerFactory(config, cluster string) dynamicinformer.DynamicSharedInformerFactory
	Cache() otter.Cache[string, any]
	SSE() *sse.Server
	SocketUpgrader() *websocket.Upgrader
	EventProcessor() *event.EventProcessor
}

// container struct is for sharing data which such as database setting, the setting of application and logger in overall this application.
type container struct {
	env            *config.Env
	config         *config.AppConfig
	logger         *log.Logger
	configLock     sync.Mutex
	cache          otter.Cache[string, any]
	sseServer      *sse.Server
	eventProcessor *event.EventProcessor
	socketUpgrader *websocket.Upgrader
	mu             sync.Mutex
}

// NewContainer is constructor.
func NewContainer(env *config.Env, cfg *config.AppConfig) Container {
	cache, err := otter.MustBuilder[string, any](10_000).
		WithTTL(time.Hour * 10).
		Build()
	if err != nil {
		panic(err)
	}

	s := sse.New()
	s.AutoStream = true
	s.EventTTL = 2 * time.Second
	s.Headers = map[string]string{
		"X-Accel-Buffering": "no",
		// "Cache-Control":"no-cache"
	}

	e := event.NewEventCounter(time.Millisecond * 250)
	go e.Run()
	return &container{
		env:            env,
		config:         cfg,
		cache:          cache,
		sseServer:      s,
		eventProcessor: e,
		socketUpgrader: &websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (c *container) Env() *config.Env {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.env
}

func (c *container) Config() *config.AppConfig {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.config
}

func (c *container) Cache() otter.Cache[string, any] {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.cache
}

func (c *container) SSE() *sse.Server {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.sseServer
}

func (c *container) EventProcessor() *event.EventProcessor {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.eventProcessor
}

func (c *container) RestConfig(config, cluster string) *rest.Config {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.RestConfig
}

func (c *container) ClientSet(config, cluster string) *kubernetes.Clientset {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetClientSet()
}

func (c *container) DynamicClient(config, cluster string) *dynamic.DynamicClient {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetDynamicClient()
}

func (c *container) DiscoveryClient(config, cluster string) *discovery.DiscoveryClient {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetDiscoveryClient()
}

func (c *container) MetricClient(config, cluster string) *metricsclient.Clientset {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetMetricClient()
}

func (c *container) SharedInformerFactory(config, cluster string) informers.SharedInformerFactory {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetSharedInformerFactory()
}

func (c *container) ExtensionSharedFactoryInformer(config, cluster string) apiextensionsinformers.SharedInformerFactory {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetExtensionInformerFactory()
}

func (c *container) DynamicSharedInformerFactory(config, cluster string) dynamicinformer.DynamicSharedInformerFactory {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.GetDynamicSharedInformerFactory()
}

func (c *container) SocketUpgrader() *websocket.Upgrader {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.socketUpgrader
}
