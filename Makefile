# Makefile for kubewall local development
# Based on .goreleaser.yaml configuration

.PHONY: help build build-frontend build-backend run clean test lint install-deps dev docker-build

# Variables
PROJECT_NAME := kubewall
BINARY_NAME := kubewall
BACKEND_DIR := ./backend
CLIENT_DIR := ./client
STATIC_DIR := $(BACKEND_DIR)/routes/static
BUILD_DIR := ./dist
VERSION ?= dev
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Go build flags (matching .goreleaser.yaml)
GO_FLAGS := -trimpath
GO_LDFLAGS := -s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT)
GO_ENV := CGO_ENABLED=0

# Detect OS and ARCH for local builds
GOOS := $(shell go env GOOS)
GOARCH := $(shell go env GOARCH)

# Colors for output
COLOR_RESET := \033[0m
COLOR_BOLD := \033[1m
COLOR_GREEN := \033[32m
COLOR_YELLOW := \033[33m
COLOR_BLUE := \033[34m

##@ General

help: ## Display this help message
	@echo "$(COLOR_BOLD)$(PROJECT_NAME) - Local Development Makefile$(COLOR_RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(COLOR_BLUE)<target>$(COLOR_RESET)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(COLOR_BLUE)%-15s$(COLOR_RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(COLOR_BOLD)%s$(COLOR_RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install-deps: ## Install frontend and backend dependencies
	@echo "$(COLOR_GREEN)Installing frontend dependencies...$(COLOR_RESET)"
	cd $(CLIENT_DIR) && yarn install
	@echo "$(COLOR_GREEN)Installing backend dependencies...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && go mod download

build-frontend: ## Build the frontend application
	@echo "$(COLOR_GREEN)Building frontend...$(COLOR_RESET)"
	cd $(CLIENT_DIR) && yarn install && yarn run build
	@echo "$(COLOR_GREEN)Moving frontend build to backend static directory...$(COLOR_RESET)"
	rm -rf $(STATIC_DIR)
	mv $(CLIENT_DIR)/dist $(STATIC_DIR)
	@echo "$(COLOR_GREEN)Frontend build complete!$(COLOR_RESET)"

build-backend: ## Build the backend binary for current OS/ARCH
	@echo "$(COLOR_GREEN)Building backend for $(GOOS)/$(GOARCH)...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && $(GO_ENV) go build $(GO_FLAGS) -ldflags "$(GO_LDFLAGS)" -o ../$(BUILD_DIR)/$(BINARY_NAME) main.go
	@echo "$(COLOR_GREEN)Backend build complete: $(BUILD_DIR)/$(BINARY_NAME)$(COLOR_RESET)"

build: build-frontend build-backend ## Build both frontend and backend (full build)
	@echo "$(COLOR_GREEN)$(COLOR_BOLD)Full build complete!$(COLOR_RESET)"

build-all-platforms: build-frontend ## Build binaries for all platforms (like goreleaser)
	@echo "$(COLOR_GREEN)Building for all platforms...$(COLOR_RESET)"
	@mkdir -p $(BUILD_DIR)
	@for os in linux darwin windows freebsd; do \
		for arch in 386 amd64 arm64; do \
			output="$(BUILD_DIR)/$(BINARY_NAME)-$${os}-$${arch}"; \
			if [ "$$os" = "windows" ]; then output="$${output}.exe"; fi; \
			echo "$(COLOR_YELLOW)Building $${os}/$${arch}...$(COLOR_RESET)"; \
			cd $(BACKEND_DIR) && GOOS=$$os GOARCH=$$arch $(GO_ENV) go build $(GO_FLAGS) -ldflags "$(GO_LDFLAGS)" -o ../$${output} main.go || true; \
		done; \
	done
	@echo "$(COLOR_GREEN)Multi-platform build complete!$(COLOR_RESET)"

run: ## Run the application locally (builds if needed)
	@if [ ! -f "$(BUILD_DIR)/$(BINARY_NAME)" ]; then \
		echo "$(COLOR_YELLOW)Binary not found, building...$(COLOR_RESET)"; \
		$(MAKE) build; \
	fi
	@echo "$(COLOR_GREEN)Starting $(BINARY_NAME)...$(COLOR_RESET)"
	./$(BUILD_DIR)/$(BINARY_NAME)

dev: ## Development mode - build and run with auto-reload (requires air or similar)
	@if command -v air > /dev/null; then \
		echo "$(COLOR_GREEN)Starting development server with air...$(COLOR_RESET)"; \
		cd $(BACKEND_DIR) && air; \
	else \
		echo "$(COLOR_YELLOW)air not found. Install it with: go install github.com/cosmtrek/air@latest$(COLOR_RESET)"; \
		echo "$(COLOR_YELLOW)Falling back to regular run...$(COLOR_RESET)"; \
		$(MAKE) run; \
	fi

dev-frontend: ## Run frontend development server
	@echo "$(COLOR_GREEN)Starting frontend development server...$(COLOR_RESET)"
	cd $(CLIENT_DIR) && yarn run dev

dev-backend: ## Run backend in development mode
	@echo "$(COLOR_GREEN)Starting backend development server...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && go run main.go

##@ Testing & Quality

test: ## Run backend tests
	@echo "$(COLOR_GREEN)Running tests...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && go test -v ./...

test-coverage: ## Run tests with coverage report
	@echo "$(COLOR_GREEN)Running tests with coverage...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && go test -v -coverprofile=coverage.out ./...
	cd $(BACKEND_DIR) && go tool cover -html=coverage.out -o coverage.html
	@echo "$(COLOR_GREEN)Coverage report generated: $(BACKEND_DIR)/coverage.html$(COLOR_RESET)"

lint: ## Run linters (requires golangci-lint)
	@if command -v golangci-lint > /dev/null; then \
		echo "$(COLOR_GREEN)Running golangci-lint...$(COLOR_RESET)"; \
		cd $(BACKEND_DIR) && golangci-lint run; \
	else \
		echo "$(COLOR_YELLOW)golangci-lint not found. Install it from: https://golangci-lint.run/usage/install/$(COLOR_RESET)"; \
	fi

fmt: ## Format Go code
	@echo "$(COLOR_GREEN)Formatting Go code...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && go fmt ./...

vet: ## Run go vet
	@echo "$(COLOR_GREEN)Running go vet...$(COLOR_RESET)"
	cd $(BACKEND_DIR) && go vet ./...

##@ Docker

docker-build: ## Build Docker image locally
	@echo "$(COLOR_GREEN)Building Docker image...$(COLOR_RESET)"
	docker build -f .goreleaser.Dockerfile -t $(PROJECT_NAME):$(VERSION) .

docker-run: docker-build ## Build and run Docker container
	@echo "$(COLOR_GREEN)Running Docker container...$(COLOR_RESET)"
	docker run -p 7080:7080 $(PROJECT_NAME):$(VERSION)

##@ Cleanup

clean: ## Clean build artifacts
	@echo "$(COLOR_GREEN)Cleaning build artifacts...$(COLOR_RESET)"
	rm -rf $(BUILD_DIR)
	rm -rf $(STATIC_DIR)
	rm -rf $(CLIENT_DIR)/dist
	rm -rf $(CLIENT_DIR)/node_modules
	rm -rf $(BACKEND_DIR)/coverage.out
	rm -rf $(BACKEND_DIR)/coverage.html
	@echo "$(COLOR_GREEN)Clean complete!$(COLOR_RESET)"

clean-frontend: ## Clean frontend build artifacts
	@echo "$(COLOR_GREEN)Cleaning frontend artifacts...$(COLOR_RESET)"
	rm -rf $(CLIENT_DIR)/dist
	rm -rf $(CLIENT_DIR)/node_modules
	rm -rf $(STATIC_DIR)

clean-backend: ## Clean backend build artifacts
	@echo "$(COLOR_GREEN)Cleaning backend artifacts...$(COLOR_RESET)"
	rm -rf $(BUILD_DIR)

##@ Release (using goreleaser)

release-snapshot: ## Create a snapshot release (no publish)
	@echo "$(COLOR_GREEN)Creating snapshot release...$(COLOR_RESET)"
	goreleaser release --snapshot --clean

release-dry-run: ## Dry run of release process
	@echo "$(COLOR_GREEN)Running release dry-run...$(COLOR_RESET)"
	goreleaser release --skip=publish --clean

##@ Information

version: ## Display version information
	@echo "$(COLOR_BOLD)Project:$(COLOR_RESET) $(PROJECT_NAME)"
	@echo "$(COLOR_BOLD)Version:$(COLOR_RESET) $(VERSION)"
	@echo "$(COLOR_BOLD)Commit:$(COLOR_RESET)  $(COMMIT)"
	@echo "$(COLOR_BOLD)GOOS:$(COLOR_RESET)    $(GOOS)"
	@echo "$(COLOR_BOLD)GOARCH:$(COLOR_RESET)  $(GOARCH)"

.DEFAULT_GOAL := help
