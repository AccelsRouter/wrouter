// Admin-facing refund endpoints. Fork-only. In v1 there is no admin
// UI page — operators trigger these via curl/Postman based on the
// Lark notification that arrives on submission.
package controller

import (
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// AdminListRefundRequests — GET /api/admin/refund?status=pending&limit=50&offset=0
func AdminListRefundRequests(c *gin.Context) {
	status := c.Query("status")
	limit := atoiOrDefault(c.Query("limit"), 50)
	offset := atoiOrDefault(c.Query("offset"), 0)
	items, total, err := model.ListAllRefundRequests(status, limit, offset)
	if err != nil {
		common.ApiError(c, fmt.Errorf("list: %w", err))
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// AdminGetRefundRequest — GET /api/admin/refund/:id
func AdminGetRefundRequest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, fmt.Errorf("invalid refund id"))
		return
	}
	r, err := model.GetRefundRequestByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if r == nil {
		common.ApiError(c, fmt.Errorf("not found"))
		return
	}
	common.ApiSuccess(c, r)
}

type adminRefundActionBody struct {
	Note string `json:"note"`
}

// AdminApproveRefundRequest — POST /api/admin/refund/:id/approve
// body: { "note": "..." } (optional)
//
// Status transition: pending → approved. Quota is NOT modified at
// this stage; the operator must still pay the user off-platform and
// then call /mark-refunded to finalize.
func AdminApproveRefundRequest(c *gin.Context) {
	adminId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, fmt.Errorf("invalid refund id"))
		return
	}
	var body adminRefundActionBody
	_ = c.ShouldBindJSON(&body)

	if err := service.ApproveRefundRequest(adminId, id, body.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"approved": true})
}

// AdminRejectRefundRequest — POST /api/admin/refund/:id/reject
// body: { "note": "<reason>" } (REQUIRED)
func AdminRejectRefundRequest(c *gin.Context) {
	adminId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, fmt.Errorf("invalid refund id"))
		return
	}
	var body adminRefundActionBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, fmt.Errorf("invalid payload: %w", err))
		return
	}
	if err := service.RejectRefundRequest(adminId, id, body.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"rejected": true})
}

// AdminMarkRefundRefunded — POST /api/admin/refund/:id/mark-refunded
// body: { "note": "txid / receipt / ..." } (optional)
//
// FINAL stage. Operator has paid the user off-platform; this call
// debits user.Quota and writes the audit log. Atomic — fails if user
// balance dropped below the refund amount in the meantime.
func AdminMarkRefundRefunded(c *gin.Context) {
	adminId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, fmt.Errorf("invalid refund id"))
		return
	}
	var body adminRefundActionBody
	_ = c.ShouldBindJSON(&body)

	if err := service.MarkRefunded(service.MarkRefundedParams{
		AdminId:  adminId,
		RefundId: id,
		Note:     body.Note,
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"refunded": true})
}
