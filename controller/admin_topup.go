// Fork-only admin top-up order listing (with username). Reconcile
// reuses the existing AdminCompleteTopUp handler / route.
package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
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
