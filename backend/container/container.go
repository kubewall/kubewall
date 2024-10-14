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
	return c.env
}

func (c *container) Config() *config.AppConfig {
	return c.config
}

func (c *container) Cache() otter.Cache[string, any] {
	return c.cache
}

func (c *container) SSE() *sse.Server {
	return c.sseServer
}

func (c *container) EventProcessor() *event.EventProcessor {
	return c.eventProcessor
}

func (c *container) RestConfig(config, cluster string) *rest.Config {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.RestConfig
}

func (c *container) ClientSet(config, cluster string) *kubernetes.Clientset {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.ClientSet
}

func (c *container) DynamicClient(config, cluster string) *dynamic.DynamicClient {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.DynamicClient
}

func (c *container) DiscoveryClient(config, cluster string) *discovery.DiscoveryClient {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.DiscoveryClient
}

func (c *container) MetricClient(config, cluster string) *metricsclient.Clientset {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.MetricClient
}

func (c *container) SharedInformerFactory(config, cluster string) informers.SharedInformerFactory {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.SharedInformerFactory
}

func (c *container) ExtensionSharedFactoryInformer(config, cluster string) apiextensionsinformers.SharedInformerFactory {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.ExtensionInformerFactory
}

func (c *container) DynamicSharedInformerFactory(config, cluster string) dynamicinformer.DynamicSharedInformerFactory {
	cfg := c.config.KubeConfig[config].Clusters[cluster]
	return cfg.DynamicInformerFactory
}

func (c *container) SocketUpgrader() *websocket.Upgrader {
	return c.socketUpgrader
}
