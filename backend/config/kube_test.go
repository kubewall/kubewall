package config

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
	"os"
	"testing"
)

func TestLoadK8ConfigFromFile(t *testing.T) {
	// Create a temporary file
	tempFile, err := os.CreateTemp("", "example-*.txt")
	if err != nil {
		fmt.Println("Error creating temp file:", err)
		return
	}
	defer os.Remove(tempFile.Name()) // Clean up the file after use
	_, err = tempFile.WriteString(`apiVersion: v1
kind: Config
preferences: {}
clusters:
- cluster:
    certificate-authority-data: Q2c9PQ==
    server: https://127.0.0.1:26443
  name: asdf
contexts:
- context:
    cluster: asdf
    user: asdf
  name: asdf
current-context: asdf
users:
- name: asdf
  user:
    client-certificate-data: Q2c9PQ==
    client-key-data: Q2c9PQ==
`)
	if err != nil {
		fmt.Println("Error writing to temp file:", err)
		return
	}

	// Close the file
	if err := tempFile.Close(); err != nil {
		fmt.Println("Error closing temp file:", err)
		return
	}

	tests := []struct {
		name      string
		filePath  string
		expectErr bool
	}{
		{
			name:      "happy path - valid file",
			filePath:  tempFile.Name(),
			expectErr: false,
		},
		{
			name:      "error path - file not found",
			filePath:  "/Users/selin003/.kube/invalid_path.yaml",
			expectErr: true,
		},
		{
			name:      "error path - invalid kubeconfig file",
			filePath:  "/Users/selin003/.kube/ink.yaml",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := LoadK8ConfigFromFile(tt.filePath)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRestConfig(t *testing.T) {
	tests := []struct {
		name      string
		config    api.Config
		context   string
		expectErr bool
	}{
		{
			name: "error path - invalid config",
			config: api.Config{
				Clusters: map[string]*api.Cluster{"invalid-context": {}},
			},
			context:   "invalid-context",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := restConfig(tt.config, tt.context)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestLoadClientConfig(t *testing.T) {
	tests := []struct {
		name       string
		restConfig *rest.Config
		expectErr  bool
	}{
		{
			name:       "happy path - valid rest config",
			restConfig: &rest.Config{},
			expectErr:  false,
		},
		{
			name:       "error path - nil rest config",
			restConfig: nil,
			expectErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := loadClientConfig(tt.restConfig)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCluster_MarkAsConnected(t *testing.T) {
	type fields struct {
		Name      string
		Connected bool
	}
	tests := []struct {
		name   string
		fields fields
		want   *Cluster
	}{
		{
			name: "should mark connected as true",
			fields: fields{
				Name: "first",
			},
			want: &Cluster{
				Name:      "first",
				Connected: true,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Cluster{
				Name:      tt.fields.Name,
				Connected: tt.fields.Connected,
			}
			assert.Equalf(t, tt.want, c.MarkAsConnected(), "MarkAsConnected()")
		})
	}
}

func Test_isTLSClientConfigEmpty(t *testing.T) {
	type args struct {
		restConfig *rest.Config
	}
	tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "should return false on non empty rest config",
			args: args{
				restConfig: &rest.Config{
					TLSClientConfig: rest.TLSClientConfig{},
				},
			},
			want: true,
		},
		{
			name: "should return false on non empty rest config",
			args: args{
				restConfig: &rest.Config{
					TLSClientConfig: rest.TLSClientConfig{
						CertFile: "CertFile",
						KeyFile:  "KeyFile",
						CAFile:   "CAFile",
						CertData: nil,
						KeyData:  nil,
						CAData:   nil,
					},
				},
			},
			want: false,
		},
		{
			name: "should return false on non empty rest config",
			args: args{
				restConfig: &rest.Config{
					TLSClientConfig: rest.TLSClientConfig{
						CertFile: "CertFile",
						KeyFile:  "",
						CAFile:   "",
						CertData: nil,
						KeyData:  nil,
						CAData:   nil,
					},
				},
			},
			want: false,
		},
		{
			name: "should return false on non empty rest config",
			args: args{
				restConfig: &rest.Config{
					TLSClientConfig: rest.TLSClientConfig{
						CertFile: "",
						KeyFile:  "",
						CAFile:   "",
						CertData: []byte("something"),
						KeyData:  nil,
						CAData:   nil,
					},
				},
			},
			want: false,
		},
		{
			name: "should return false on non empty rest config",
			args: args{
				restConfig: &rest.Config{
					TLSClientConfig: rest.TLSClientConfig{
						CertFile: "",
						KeyFile:  "",
						CAFile:   "",
						CertData: nil,
						KeyData:  []byte("something"),
						CAData:   nil,
					},
				},
			},
			want: false,
		},
		{
			name: "should return false on non empty rest config",
			args: args{
				restConfig: &rest.Config{
					TLSClientConfig: rest.TLSClientConfig{
						CertFile: "",
						KeyFile:  "",
						CAFile:   "",
						CertData: nil,
						KeyData:  nil,
						CAData:   []byte("something"),
					},
				},
			},
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, isTLSClientConfigEmpty(tt.args.restConfig), "isTLSClientConfigEmpty(%v)", tt.args.restConfig)
		})
	}
}
