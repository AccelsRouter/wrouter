// Fork-only: wallet referral panel — list users invited by the current user.
package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetInvitedUsers — GET /api/user/invitees?p=&page_size=
// (registered on the authenticated self-route group, which is prefixed
// /api/user — not /api/user/self.)
// Returns the current user's invitees (username + registration/invite time),
// newest first, paginated.
func GetInvitedUsers(c *gin.Context) {
	id := c.GetInt("id")

	page := common.GetPageQuery(c)
	if page.Page <= 0 {
		page.Page = 1
	}
	if page.PageSize <= 0 || page.PageSize > 100 {
		page.PageSize = 20
	}

	rows, total, err := model.ListInvitedUsers(id, page)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(rows)
	common.ApiSuccess(c, page)
}
