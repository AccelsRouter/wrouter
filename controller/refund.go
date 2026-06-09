// User-facing refund endpoints. Fork-only; the only upstream contact
// is the router registration in router/api-router.go and the token-
// controller refund-lock check.
package controller

import (
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// refundPrecheckResponse is what the wallet UI consumes to decide
// whether to show the submission form, the "disable your tokens
// first" blocker, or the "you already have an open request" banner.
type refundPrecheckResponse struct {
	ActiveTokens  int64                  `json:"active_tokens"`
	BalanceUSD    float64                `json:"balance_usd"`
	ActiveRequest *model.RefundRequest   `json:"active_request,omitempty"`
	CanSubmit     bool                   `json:"can_submit"`
	BlockReasons  []string               `json:"block_reasons"`
}

// GetRefundPrecheck — GET /api/user/refund/precheck
func GetRefundPrecheck(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiError(c, fmt.Errorf("not authenticated"))
		return
	}

	resp := refundPrecheckResponse{BlockReasons: []string{}}

	if tokens, err := model.CountUserActiveTokens(userId); err != nil {
		common.ApiError(c, fmt.Errorf("count tokens: %w", err))
		return
	} else {
		resp.ActiveTokens = tokens
		if tokens > 0 {
			resp.BlockReasons = append(resp.BlockReasons, "active_tokens")
		}
	}

	if active, err := model.GetActiveRefundRequest(userId); err != nil {
		common.ApiError(c, fmt.Errorf("active refund check: %w", err))
		return
	} else if active != nil {
		resp.ActiveRequest = active
		resp.BlockReasons = append(resp.BlockReasons, "active_request")
	}

	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, fmt.Errorf("load user: %w", err))
		return
	}
	resp.BalanceUSD = float64(user.Quota) / common.QuotaPerUnit
	resp.CanSubmit = len(resp.BlockReasons) == 0 && resp.BalanceUSD >= 1.0

	common.ApiSuccess(c, resp)
}

// submitRefundBody mirrors SubmitRefundRequestParams but in client form.
type submitRefundBody struct {
	AmountUSD         float64 `json:"amount_usd"`
	Method            string  `json:"method"`
	RefundDestination string  `json:"refund_destination"`
	Reason            string  `json:"reason"`
	ContactInfo       string  `json:"contact_info"`
}

// PostRefundRequest — POST /api/user/refund
func PostRefundRequest(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiError(c, fmt.Errorf("not authenticated"))
		return
	}
	var body submitRefundBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, fmt.Errorf("invalid payload: %w", err))
		return
	}

	r, err := service.SubmitRefundRequest(c, service.SubmitRefundRequestParams{
		UserId:            userId,
		AmountUSD:         body.AmountUSD,
		Method:            body.Method,
		RefundDestination: body.RefundDestination,
		Reason:            body.Reason,
		ContactInfo:       body.ContactInfo,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, r)
}

// GetMyRefundRequests — GET /api/user/refund
func GetMyRefundRequests(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiError(c, fmt.Errorf("not authenticated"))
		return
	}
	limit := atoiOrDefault(c.Query("limit"), 50)
	requests, err := model.ListRefundRequestsByUser(userId, limit)
	if err != nil {
		common.ApiError(c, fmt.Errorf("list requests: %w", err))
		return
	}
	common.ApiSuccess(c, gin.H{"items": requests})
}

// GetMyActiveRefundRequest — GET /api/user/refund/active
func GetMyActiveRefundRequest(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiError(c, fmt.Errorf("not authenticated"))
		return
	}
	r, err := model.GetActiveRefundRequest(userId)
	if err != nil {
		common.ApiError(c, fmt.Errorf("active refund: %w", err))
		return
	}
	common.ApiSuccess(c, gin.H{"active_request": r})
}

// PostCancelRefundRequest — POST /api/user/refund/:id/cancel
func PostCancelRefundRequest(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiError(c, fmt.Errorf("not authenticated"))
		return
	}
	refundId, err := strconv.Atoi(c.Param("id"))
	if err != nil || refundId <= 0 {
		common.ApiError(c, fmt.Errorf("invalid refund id"))
		return
	}
	if err := service.CancelRefundRequest(userId, refundId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"cancelled": true})
}

// PostDisableAllTokens — POST /api/user/refund/disable-tokens
// Convenience for the "one-click disable" button in the blocker dialog.
func PostDisableAllTokens(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiError(c, fmt.Errorf("not authenticated"))
		return
	}
	n, err := service.DisableAllEnabledTokens(userId)
	if err != nil {
		common.ApiError(c, fmt.Errorf("disable tokens: %w", err))
		return
	}
	common.ApiSuccess(c, gin.H{"disabled": n})
}

func atoiOrDefault(s string, def int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
