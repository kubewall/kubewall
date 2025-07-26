# KubeWall Makefile
# A comprehensive build system for the KubeWall project

# Variables
BINARY_NAME=kubewall-server
BUILD_DIR=.
CLIENT_DIR=client
SERVER_DIR=cmd/server
DIST_DIR=$(CLIENT_DIR)/dist

# Go variables
GO=go
GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)
GO_VERSION=$(shell go version | awk '{print $$3}')

# Node.js variables
NODE_VERSION=$(shell node --version 2>/dev/null || echo "Node.js not found")
NPM_VERSION=$(shell npm --version 2>/dev/null || echo "npm not found")

# Build variables
VERSION?=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
GIT_COMMIT=$(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME) -X main.GitCommit=$(GIT_COMMIT)"

# Colors for output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
BLUE=\033[0;34m
PURPLE=\033[0;35m
CYAN=\033[0;36m
NC=\033[0m # No Color

# Default target
.DEFAULT_GOAL := help

# Help target
.PHONY: help
help: ## Show this help message
	@echo "$(CYAN)KubeWall - Kubernetes Dashboard$(NC)"
	@echo "$(CYAN)================================$(NC)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Environment variables:$(NC)"
	@echo "  VERSION        - Version to build (default: git tag or 'dev')"
	@echo "  GOOS           - Target OS (default: current OS)"
	@echo "  GOARCH         - Target architecture (default: current arch)"
	@echo "  PORT           - Server port (default: 7080)"
	@echo "  HOST           - Server host (default: 0.0.0.0)"
	@echo "  STATIC_FILES_PATH - Path to static files (default: client/dist)"
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make build                    # Build for current platform"
	@echo "  make build-linux              # Build for Linux"
	@echo "  make build-windows            # Build for Windows"
	@echo "  make run                      # Run the server"
	@echo "  make dev                      # Run in development mode"

# Check dependencies
.PHONY: check-deps
check-deps: ## Check if required dependencies are installed
	@echo "$(BLUE)Checking dependencies...$(NC)"
	@echo "$(GREEN)✓$(NC) Go version: $(GO_VERSION)"
	@if [ "$(NODE_VERSION)" = "Node.js not found" ]; then \
		echo "$(RED)✗$(NC) Node.js not found. Please install Node.js"; \
		exit 1; \
	else \
		echo "$(GREEN)✓$(NC) Node.js version: $(NODE_VERSION)"; \
	fi
	@if [ "$(NPM_VERSION)" = "npm not found" ]; then \
		echo "$(RED)✗$(NC) npm not found. Please install npm"; \
		exit 1; \
	else \
		echo "$(GREEN)✓$(NC) npm version: $(NPM_VERSION)"; \
	fi

# Install Go dependencies
.PHONY: deps
deps: ## Install Go dependencies
	@echo "$(BLUE)Installing Go dependencies...$(NC)"
	$(GO) mod download
	$(GO) mod tidy
	@echo "$(GREEN)✓$(NC) Go dependencies installed"

# Install Node.js dependencies
.PHONY: deps-js
deps-js: ## Install Node.js dependencies
	@echo "$(BLUE)Installing Node.js dependencies...$(NC)"
	cd $(CLIENT_DIR) && npm install
	@echo "$(GREEN)✓$(NC) Node.js dependencies installed"

# Install all dependencies
.PHONY: deps-all
deps-all: check-deps deps deps-js ## Install all dependencies

# Build frontend
.PHONY: build-frontend
build-frontend: ## Build the React frontend
	@echo "$(BLUE)Building frontend...$(NC)"
	cd $(CLIENT_DIR) && npm run build
	@echo "$(GREEN)✓$(NC) Frontend built successfully"

# Build backend
.PHONY: build-backend
build-backend: ## Build the Go backend
	@echo "$(BLUE)Building backend...$(NC)"
	cd $(SERVER_DIR) && $(GO) build $(LDFLAGS) -o ../../$(BINARY_NAME)
	@echo "$(GREEN)✓$(NC) Backend built successfully"

# Build everything
.PHONY: build
build: deps-all build-frontend build-backend ## Build both frontend and backend
	@echo "$(GREEN)✓$(NC) Build completed successfully!"
	@echo "$(YELLOW)You can now run the server with: make run$(NC)"

# Build for specific platforms
.PHONY: build-linux
build-linux: ## Build for Linux
	@echo "$(BLUE)Building for Linux...$(NC)"
	GOOS=linux GOARCH=amd64 $(MAKE) build-backend
	@echo "$(GREEN)✓$(NC) Linux build completed"

.PHONY: build-windows
build-windows: ## Build for Windows
	@echo "$(BLUE)Building for Windows...$(NC)"
	GOOS=windows GOARCH=amd64 $(MAKE) build-backend
	@echo "$(GREEN)✓$(NC) Windows build completed"

.PHONY: build-darwin
build-darwin: ## Build for macOS
	@echo "$(BLUE)Building for macOS...$(NC)"
	GOOS=darwin GOARCH=amd64 $(MAKE) build-backend
	@echo "$(GREEN)✓$(NC) macOS build completed"

# Run the application
.PHONY: run
run: ## Run the server
	@echo "$(BLUE)Starting KubeWall server...$(NC)"
	@echo "$(YELLOW)The application will be available at: http://localhost:7080$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop the server$(NC)"
	./$(BINARY_NAME)

# Run in development mode
.PHONY: dev
dev: ## Run in development mode (builds if needed)
	@if [ ! -f "$(BINARY_NAME)" ]; then \
		echo "$(YELLOW)Binary not found. Building first...$(NC)"; \
		$(MAKE) build; \
	fi
	@if [ ! -d "$(DIST_DIR)" ]; then \
		echo "$(YELLOW)Frontend not built. Building first...$(NC)"; \
		$(MAKE) build-frontend; \
	fi
	@echo "$(BLUE)Starting KubeWall in development mode...$(NC)"
	@echo "$(YELLOW)The application will be available at: http://localhost:7080$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop the server$(NC)"
	./$(BINARY_NAME)

# Test targets
.PHONY: test
test: ## Run Go tests
	@echo "$(BLUE)Running Go tests...$(NC)"
	$(GO) test ./...
	@echo "$(GREEN)✓$(NC) Tests completed"

.PHONY: test-js
test-js: ## Run JavaScript tests
	@echo "$(BLUE)Running JavaScript tests...$(NC)"
	cd $(CLIENT_DIR) && npm test
	@echo "$(GREEN)✓$(NC) JavaScript tests completed"

.PHONY: test-all
test-all: test test-js ## Run all tests

# Lint targets
.PHONY: lint
lint: ## Run Go linter
	@echo "$(BLUE)Running Go linter...$(NC)"
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run; \
	else \
		echo "$(YELLOW)golangci-lint not found. Skipping Go linting.$(NC)"; \
	fi

.PHONY: lint-js
lint-js: ## Run JavaScript linter
	@echo "$(BLUE)Running JavaScript linter...$(NC)"
	cd $(CLIENT_DIR) && npm run lint
	@echo "$(GREEN)✓$(NC) JavaScript linting completed"

.PHONY: lint-all
lint-all: lint lint-js ## Run all linters

# Format targets
.PHONY: fmt
fmt: ## Format Go code
	@echo "$(BLUE)Formatting Go code...$(NC)"
	$(GO) fmt ./...
	@echo "$(GREEN)✓$(NC) Go code formatted"

.PHONY: fmt-js
fmt-js: ## Format JavaScript code
	@echo "$(BLUE)Formatting JavaScript code...$(NC)"
	cd $(CLIENT_DIR) && npm run format
	@echo "$(GREEN)✓$(NC) JavaScript code formatted"

.PHONY: fmt-all
fmt-all: fmt fmt-js ## Format all code

# Clean targets
.PHONY: clean
clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -f $(BINARY_NAME)
	rm -f $(BINARY_NAME).exe
	@echo "$(GREEN)✓$(NC) Build artifacts cleaned"

.PHONY: clean-frontend
clean-frontend: ## Clean frontend build artifacts
	@echo "$(BLUE)Cleaning frontend build artifacts...$(NC)"
	rm -rf $(DIST_DIR)
	@echo "$(GREEN)✓$(NC) Frontend build artifacts cleaned"

.PHONY: clean-deps
clean-deps: ## Clean dependency caches
	@echo "$(BLUE)Cleaning dependency caches...$(NC)"
	$(GO) clean -cache -modcache
	cd $(CLIENT_DIR) && rm -rf node_modules
	@echo "$(GREEN)✓$(NC) Dependency caches cleaned"

.PHONY: clean-all
clean-all: clean clean-frontend clean-deps ## Clean everything

# Docker targets
.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t kubewall:latest .
	@echo "$(GREEN)✓$(NC) Docker image built"

.PHONY: docker-run
docker-run: ## Run Docker container
	@echo "$(BLUE)Running Docker container...$(NC)"
	docker run -p 7080:7080 kubewall:latest

# Release targets
.PHONY: release
release: ## Create a release build
	@echo "$(BLUE)Creating release build...$(NC)"
	$(MAKE) build
	@echo "$(GREEN)✓$(NC) Release build created"

.PHONY: release-linux
release-linux: ## Create Linux release
	@echo "$(BLUE)Creating Linux release...$(NC)"
	$(MAKE) build-frontend
	$(MAKE) build-linux
	@echo "$(GREEN)✓$(NC) Linux release created"

.PHONY: release-windows
release-windows: ## Create Windows release
	@echo "$(BLUE)Creating Windows release...$(NC)"
	$(MAKE) build-frontend
	$(MAKE) build-windows
	@echo "$(GREEN)✓$(NC) Windows release created"

.PHONY: release-darwin
release-darwin: ## Create macOS release
	@echo "$(BLUE)Creating macOS release...$(NC)"
	$(MAKE) build-frontend
	$(MAKE) build-darwin
	@echo "$(GREEN)✓$(NC) macOS release created"

# Development workflow
.PHONY: setup
setup: deps-all ## Setup development environment
	@echo "$(GREEN)✓$(NC) Development environment setup complete"

.PHONY: check
check: lint-all test-all ## Run all checks (lint + test)
	@echo "$(GREEN)✓$(NC) All checks passed"

.PHONY: ci
ci: check build ## Run CI pipeline (check + build)
	@echo "$(GREEN)✓$(NC) CI pipeline completed successfully"

# Utility targets
.PHONY: version
version: ## Show version information
	@echo "$(CYAN)KubeWall Version Information$(NC)"
	@echo "Version: $(VERSION)"
	@echo "Build Time: $(BUILD_TIME)"
	@echo "Git Commit: $(GIT_COMMIT)"
	@echo "Go Version: $(GO_VERSION)"
	@echo "Target OS: $(GOOS)"
	@echo "Target Arch: $(GOARCH)"

.PHONY: status
status: ## Show project status
	@echo "$(CYAN)Project Status$(NC)"
	@echo "Binary exists: $(shell if [ -f "$(BINARY_NAME)" ]; then echo "✓"; else echo "✗"; fi)"
	@echo "Frontend built: $(shell if [ -d "$(DIST_DIR)" ]; then echo "✓"; else echo "✗"; fi)"
	@echo "Go modules: $(shell if [ -f "go.mod" ]; then echo "✓"; else echo "✗"; fi)"
	@echo "Node modules: $(shell if [ -d "$(CLIENT_DIR)/node_modules" ]; then echo "✓"; else echo "✗"; fi)"

# Install development tools
.PHONY: install-tools
install-tools: ## Install development tools
	@echo "$(BLUE)Installing development tools...$(NC)"
	@if ! command -v golangci-lint >/dev/null 2>&1; then \
		echo "Installing golangci-lint..."; \
		go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; \
	fi
	@echo "$(GREEN)✓$(NC) Development tools installed" 