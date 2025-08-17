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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()

			req := httptest.NewRequest(tt.method, "/proxy/"+tt.remotePath, strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMETextPlain)
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
