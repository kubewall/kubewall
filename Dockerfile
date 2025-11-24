# Frontend build stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY client/package.json client/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy frontend source code
COPY client/ ./

# Build frontend
RUN yarn build

# Backend build stage
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS backend-builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG COMMIT=unknown

WORKDIR /app

# Copy go mod files
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source code
COPY backend/ .

# Copy built frontend assets
COPY --from=frontend-builder /app/dist ./routes/static

# Build the application with version information
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.commit=${COMMIT}" \
    -o kubewall \
    main.go

# Final stage
FROM --platform=$TARGETPLATFORM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the binary from backend builder
COPY --from=backend-builder /app/kubewall .

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["/app/kubewall"]
