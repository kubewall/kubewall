package mcp

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestProxyHandler(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/success":
			w.Header().Set("X-Test-Header", "test-value")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("mock response"))
		case "/echo":
			body, _ := io.ReadAll(r.Body)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(body)
		case "/check-auth":
			authHeader := r.Header.Get("Authorization")
			if authHeader == "Bearer test-api-key-123" {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("authorized"))
			} else {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte("unauthorized"))
			}
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte("not found"))
		}
	}))
	defer mockServer.Close()

	tests := []struct {
		name           string
		remotePath     string
		method         string
		body           string
		headers        map[string]string
		wantStatusCode int
		wantBody       string
	}{
		{
			name:           "missing remote URL",
			remotePath:     "",
			method:         http.MethodGet,
			wantStatusCode: http.StatusBadRequest,
			wantBody:       "Missing remote URL",
		},
		{
			name:           "invalid remote URL",
			remotePath:     "http://[::1]:namedport", // invalid
			method:         http.MethodGet,
			wantStatusCode: http.StatusBadRequest,
			wantBody:       "Invalid remote URL",
		},
		{
			name:           "successful proxy request",
			remotePath:     mockServer.URL + "/success",
			method:         http.MethodGet,
			wantStatusCode: http.StatusOK,
			wantBody:       "mock response",
		},
		{
			name:           "POST with body echo",
			remotePath:     mockServer.URL + "/echo",
			method:         http.MethodPost,
			body:           "hello world",
			wantStatusCode: http.StatusOK,
			wantBody:       "hello world",
		},
		{
			name:           "not found from remote server",
			remotePath:     mockServer.URL + "/does-not-exist",
			method:         http.MethodGet,
			wantStatusCode: http.StatusNotFound,
			wantBody:       "not found",
		},
		{
			name:       "X-KW-AI-API-Key header converted to Authorization Bearer",
			remotePath: mockServer.URL + "/check-auth",
			method:     http.MethodGet,
			headers: map[string]string{
				"X-KW-AI-API-Key": "test-api-key-123",
			},
			wantStatusCode: http.StatusOK,
			wantBody:       "authorized",
		},
		{
			name:       "existing Authorization header preserved when no X-KW-AI-API-Key",
			remotePath: mockServer.URL + "/check-auth",
			method:     http.MethodGet,
			headers: map[string]string{
				"Authorization": "Bearer test-api-key-123",
			},
			wantStatusCode: http.StatusOK,
			wantBody:       "authorized",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()

			req := httptest.NewRequest(tt.method, "/proxy/"+tt.remotePath, strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMETextPlain)

			// Add custom headers
			for key, value := range tt.headers {
				req.Header.Set(key, value)
			}

			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetParamNames("*")
			c.SetParamValues(tt.remotePath)

			// Execute handler
			err := ProxyHandler(c)
			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatusCode, rec.Code)
			assert.Contains(t, rec.Body.String(), tt.wantBody)
		})
	}
}
