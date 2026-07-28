package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets for the supported
// themes (default = upstream web/, plus the aurora theme). Classic was
// removed upstream in v1.0.0-rc.22.
type WebAssets struct {
	DefaultBuildFS   embed.FS
	DefaultIndexPage []byte
	AuroraBuildFS    embed.FS
	AuroraIndexPage  []byte
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/dist")
	auroraFS := common.EmbedFolder(assets.AuroraBuildFS, "aurora/dist")
	frontendFS := common.NewThemeAwareFS(defaultFS, auroraFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		if common.GetTheme() == "aurora" {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.AuroraIndexPage)
		} else {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.DefaultIndexPage)
		}
	})
}
