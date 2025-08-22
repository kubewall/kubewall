# Stage 1: Build the React frontend
FROM node:18-slim AS frontend-builder

WORKDIR /app/client

# Copy package files
COPY client/package*.json ./

# Install dependencies with Rollup native binaries disabled
RUN yarn install

# Copy source code
COPY client/ ./

# Build the frontend with environment variable to disable native binaries
RUN yarn build

# Stage 2: Build the Go backend
FROM golang:1.24-alpine AS backend-builder

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