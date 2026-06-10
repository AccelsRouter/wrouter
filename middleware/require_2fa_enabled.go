// Require2FAEnabled is a fork-only middleware that blocks an action
// unless the calling user has 2FA (TOTP) or a Passkey registered.
//
// Unlike SecureVerificationRequired (which demands a fresh in-session
// verification), this only checks that the user has *set up* a second
// factor — it does NOT ask them to re-verify. Used to gate top-ups so
// that funds can only be added to accounts protected by a second
// factor.
//
// Fork-only file: upstream syncs never touch it. The only upstream
// contact is the route registration in router/api-router.go.
package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// Require2FAEnabled blocks the request with HTTP 403 + code
// "TWO_FA_REQUIRED" when the user has neither 2FA nor a Passkey.
func Require2FAEnabled() gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		if userId == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "未登录",
			})
			c.Abort()
			return
		}

		if hasSecondFactor(userId) {
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"code":    "TWO_FA_REQUIRED",
			"message": "为了账户安全，充值前请先开启二次验证（2FA 或通行密钥）",
		})
		c.Abort()
	}
}

// hasSecondFactor reports whether the user has TOTP 2FA enabled or a
// registered Passkey credential.
func hasSecondFactor(userId int) bool {
	if model.IsTwoFAEnabled(userId) {
		return true
	}
	if passkey, err := model.GetPasskeyByUserID(userId); err == nil && passkey != nil {
		return true
	}
	return false
}
