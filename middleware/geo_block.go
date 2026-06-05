// GeoBlock middleware: deny requests from configured countries when the
// requested model matches one of the configured "families" (openai, claude,
// gemini, grok, …). Country is resolved from the CloudFront-Viewer-Country
// header (set automatically by CloudFront), with CF-IPCountry as a fallback.
//
// This file is fork-local: upstream syncs never touch it. The only upstream
// integration point is a single Use(...) call in router/relay-router.go.
package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

const (
	headerCloudFrontCountry = "CloudFront-Viewer-Country"
	headerCloudflareCountry = "CF-IPCountry"
)

// GeoBlock returns a Gin middleware that enforces per-family country bans.
// It is designed to run AFTER middleware.Distribute() (which populates
// ContextKeyOriginalModel).
//
// Fail-open semantics: any missing signal (settings disabled, header absent,
// model not in a managed family) results in passthrough. This keeps the
// platform available when the CloudFront fronting layer is misconfigured
// rather than silently blocking all traffic.
func GeoBlock() gin.HandlerFunc {
	return func(c *gin.Context) {
		settings := system_setting.GetGeoBlockSettings()
		if settings == nil || !settings.Enabled {
			c.Next()
			return
		}

		model := resolveOriginalModel(c)
		if model == "" {
			c.Next()
			return
		}

		family := matchGeoBlockFamily(model, settings.Families)
		if family == nil || len(family.BlockedCountries) == 0 {
			c.Next()
			return
		}

		country := resolveClientCountry(c)
		if country == "" {
			logger.LogWarn(c.Request.Context(),
				"geo_block: no country header present; passing through. "+
					"Ensure CloudFront is in front of the ALB and forwards CloudFront-Viewer-Country.")
			c.Next()
			return
		}

		if !geoBlockCountryListContains(family.BlockedCountries, country) {
			c.Next()
			return
		}

		// Block. Use OpenAI-compatible error envelope so SDKs surface a
		// meaningful error to the user.
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"message": "This model is not available in your region.",
				"type":    "invalid_request_error",
				"code":    "region_not_supported",
				"param":   "model",
			},
		})
		c.Abort()
	}
}

// resolveOriginalModel returns the model name the user originally requested,
// lowercased and trimmed. Empty string when not set.
func resolveOriginalModel(c *gin.Context) string {
	v, ok := common.GetContextKey(c, constant.ContextKeyOriginalModel)
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(s))
}

// resolveClientCountry returns the uppercase ISO 3166-1 alpha-2 code from
// the first available source. Empty when none.
func resolveClientCountry(c *gin.Context) string {
	for _, h := range []string{headerCloudFrontCountry, headerCloudflareCountry} {
		v := strings.TrimSpace(c.GetHeader(h))
		if v == "" {
			continue
		}
		v = strings.ToUpper(v)
		// CloudFront uses "ZZ" for unknown / unmatched IPs; treat it as
		// "no signal" and fail open.
		if v == "ZZ" {
			continue
		}
		// Use the first 2 chars in case the header includes region (e.g.
		// "CN-11" — rare but defensive).
		if len(v) >= 2 {
			return v[:2]
		}
	}
	return ""
}

// matchGeoBlockFamily returns the first family whose any prefix matches the
// lowercased model name. Returns nil when no family matches.
func matchGeoBlockFamily(model string, families []system_setting.GeoBlockFamily) *system_setting.GeoBlockFamily {
	for i := range families {
		fam := &families[i]
		for _, prefix := range fam.Prefixes {
			p := strings.ToLower(strings.TrimSpace(prefix))
			if p == "" {
				continue
			}
			if strings.HasPrefix(model, p) {
				return fam
			}
		}
	}
	return nil
}

// geoBlockCountryListContains performs a case-insensitive membership test.
func geoBlockCountryListContains(list []string, country string) bool {
	country = strings.ToUpper(country)
	for _, c := range list {
		if strings.ToUpper(strings.TrimSpace(c)) == country {
			return true
		}
	}
	return false
}
