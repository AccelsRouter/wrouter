// Fork-only platform-admin controllers for the organization system: create
// orgs, credit their wallets (invoiced top-up), and attach/detach accounts.
// All routes are AdminAuth-gated in router/api-router.go. The org console
// (org owners/admins managing their own members/customers) lives in
// controller/organization_console.go.
package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// AdminListOrganizations — GET /api/admin/organizations
func AdminListOrganizations(c *gin.Context) {
	page := common.GetPageQuery(c)
	orgs, total, err := model.ListOrganizations(page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(orgs)
	common.ApiSuccess(c, page)
}

type adminCreateOrgRequest struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	PriceGroup string `json:"price_group"`
	OwnerId    int    `json:"owner_user_id"`
	Remark     string `json:"remark"`
}

// AdminCreateOrganization — POST /api/admin/organizations
func AdminCreateOrganization(c *gin.Context) {
	var req adminCreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.OwnerId > 0 {
		if u, err := model.GetUserById(req.OwnerId, false); err != nil || u == nil {
			common.ApiErrorMsg(c, "owner user not found")
			return
		}
	}
	org := &model.Organization{
		Name:        req.Name,
		Type:        req.Type,
		PriceGroup:  req.PriceGroup,
		OwnerUserId: req.OwnerId,
		Remark:      req.Remark,
	}
	if err := model.CreateOrganization(org); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, org)
}

type adminUpdateOrgRequest struct {
	Name       *string `json:"name"`
	PriceGroup *string `json:"price_group"`
	Status     *string `json:"status"`
	Remark     *string `json:"remark"`
}

// AdminUpdateOrganization — PUT /api/admin/organizations/:id
func AdminUpdateOrganization(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req adminUpdateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	fields := map[string]interface{}{}
	if req.Name != nil {
		fields["name"] = *req.Name
	}
	if req.PriceGroup != nil {
		fields["price_group"] = *req.PriceGroup
	}
	if req.Status != nil {
		if *req.Status != model.OrgStatusActive && *req.Status != model.OrgStatusSuspended {
			common.ApiErrorMsg(c, "invalid status")
			return
		}
		fields["status"] = *req.Status
	}
	if req.Remark != nil {
		fields["remark"] = *req.Remark
	}
	if len(fields) == 0 {
		common.ApiSuccess(c, nil)
		return
	}
	if err := model.UpdateOrganizationFields(id, fields); err != nil {
		common.ApiError(c, err)
		return
	}
	// Suspending an org must reflect on the hot path for its accounts at once.
	if req.Status != nil {
		invalidateOrgAccountsCache(id)
	}
	common.ApiSuccess(c, nil)
}

type adminCreditOrgRequest struct {
	Quota   int    `json:"quota"`
	TradeNo string `json:"trade_no"`
	Remark  string `json:"remark"`
}

// AdminCreditOrganization — POST /api/admin/organizations/:id/credit
// Invoiced top-up: platform credits the org wallet, appends a purchase ledger
// row atomically.
func AdminCreditOrganization(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req adminCreditOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Quota <= 0 {
		common.ApiErrorMsg(c, "quota must be positive")
		return
	}
	if err := model.PlatformCreditOrg(id, req.Quota, c.GetInt("id"), req.TradeNo, req.Remark); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminListOrgLedger — GET /api/admin/organizations/:id/ledger
func AdminListOrgLedger(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	page := common.GetPageQuery(c)
	rows, total, err := model.ListOrgLedger(id, page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetTotal(int(total))
	page.SetItems(rows)
	common.ApiSuccess(c, page)
}

// invalidateOrgAccountsCache drops the payer cache for every account under an
// org (used after org-wide status changes).
func invalidateOrgAccountsCache(orgId int) {
	accounts, err := model.ListOrgAccounts(orgId)
	if err != nil {
		return
	}
	for _, a := range accounts {
		model.InvalidateOrgPayerCache(a.UserId)
	}
}
