package middleware

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// precompressedVariants is ordered by preference: brotli compresses better
// than gzip, so it is tried first when the client accepts both.
var precompressedVariants = []struct {
	suffix   string
	encoding string
}{
	{suffix: ".br", encoding: "br"},
	{suffix: ".gz", encoding: "gzip"},
}

// PrecompressedStaticMiddleware serves a build-time precompressed (.br/.gz)
// variant of a static asset when the client's Accept-Encoding allows it,
// falling through to the regular static handler for everything else
// (API routes, the SPA index.html fallback, assets with no precompressed
// variant). Precompressed files are produced by the frontend build
// (vite-plugin-compression2) and embedded alongside the originals, so this
// middleware adds no runtime compression CPU cost - it only picks a file.
func PrecompressedStaticMiddleware(staticFiles fs.FS, root string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			if req.Method != http.MethodGet && req.Method != http.MethodHead {
				return next(c)
			}

			urlPath := path.Clean("/" + req.URL.Path)
			if strings.HasPrefix(urlPath, "/api/") {
				return next(c)
			}

			ext := path.Ext(urlPath)
			if ext == "" {
				// No extension means this is a client-side route (e.g. /kwconfig)
				// that the SPA fallback (index.html) must handle, not an asset.
				return next(c)
			}

			assetPath := path.Join(root, urlPath)
			acceptEncoding := req.Header.Get(echo.HeaderAcceptEncoding)

			for _, variant := range precompressedVariants {
				if !strings.Contains(acceptEncoding, variant.encoding) {
					continue
				}

				data, err := fs.ReadFile(staticFiles, assetPath+variant.suffix)
				if err != nil {
					continue
				}

				contentType := mime.TypeByExtension(ext)
				if contentType == "" {
					contentType = "application/octet-stream"
				}

				res := c.Response()
				res.Header().Set(echo.HeaderContentEncoding, variant.encoding)
				res.Header().Set(echo.HeaderVary, echo.HeaderAcceptEncoding)
				res.Header().Set(echo.HeaderContentLength, strconv.Itoa(len(data)))
				return c.Blob(http.StatusOK, contentType, data)
			}

			return next(c)
		}
	}
}
