// Fork-only admin top-up order listing (with username). Reconcile
// reuses the existing AdminCompleteTopUp handler / route.
package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// AdminListTopUpOrders — GET /api/admin/topup-orders?p=&page_size=&keyword=
// Returns paginated orders joined with username; keyword matches
// trade_no OR username.
func AdminListTopUpOrders(c *gin.Context) {
	page := common.GetPageQuery(c)
	if page.Page <= 0 {
		page.Page = 1
	}
	if page.PageSize <= 0 || page.PageSize > 100 {
		page.PageSize = 20
	}
	keyword := c.Query("keyword")

	rows, total, err := model.ListTopUpOrdersWithUsername(keyword, page)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(rows)
	common.ApiSuccess(c, page)
}

// wonderGateCodeMeanings maps gateway transaction codes to human-readable
// labels for the status-check endpoint.
var wonderGateCodeMeanings = map[int]string{
	service.WonderGateCodeTransactionSuccess:  "approved",
	service.WonderGateCodeTransactionDeclined: "declined",
	service.WonderGateCodeTransactionPending:  "pending",
	service.WonderGateCodeOrderClosed:         "closed",
}

// AdminQueryWonderGateOrderStatus — GET /api/admin/topup-orders/wondergate-status?trade_no=
// Queries the gateway for a WonderGate order's real transaction status and
// returns it alongside our local order status, so an operator can cross-check
// before/after a manual complete (补单) or investigate a reconcile decision.
// Read-only: never mutates the order.
func AdminQueryWonderGateOrderStatus(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		common.ApiErrorMsg(c, "trade_no is required")
		return
	}
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		common.ApiErrorMsg(c, "order not found")
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderWonderGate {
		common.ApiErrorMsg(c, "not a WonderGate order")
		return
	}

	code, err := service.QueryWonderGateOrderCode(c.Request.Context(), topUp.TradeNo, topUp.CreateTime)
	if err != nil {
		common.ApiSuccess(c, gin.H{
			"trade_no":     topUp.TradeNo,
			"local_status": topUp.Status,
			"gateway":      gin.H{"error": err.Error()},
		})
		return
	}
	meaning := wonderGateCodeMeanings[code]
	if meaning == "" {
		meaning = "unknown"
	}
	common.ApiSuccess(c, gin.H{
		"trade_no":     topUp.TradeNo,
		"local_status": topUp.Status,
		"gateway": gin.H{
			"code":    code,
			"meaning": meaning,
		},
	})
}
