package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func newTestStaticFS() fstest.MapFS {
	return fstest.MapFS{
		"static/assets/app.js":        {Data: []byte("console.log('uncompressed')")},
		"static/assets/app.js.br":     {Data: []byte("brotli-bytes")},
		"static/assets/app.js.gz":     {Data: []byte("gzip-bytes")},
		"static/assets/nocompress.js": {Data: []byte("no precompressed variant")},
		"static/index.html":           {Data: []byte("<html></html>")},
	}
}

func runMiddleware(t *testing.T, fsys fstest.MapFS, method, path, acceptEncoding string) (*httptest.ResponseRecorder, bool) {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(method, path, nil)
	if acceptEncoding != "" {
		req.Header.Set(echo.HeaderAcceptEncoding, acceptEncoding)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	nextCalled := false
	next := func(c echo.Context) error {
		nextCalled = true
		return c.String(http.StatusNotFound, "next handler")
	}

	err := PrecompressedStaticMiddleware(fsys, "static")(next)(c)
	assert.NoError(t, err)
	return rec, nextCalled
}

func TestPrecompressedStaticMiddleware(t *testing.T) {
	fsys := newTestStaticFS()

	t.Run("prefers brotli when client accepts both br and gzip", func(t *testing.T) {
		rec, nextCalled := runMiddleware(t, fsys, http.MethodGet, "/assets/app.js", "gzip, deflate, br")

		assert.False(t, nextCalled)
		assert.Equal(t, "br", rec.Header().Get(echo.HeaderContentEncoding))
		assert.Equal(t, echo.HeaderAcceptEncoding, rec.Header().Get(echo.HeaderVary))
		assert.Equal(t, "brotli-bytes", rec.Body.String())
	})

	t.Run("falls back to gzip when client does not accept br", func(t *testing.T) {
		rec, nextCalled := runMiddleware(t, fsys, http.MethodGet, "/assets/app.js", "gzip")

		assert.False(t, nextCalled)
		assert.Equal(t, "gzip", rec.Header().Get(echo.HeaderContentEncoding))
		assert.Equal(t, "gzip-bytes", rec.Body.String())
	})

	t.Run("sets content type from the original extension, not the compressed suffix", func(t *testing.T) {
		rec, _ := runMiddleware(t, fsys, http.MethodGet, "/assets/app.js", "br")

		assert.Contains(t, rec.Header().Get(echo.HeaderContentType), "javascript")
	})

	t.Run("falls through to next when client sends no Accept-Encoding", func(t *testing.T) {
		_, nextCalled := runMiddleware(t, fsys, http.MethodGet, "/assets/app.js", "")

		assert.True(t, nextCalled)
	})

	t.Run("falls through to next when no precompressed variant exists", func(t *testing.T) {
		_, nextCalled := runMiddleware(t, fsys, http.MethodGet, "/assets/nocompress.js", "br, gzip")

		assert.True(t, nextCalled)
	})

	t.Run("falls through to next for API routes regardless of Accept-Encoding", func(t *testing.T) {
		_, nextCalled := runMiddleware(t, fsys, http.MethodGet, "/api/v1/pods.js", "br, gzip")

		assert.True(t, nextCalled)
	})

	t.Run("falls through to next for extensionless SPA routes", func(t *testing.T) {
		_, nextCalled := runMiddleware(t, fsys, http.MethodGet, "/kwconfig", "br, gzip")

		assert.True(t, nextCalled)
	})

	t.Run("falls through to next for non-GET/HEAD methods", func(t *testing.T) {
		_, nextCalled := runMiddleware(t, fsys, http.MethodPost, "/assets/app.js", "br, gzip")

		assert.True(t, nextCalled)
	})

	t.Run("serves HEAD requests the same as GET", func(t *testing.T) {
		rec, nextCalled := runMiddleware(t, fsys, http.MethodHead, "/assets/app.js", "br")

		assert.False(t, nextCalled)
		assert.Equal(t, "br", rec.Header().Get(echo.HeaderContentEncoding))
	})
}
