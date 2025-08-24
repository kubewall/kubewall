<div align="center">
  <img src="https://raw.githubusercontent.com/kubernetes/kubernetes/master/logo/logo.png" alt="Kubernetes" width="100" height="100">
  <h1>🚀 KubeDash</h1>
  <p><strong>Modern Kubernetes Dashboard with Real-time Monitoring</strong></p>
  
  [![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org)
  [![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react)](https://reactjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
  [![Build Status](https://img.shields.io/github/workflow/status/username/kube-dash/CI)](https://github.com/username/kube-dash/actions)
</div>

---

## 📋 Overview

KubeDash is a lightweight, modern Kubernetes dashboard built with Go and React. It provides real-time monitoring and management capabilities for your Kubernetes clusters with an intuitive web interface.

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- Kubernetes cluster access

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd kube-dash

# Setup development environment
make setup

# Build the application
make build

# Run the application
make run
```

The application will be available at `http://localhost:7080`

### Development

```bash
# Run in development mode
make dev

# Run tests
make test-all

# Format code
make fmt-all
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `PORT` | Server port | `7080` |
| `HOST` | Server host | `0.0.0.0` |
| `LOG_LEVEL` | Logging level | `info` |
| `K8S_DEFAULT_NAMESPACE` | Default Kubernetes namespace | `default` |
| `STATIC_FILES_PATH` | Path to static files | `client/dist` |

## 🔌 API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `GET /api/v1/` - API information
- `GET /api/v1/app/config` - Get Kubernetes configurations
- `POST /api/v1/app/config/kubeconfigs` - Add kubeconfig

### Resource Endpoints (Server-Sent Events)
- `GET /api/v1/namespaces` - Get namespaces
- `GET /api/v1/pods` - Get pods
- `GET /api/v1/deployments` - Get deployments
- `GET /api/v1/services` - Get services

## 🚀 Deployment

### Production Build

```bash
# Build for production
make build

# Cross-platform builds
make build-linux    # Linux
make build-windows  # Windows
make build-darwin   # macOS
```

### Docker Deployment

```bash
# Build Docker image
docker build -t kube-dash .

# Run container
docker run -p 7080:7080 kube-dash
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Commands

```bash
make help        # Show all available commands
make test-all    # Run all tests
make lint-all    # Run all linters
make clean       # Clean build artifacts
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Made with ❤️ for the Kubernetes community</p>
</div>
