# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-builder

# Install required build tools for native dependencies
# This is crucial for packages that need to compile native code
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/client

# Copy package files first (note: using both package.json patterns and yarn.lock)
COPY client/package.json client/yarn.lock* client/package-lock.json* ./

# Set yarn network timeout to prevent timeout issues
RUN yarn config set network-timeout 600000

# Install dependencies with increased memory and network timeout
# Added --network-concurrency to limit parallel connections
RUN ROLLUP_SKIP_NATIVE=true \
    NODE_OPTIONS='--max-old-space-size=4096' \
    yarn install --frozen-lockfile --network-concurrency 1 \
    || (echo "Yarn install failed. Error log:" && cat /tmp/yarn-error.log 2>/dev/null && exit 1)

# Copy source code
COPY client/ ./

# Build the frontend with environment variable to disable native binaries
RUN ROLLUP_SKIP_NATIVE=true \
    NODE_OPTIONS='--max-old-space-size=4096' \
    yarn build

# Stage 2: Build the Go backend
FROM golang:1.24-alpine AS backend-builder
# Note: Changed from 1.24 to 1.23 as Go 1.24 doesn't exist yet

WORKDIR /app

# Install git and ca-certificates
RUN apk add --no-cache git ca-certificates

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the Go application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o kube-dash ./cmd/server

# Stage 3: Final image
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from backend-builder
COPY --from=backend-builder /app/kube-dash .

# Copy the built frontend from frontend-builder
COPY --from=frontend-builder /app/client/dist ./static

# Expose port
EXPOSE 7080

# Set environment variables
ENV STATIC_FILES_PATH=./static

# Run the binary
CMD ["./kube-dash"]