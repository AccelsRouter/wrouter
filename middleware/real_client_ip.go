// RealClientIP middleware: resolve the true viewer IP when the app is fronted
// by CloudFront, so that gin's c.ClientIP() — used across login/register audit,
// last-login IP, IP rate limiting and Turnstile — returns the end user instead
// of the CloudFront edge IP.
//
// This file is fork-local: upstream syncs never touch it. The only upstream
// integration points are two lines in the fork-local trusted_proxies.go
// (engine.TrustedPlatform + engine.Use), so no per-call-site edits are needed.
package middleware

import (
	"net"
	"strings"

	"github.com/gin-gonic/gin"
)

// RealClientIPHeader is an internal, server-controlled request header.
// RealClientIP() populates it from CloudFront's viewer address, and the gin
// engine is configured with TrustedPlatform = RealClientIPHeader so that
// c.ClientIP() returns it. Because the middleware deletes any inbound value
// first, clients cannot spoof it.
const RealClientIPHeader = "X-Real-Client-IP"

// cloudFrontViewerAddressHeader carries the real viewer IP (and port) when the
// app is fronted by CloudFront. It must be enabled in the CloudFront
// origin-request / cache policy for it to reach the origin.
const cloudFrontViewerAddressHeader = "CloudFront-Viewer-Address"

// RealClientIP returns a gin middleware that records the true viewer IP into
// RealClientIPHeader. Register it as the first global middleware, before any
// handler or middleware that reads c.ClientIP().
//
// Fail-safe: when CloudFront-Viewer-Address is absent (e.g. no CloudFront in
// front, or a health check), the header is cleared and gin falls back to its
// normal X-Forwarded-For / RemoteAddr resolution governed by TrustedProxies.
func RealClientIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Never trust an inbound value for this header — only we may set it.
		c.Request.Header.Del(RealClientIPHeader)
		if addr := strings.TrimSpace(c.GetHeader(cloudFrontViewerAddressHeader)); addr != "" {
			if ip := ipFromViewerAddress(addr); ip != "" {
				c.Request.Header.Set(RealClientIPHeader, ip)
			}
		}
		c.Next()
	}
}

// ipFromViewerAddress extracts the IP from a CloudFront-Viewer-Address value.
// CloudFront formats it as "IP:port" without brackets for both IPv4
// ("203.0.113.5:1234") and IPv6 ("2001:db8::1:1234"), so strip the port at the
// last colon and validate. Returns "" when it cannot be parsed.
func ipFromViewerAddress(addr string) string {
	if idx := strings.LastIndex(addr, ":"); idx > 0 {
		if host := addr[:idx]; net.ParseIP(host) != nil {
			return host
		}
	}
	// Defensive: value may already be a bare IP with no port.
	if net.ParseIP(addr) != nil {
		return addr
	}
	return ""
}
