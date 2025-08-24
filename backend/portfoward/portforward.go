package portforward

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

type Forwarder interface {
	ForwardPorts() error
	GetPorts() ([]portforward.ForwardedPort, error)
}

type PortForward struct {
	ID         string `json:"id"`
	Namespace  string `json:"namespace"`
	Pod        string `json:"pod"`
	LocalPort  int    `json:"localPort"`
	RemotePort int    `json:"reportPort"`
	Config     string `json:"-"`
	Cluster    string `json:"-"`
	stopCh     chan struct{}
}

type PortForwardInfo struct {
	ID         string `json:"id"`
	Namespace  string `json:"namespace"`
	Pod        string `json:"pod"`
	LocalPort  int    `json:"localPort"`
	RemotePort int    `json:"reportPort"`
	Config     string `json:"-"`
	Cluster    string `json:"-"`
}

type PortForwarder struct {
	mu sync.RWMutex

	active map[string]map[string]*PortForward
}

func NewPortForwarder() *PortForwarder {
	return &PortForwarder{
		active: make(map[string]map[string]*PortForward),
	}
}

func clusterConfigKey(cluster, config string) string {
	return cluster + "|" + config
}

func (p *PortForwarder) isLocalPortInUse(localPort int) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	for _, inner := range p.active {
		for _, pf := range inner {
			if pf.LocalPort == localPort {
				return true
			}
		}
	}
	return false
}

func (p *PortForwarder) Start(cfg *rest.Config, clientset kubernetes.Interface, configName, clusterName string, namespace, pod string, localPort, remotePort int) (string, int, error) {
	if namespace == "" || pod == "" || remotePort <= 0 {
		return "", 0, fmt.Errorf("invalid parameters: namespace, pod, and remotePort are required")
	}

	if localPort != 0 {
		if p.isLocalPortInUse(localPort) {
			return "", 0, fmt.Errorf("local port %d is already in use", localPort)
		}

		addr := fmt.Sprintf(":%d", localPort)
		listener, err := net.Listen("tcp", addr)
		if err != nil {
			return "", 0, fmt.Errorf("local port %d is not available: %w", localPort, err)
		}
		listener.Close()
	}

	req := clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(pod).
		SubResource("portforward")

	transport, upgrader, err := spdy.RoundTripperFor(cfg)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create SPDY round tripper: %w", err)
	}

	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, "POST", req.URL())

	stopCh := make(chan struct{})
	readyCh := make(chan struct{})

	fw, err := portforward.New(dialer, []string{fmt.Sprintf("%d:%d", localPort, remotePort)}, stopCh, readyCh, os.Stdout, os.Stderr)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create port forwarder: %w", err)
	}

	go func() {
		if err := fw.ForwardPorts(); err != nil {
			log.Printf("Port forward error for %s/%s: %v", namespace, pod, err)
		}
	}()

	select {
	case <-readyCh:
	case <-time.After(10 * time.Second):
		close(stopCh)
		return "", 0, fmt.Errorf("timeout waiting for port forward to be ready")
	}

	ports, err := fw.GetPorts()
	if err != nil || len(ports) == 0 {
		close(stopCh)
		if err == nil {
			err = fmt.Errorf("no ports forwarded")
		}
		return "", 0, fmt.Errorf("failed to get forwarded ports: %w", err)
	}
	actualLocal := int(ports[0].Local)

	id := uuid.New().String()

	p.mu.Lock()
	defer p.mu.Unlock()
	key := clusterConfigKey(clusterName, configName)
	if p.active[key] == nil {
		p.active[key] = make(map[string]*PortForward)
	}
	p.active[key][id] = &PortForward{
		ID:         id,
		Namespace:  namespace,
		Pod:        pod,
		LocalPort:  actualLocal,
		RemotePort: remotePort,
		Config:     configName,
		Cluster:    clusterName,
		stopCh:     stopCh,
	}

	return id, actualLocal, nil
}

func (p *PortForwarder) List(cfg *rest.Config, clientset kubernetes.Interface, queryConfig, queryCluster string) []PortForwardInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	list := make([]PortForwardInfo, 0)
	key := clusterConfigKey(queryCluster, queryConfig)
	inner, ok := p.active[key]
	if !ok {
		return list
	}

	for _, pf := range inner {
		list = append(list, PortForwardInfo{
			ID:         pf.ID,
			Namespace:  pf.Namespace,
			Pod:        pf.Pod,
			LocalPort:  pf.LocalPort,
			RemotePort: pf.RemotePort,
			Config:     pf.Config,
			Cluster:    pf.Cluster,
		})
	}
	return list
}

func (p *PortForwarder) Stop(configName, clusterName string, cfg *rest.Config, clientset kubernetes.Interface, id string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	key := clusterConfigKey(clusterName, configName)
	inner, ok := p.active[key]
	if !ok {
		return fmt.Errorf("port forward for cluster=%s config=%s not found", clusterName, configName)
	}

	pf, exists := inner[id]
	if !exists {
		return fmt.Errorf("port forward with ID %s not found in cluster=%s config=%s", id, clusterName, configName)
	}

	close(pf.stopCh)
	delete(inner, id)

	if len(inner) == 0 {
		delete(p.active, key)
	}
	return nil
}
