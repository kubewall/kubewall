package api

import (
	"context"
	"io"
	"net/http"
	"time"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// KubeConfigHandler handles kubeconfig-related API requests
type KubeConfigHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
}

// NewKubeConfigHandler creates a new kubeconfig handler
func NewKubeConfigHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *KubeConfigHandler {
	return &KubeConfigHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
	}
}

// GetConfigs returns all kubeconfigs
func (h *KubeConfigHandler) GetConfigs(c *gin.Context) {
	response := h.store.GetClustersResponse()
	c.JSON(http.StatusOK, response)
}

// AddKubeconfig handles kubeconfig file upload
func (h *KubeConfigHandler) AddKubeconfig(c *gin.Context) {
	var content []byte
	var filename string

	// First, try to get the file content as text from FormData
	if fileContent := c.PostForm("file"); fileContent != "" {
		// Frontend sent the file content as text
		content = []byte(fileContent)
		// Try to get the filename from form data
		if formFilename := c.PostForm("filename"); formFilename != "" {
			filename = formFilename
		} else {
			filename = "kubeconfig.yaml" // Default filename
		}
	} else {
		// Try to get actual file upload
		file, err := c.FormFile("kubeconfig")
		if err != nil {
			file, err = c.FormFile("file")
			if err != nil {
				h.logger.WithError(err).Error("Failed to get kubeconfig file")
				c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get kubeconfig file"})
				return
			}
		}

		fileContent, err := file.Open()
		if err != nil {
			h.logger.WithError(err).Error("Failed to read file")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
			return
		}
		defer fileContent.Close()

		content, err = io.ReadAll(fileContent)
		if err != nil {
			h.logger.WithError(err).Error("Failed to read file content")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file content"})
			return
		}
		filename = file.Filename
	}

	config, err := clientcmd.Load(content)
	if err != nil {
		h.logger.WithError(err).Error("Invalid kubeconfig format")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid kubeconfig format"})
		return
	}

	configID, err := h.store.AddKubeConfig(config, filename)
	if err != nil {
		h.logger.WithError(err).Error("Failed to add kubeconfig")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.WithField("config_id", configID).Info("Kubeconfig added successfully")
	c.JSON(http.StatusOK, gin.H{
		"message": "Kubeconfig added successfully",
		"id":      configID,
	})
}

// AddBearerKubeconfig handles bearer token kubeconfig creation
func (h *KubeConfigHandler) AddBearerKubeconfig(c *gin.Context) {
	// Get form data
	name := c.PostForm("name")
	url := c.PostForm("serverIP") // Frontend sends as serverIP
	token := c.PostForm("token")
	cluster := c.PostForm("cluster")

	// Validate required fields
	if name == "" || url == "" || token == "" {
		h.logger.Error("Missing required fields for bearer token kubeconfig")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: name, serverIP, and token are required"})
		return
	}

	// Use name as cluster name if not provided
	if cluster == "" {
		cluster = name
	}

	config := api.NewConfig()
	clusterConfig := api.NewCluster()
	clusterConfig.Server = url
	clusterConfig.InsecureSkipTLSVerify = true

	authInfo := api.NewAuthInfo()
	authInfo.Token = token

	kubeContext := api.NewContext()
	kubeContext.Cluster = cluster
	kubeContext.AuthInfo = cluster

	config.Clusters[cluster] = clusterConfig
	config.AuthInfos[cluster] = authInfo
	config.Contexts[cluster] = kubeContext
	config.CurrentContext = cluster

	configID, err := h.store.AddKubeConfig(config, name)
	if err != nil {
		h.logger.WithError(err).Error("Failed to add bearer kubeconfig")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.WithField("config_id", configID).Info("Bearer kubeconfig added successfully")
	c.JSON(http.StatusOK, gin.H{
		"message": "Bearer kubeconfig added successfully",
		"id":      configID,
	})
}

// AddCertificateKubeconfig handles certificate-based kubeconfig creation
func (h *KubeConfigHandler) AddCertificateKubeconfig(c *gin.Context) {
	// Get form data
	name := c.PostForm("name")
	url := c.PostForm("serverIP")               // Frontend sends as serverIP
	certificate := c.PostForm("clientCertData") // Frontend sends as clientCertData
	key := c.PostForm("clientKeyData")          // Frontend sends as clientKeyData
	cluster := c.PostForm("cluster")
	ca := c.PostForm("ca")

	// Validate required fields
	if name == "" || url == "" || certificate == "" || key == "" {
		h.logger.Error("Missing required fields for certificate kubeconfig")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: name, serverIP, clientCertData, and clientKeyData are required"})
		return
	}

	// Use name as cluster name if not provided
	if cluster == "" {
		cluster = name
	}

	config := api.NewConfig()
	clusterConfig := api.NewCluster()
	clusterConfig.Server = url

	if ca != "" {
		clusterConfig.CertificateAuthorityData = []byte(ca)
	} else {
		clusterConfig.InsecureSkipTLSVerify = true
	}

	authInfo := api.NewAuthInfo()
	authInfo.ClientCertificateData = []byte(certificate)
	authInfo.ClientKeyData = []byte(key)

	kubeContext := api.NewContext()
	kubeContext.Cluster = cluster
	kubeContext.AuthInfo = cluster

	config.Clusters[cluster] = clusterConfig
	config.AuthInfos[cluster] = authInfo
	config.Contexts[cluster] = kubeContext
	config.CurrentContext = cluster

	configID, err := h.store.AddKubeConfig(config, name)
	if err != nil {
		h.logger.WithError(err).Error("Failed to add certificate kubeconfig")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.WithField("config_id", configID).Info("Certificate kubeconfig added successfully")
	c.JSON(http.StatusOK, gin.H{
		"message": "Certificate kubeconfig added successfully",
		"id":      configID,
	})
}

// DeleteKubeconfig removes a kubeconfig
func (h *KubeConfigHandler) DeleteKubeconfig(c *gin.Context) {
	configID := c.Param("id")

	if err := h.store.DeleteKubeConfig(configID); err != nil {
		h.logger.WithError(err).WithField("config_id", configID).Error("Failed to delete kubeconfig")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Clear cached clients for this config
	h.clientFactory.ClearClients()

	h.logger.WithField("config_id", configID).Info("Kubeconfig deleted successfully")
	c.JSON(http.StatusOK, gin.H{"message": "Kubeconfig deleted successfully"})
}

// ValidateKubeconfig handles kubeconfig validation and connectivity testing
func (h *KubeConfigHandler) ValidateKubeconfig(c *gin.Context) {
	var content []byte
	var filename string

	// First, try to get the file content as text from FormData
	if fileContent := c.PostForm("file"); fileContent != "" {
		// Frontend sent the file content as text
		content = []byte(fileContent)
		// Try to get the filename from form data
		if formFilename := c.PostForm("filename"); formFilename != "" {
			filename = formFilename
		} else {
			filename = "kubeconfig.yaml" // Default filename
		}
	} else {
		// Try to get actual file upload
		file, err := c.FormFile("kubeconfig")
		if err != nil {
			file, err = c.FormFile("file")
			if err != nil {
				h.logger.WithError(err).Error("Failed to get kubeconfig file")
				c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get kubeconfig file"})
				return
			}
		}

		fileContent, err := file.Open()
		if err != nil {
			h.logger.WithError(err).Error("Failed to read file")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
			return
		}
		defer fileContent.Close()

		content, err = io.ReadAll(fileContent)
		if err != nil {
			h.logger.WithError(err).Error("Failed to read file content")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file content"})
			return
		}
		filename = file.Filename
	}

	// Validate kubeconfig format
	config, err := clientcmd.Load(content)
	if err != nil {
		h.logger.WithError(err).Error("Invalid kubeconfig format")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid kubeconfig format",
			"details": err.Error(),
		})
		return
	}

	// Test connectivity for each cluster
	clusterStatus := make(map[string]map[string]interface{})

	for contextName, kubeContext := range config.Contexts {
		clusterName := kubeContext.Cluster

		// Create a copy of the config and set the context
		configCopy := config.DeepCopy()
		configCopy.CurrentContext = contextName

		// Create client config
		clientConfig := clientcmd.NewDefaultClientConfig(*configCopy, &clientcmd.ConfigOverrides{})
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			clusterStatus[contextName] = map[string]interface{}{
				"name":      contextName,
				"cluster":   clusterName,
				"reachable": false,
				"error":     "Failed to create client config: " + err.Error(),
			}
			continue
		}

		// Create Kubernetes client
		client, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			clusterStatus[contextName] = map[string]interface{}{
				"name":      contextName,
				"cluster":   clusterName,
				"reachable": false,
				"error":     "Failed to create Kubernetes client: " + err.Error(),
			}
			continue
		}

		// Test connectivity with a timeout
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_, err = client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
		if err != nil {
			clusterStatus[contextName] = map[string]interface{}{
				"name":      contextName,
				"cluster":   clusterName,
				"reachable": false,
				"error":     "Cluster not reachable: " + err.Error(),
			}
		} else {
			clusterStatus[contextName] = map[string]interface{}{
				"name":      contextName,
				"cluster":   clusterName,
				"reachable": true,
				"error":     nil,
			}
		}
	}

	// Check if any clusters are reachable
	hasReachableClusters := false
	for _, status := range clusterStatus {
		if status["reachable"].(bool) {
			hasReachableClusters = true
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":                true,
		"filename":             filename,
		"clusterStatus":        clusterStatus,
		"hasReachableClusters": hasReachableClusters,
		"totalClusters":        len(clusterStatus),
	})
}

// ValidateBearerToken handles bearer token validation and connectivity testing
func (h *KubeConfigHandler) ValidateBearerToken(c *gin.Context) {
	// Get form data
	name := c.PostForm("name")
	url := c.PostForm("serverIP")
	token := c.PostForm("token")
	cluster := c.PostForm("cluster")

	// Validate required fields
	if name == "" || url == "" || token == "" {
		h.logger.Error("Missing required fields for bearer token validation")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Missing required fields",
			"details": "name, serverIP, and token are required",
		})
		return
	}

	// Use name as cluster name if not provided
	if cluster == "" {
		cluster = name
	}

	// Create temporary config for validation
	config := api.NewConfig()
	clusterConfig := api.NewCluster()
	clusterConfig.Server = url
	clusterConfig.InsecureSkipTLSVerify = true

	authInfo := api.NewAuthInfo()
	authInfo.Token = token

	kubeContext := api.NewContext()
	kubeContext.Cluster = cluster
	kubeContext.AuthInfo = cluster

	config.Clusters[cluster] = clusterConfig
	config.AuthInfos[cluster] = authInfo
	config.Contexts[cluster] = kubeContext
	config.CurrentContext = cluster

	// Test connectivity
	clusterStatus := make(map[string]map[string]interface{})

	// Create client config
	clientConfig := clientcmd.NewDefaultClientConfig(*config, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": false,
			"error":     "Failed to create client config: " + err.Error(),
		}
		c.JSON(http.StatusOK, gin.H{
			"valid":                false,
			"clusterStatus":        clusterStatus,
			"hasReachableClusters": false,
			"totalClusters":        1,
		})
		return
	}

	// Create Kubernetes client
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": false,
			"error":     "Failed to create Kubernetes client: " + err.Error(),
		}
		c.JSON(http.StatusOK, gin.H{
			"valid":                false,
			"clusterStatus":        clusterStatus,
			"hasReachableClusters": false,
			"totalClusters":        1,
		})
		return
	}

	// Test connectivity with a timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": false,
			"error":     "Cluster not reachable: " + err.Error(),
		}
	} else {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": true,
			"error":     nil,
		}
	}

	hasReachableClusters := clusterStatus[cluster]["reachable"].(bool)

	c.JSON(http.StatusOK, gin.H{
		"valid":                true,
		"clusterStatus":        clusterStatus,
		"hasReachableClusters": hasReachableClusters,
		"totalClusters":        1,
	})
}

// ValidateCertificate handles certificate validation and connectivity testing
func (h *KubeConfigHandler) ValidateCertificate(c *gin.Context) {
	// Get form data
	name := c.PostForm("name")
	url := c.PostForm("serverIP")
	certificate := c.PostForm("clientCertData")
	key := c.PostForm("clientKeyData")
	cluster := c.PostForm("cluster")
	ca := c.PostForm("ca")

	// Validate required fields
	if name == "" || url == "" || certificate == "" || key == "" {
		h.logger.Error("Missing required fields for certificate validation")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Missing required fields",
			"details": "name, serverIP, clientCertData, and clientKeyData are required",
		})
		return
	}

	// Use name as cluster name if not provided
	if cluster == "" {
		cluster = name
	}

	// Create temporary config for validation
	config := api.NewConfig()
	clusterConfig := api.NewCluster()
	clusterConfig.Server = url

	if ca != "" {
		clusterConfig.CertificateAuthorityData = []byte(ca)
	} else {
		clusterConfig.InsecureSkipTLSVerify = true
	}

	authInfo := api.NewAuthInfo()
	authInfo.ClientCertificateData = []byte(certificate)
	authInfo.ClientKeyData = []byte(key)

	kubeContext := api.NewContext()
	kubeContext.Cluster = cluster
	kubeContext.AuthInfo = cluster

	config.Clusters[cluster] = clusterConfig
	config.AuthInfos[cluster] = authInfo
	config.Contexts[cluster] = kubeContext
	config.CurrentContext = cluster

	// Test connectivity
	clusterStatus := make(map[string]map[string]interface{})

	// Create client config
	clientConfig := clientcmd.NewDefaultClientConfig(*config, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": false,
			"error":     "Failed to create client config: " + err.Error(),
		}
		c.JSON(http.StatusOK, gin.H{
			"valid":                false,
			"clusterStatus":        clusterStatus,
			"hasReachableClusters": false,
			"totalClusters":        1,
		})
		return
	}

	// Create Kubernetes client
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": false,
			"error":     "Failed to create Kubernetes client: " + err.Error(),
		}
		c.JSON(http.StatusOK, gin.H{
			"valid":                false,
			"clusterStatus":        clusterStatus,
			"hasReachableClusters": false,
			"totalClusters":        1,
		})
		return
	}

	// Test connectivity with a timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": false,
			"error":     "Cluster not reachable: " + err.Error(),
		}
	} else {
		clusterStatus[cluster] = map[string]interface{}{
			"name":      cluster,
			"cluster":   cluster,
			"reachable": true,
			"error":     nil,
		}
	}

	hasReachableClusters := clusterStatus[cluster]["reachable"].(bool)

	c.JSON(http.StatusOK, gin.H{
		"valid":                true,
		"clusterStatus":        clusterStatus,
		"hasReachableClusters": hasReachableClusters,
		"totalClusters":        1,
	})
}

// ValidateAllKubeconfigs validates all existing kubeconfigs and returns their current status
func (h *KubeConfigHandler) ValidateAllKubeconfigs(c *gin.Context) {
	// Get all existing kubeconfigs
	allConfigs := h.store.ListKubeConfigs()

	validationResults := make(map[string]interface{})

	for configID, metadata := range allConfigs {
		config, err := h.store.GetKubeConfig(configID)
		if err != nil {
			h.logger.WithError(err).WithField("config_id", configID).Error("Failed to get kubeconfig for validation")
			validationResults[configID] = map[string]interface{}{
				"name":     metadata.Name,
				"valid":    false,
				"error":    "Failed to retrieve kubeconfig",
				"clusters": map[string]interface{}{},
			}
			continue
		}

		// Test connectivity for each cluster in this config
		clusterStatus := make(map[string]map[string]interface{})

		for contextName, kubeContext := range config.Contexts {
			clusterName := kubeContext.Cluster

			// Create a copy of the config and set the context
			configCopy := config.DeepCopy()
			configCopy.CurrentContext = contextName

			// Create client config
			clientConfig := clientcmd.NewDefaultClientConfig(*configCopy, &clientcmd.ConfigOverrides{})
			restConfig, err := clientConfig.ClientConfig()
			if err != nil {
				clusterStatus[contextName] = map[string]interface{}{
					"name":      contextName,
					"cluster":   clusterName,
					"reachable": false,
					"error":     "Failed to create client config: " + err.Error(),
				}
				continue
			}

			// Create Kubernetes client
			client, err := kubernetes.NewForConfig(restConfig)
			if err != nil {
				clusterStatus[contextName] = map[string]interface{}{
					"name":      contextName,
					"cluster":   clusterName,
					"reachable": false,
					"error":     "Failed to create Kubernetes client: " + err.Error(),
				}
				continue
			}

			// Test connectivity with a timeout
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			_, err = client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
			if err != nil {
				clusterStatus[contextName] = map[string]interface{}{
					"name":      contextName,
					"cluster":   clusterName,
					"reachable": false,
					"error":     "Cluster not reachable: " + err.Error(),
				}
			} else {
				clusterStatus[contextName] = map[string]interface{}{
					"name":      contextName,
					"cluster":   clusterName,
					"reachable": true,
					"error":     nil,
				}
			}
		}

		// Check if any clusters are reachable
		hasReachableClusters := false
		for _, status := range clusterStatus {
			if status["reachable"].(bool) {
				hasReachableClusters = true
				break
			}
		}

		validationResults[configID] = map[string]interface{}{
			"name":                 metadata.Name,
			"valid":                true,
			"clusterStatus":        clusterStatus,
			"hasReachableClusters": hasReachableClusters,
			"totalClusters":        len(clusterStatus),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"validationResults": validationResults,
		"totalConfigs":      len(validationResults),
	})
}
