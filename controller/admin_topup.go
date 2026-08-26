// Fork-only admin top-up order listing (with username). Reconcile
// reuses the existing AdminCompleteTopUp handler / route.
package controller

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
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

// AdminResyncWonderGateOrder — POST /api/admin/topup-orders/wondergate-resync
// {trade_no}. Queries the gateway for the transaction's real status and makes
// the local order agree with it:
//   - gateway approved  + local pending  -> credit (idempotent RechargeWonderGate)
//   - gateway declined/closed + local pending -> mark failed
//   - gateway declined/closed + local success -> reverse the credit (deduct)
//   - anything else -> no change
// The gateway is the source of truth; nothing is mutated when its status
// cannot be determined.
func AdminResyncWonderGateOrder(c *gin.Context) {
	var req struct {
		TradeNo string `json:"trade_no"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.TradeNo == "" {
		common.ApiErrorMsg(c, "trade_no is required")
		return
	}
	topUp := model.GetTopUpByTradeNo(req.TradeNo)
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
		common.ApiErrorMsg(c, "gateway query failed: "+err.Error())
		return
	}
	meaning := wonderGateCodeMeanings[code]
	if meaning == "" {
		meaning = "unknown"
	}

	LockOrder(topUp.TradeNo)
	defer UnlockOrder(topUp.TradeNo)

	statusBefore := topUp.Status
	action := "none"
	var actErr error
	switch code {
	case service.WonderGateCodeTransactionSuccess:
		if statusBefore == common.TopUpStatusPending {
			if actErr = model.RechargeWonderGate(topUp.TradeNo, c.ClientIP()); actErr == nil {
				action = "credited"
			}
		} else {
			action = "consistent"
		}
	case service.WonderGateCodeTransactionDeclined, service.WonderGateCodeOrderClosed:
		switch statusBefore {
		case common.TopUpStatusSuccess:
			if actErr = model.ReverseWonderGateTopUp(topUp.TradeNo, c.ClientIP()); actErr == nil {
				action = "reversed"
				logger.LogWarn(c.Request.Context(), fmt.Sprintf(
					"WonderGate 对账冲正 trade_no=%s gateway_code=%d operator_ip=%s", topUp.TradeNo, code, c.ClientIP()))
			}
		case common.TopUpStatusPending:
			if actErr = model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderWonderGate, common.TopUpStatusFailed); actErr == nil {
				action = "marked_failed"
			}
		default:
			action = "consistent"
		}
	}
	if actErr != nil {
		common.ApiErrorMsg(c, "resync failed: "+actErr.Error())
		return
	}

	after := topUp.Status
	if fresh := model.GetTopUpByTradeNo(topUp.TradeNo); fresh != nil {
		after = fresh.Status
	}
	common.ApiSuccess(c, gin.H{
		"trade_no":            topUp.TradeNo,
		"gateway":             gin.H{"code": code, "meaning": meaning},
		"local_status_before": statusBefore,
		"local_status_after":  after,
		"action":              action,
	})
}
