# KubeWall

A Kubernetes dashboard application with a Go backend and React frontend.

## Features

- Kubernetes resource management
- Real-time resource monitoring
- Multi-cluster support
- Modern web interface

## Architecture

The application consists of:
- **Backend**: Go server with Gin framework
- **Frontend**: React application with TypeScript
- **Static File Serving**: The Go backend serves the built React application

## Development

### Using Makefile (Recommended)

The project includes a comprehensive Makefile that simplifies common development tasks:

```bash
# Show all available commands
make help

# Setup development environment
make setup

# Build the entire application
make build

# Run in development mode
make dev

# Run tests
make test-all

# Format code
make fmt-all

# Clean build artifacts
make clean
```

### Manual Development

#### Backend

The Go backend is located in the `cmd/server` directory and serves both the API and the static frontend files.

##### Building the Backend

```bash
cd cmd/server
go build -o ../../kubewall-server
```

##### Running the Backend

```bash
./kubewall-server
```

The server will:
- Start on the configured host and port (default: `0.0.0.0:7080`)
- Serve API endpoints under `/api/v1/`
- Serve static files from `client/dist/` (configurable via `STATIC_FILES_PATH` environment variable)
- Handle SPA routing for the React application

#### Frontend

The React frontend is located in the `client` directory.

##### Building the Frontend

```bash
cd client
npm install
npm run build
```

This will create the `dist` folder with the built application that the Go backend serves.

##### Development Server

For development, you can run the frontend separately:

```bash
cd client
npm run dev
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: `7080`)
- `HOST`: Server host (default: `0.0.0.0`)
- `LOG_LEVEL`: Logging level (default: `info`)
- `K8S_DEFAULT_NAMESPACE`: Default Kubernetes namespace (default: `default`)
- `STATIC_FILES_PATH`: Path to static files (default: `client/dist`)

## Static File Serving

The Go backend automatically serves the React application from the `client/dist` directory. The setup includes:

1. **Static Assets**: All files in `client/dist/assets/` are served under `/assets/`
2. **SPA Routing**: All non-API routes serve the main `index.html` file for client-side routing
3. **API Routes**: All `/api/*` routes are handled by the backend API

### File Structure

```
client/dist/
├── index.html          # Main HTML file
└── assets/
    ├── index-*.js      # Main JavaScript bundle
    ├── index-*.css     # Main CSS bundle
    ├── favicon-*.ico   # Favicon
    └── *.js            # Other JavaScript modules
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1/` - API information
- `GET /api/v1/app/config` - Get Kubernetes configurations
- `POST /api/v1/app/config/kubeconfigs` - Add kubeconfig
- `GET /api/v1/namespaces` - Get namespaces (SSE)
- `GET /api/v1/pods` - Get pods (SSE)
- And many more Kubernetes resource endpoints...

## Deployment

### Using Makefile

```bash
# Build for current platform
make build

# Build for specific platforms
make build-linux
make build-windows
make build-darwin

# Create release builds
make release
make release-linux
make release-windows
make release-darwin
```

### Manual Deployment

1. Build the frontend: `cd client && npm run build`
2. Build the backend: `cd cmd/server && go build -o ../../kubewall-server`
3. Run the server: `./kubewall-server`

The application will be available at `http://localhost:7080` (or your configured host/port).

## Development Workflow

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd kube-dash

# Setup development environment
make setup

# Run in development mode
make dev
```

### Common Commands

```bash
# Development
make dev              # Run in development mode
make build            # Build the application
make test-all         # Run all tests
make lint-all         # Run all linters
make fmt-all          # Format all code

# Cleaning
make clean            # Clean build artifacts
make clean-all        # Clean everything

# Platform-specific builds
make build-linux      # Build for Linux
make build-windows    # Build for Windows
make build-darwin     # Build for macOS

# CI/CD
make ci               # Run CI pipeline (lint + test + build)
make check            # Run all checks (lint + test)
```

### Cross-Platform Building

The Makefile supports building for different platforms:

```bash
# Build for current platform
make build

# Build for specific platforms
make build-linux      # Linux AMD64
make build-windows    # Windows AMD64
make build-darwin     # macOS AMD64

# Create release builds
make release-linux    # Frontend + Linux backend
make release-windows  # Frontend + Windows backend
make release-darwin   # Frontend + macOS backend
```

## Troubleshooting

### Common Issues

1. **Node.js not found**: Install Node.js from [nodejs.org](https://nodejs.org/)
2. **Go not found**: Install Go from [golang.org](https://golang.org/)
3. **Build fails**: Run `make clean-all` and then `make build`
4. **Port already in use**: Change the port using `PORT=8080 make run`

### Getting Help

```bash
# Show all available commands
make help

# Check project status
make status

# Show version information
make version

# Check dependencies
make check-deps
```
