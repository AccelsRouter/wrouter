// Fork-only reseller (distributor) console: a reseller org provisions and
// funds downstream customer orgs and views their balance/usage. Builds on the
// existing allocate/revoke primitives; every handler resolves the caller's own
// reseller org and refuses to touch anything it has no ledger relationship
// with.
package controller

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// callerReseller resolves the caller's org and requires it to be a reseller.
func callerReseller(c *gin.Context) (*model.Organization, bool) {
	org, _, ok := callerOrg(c)
	if !ok {
		return nil, false
	}
	if org.Type != model.OrgTypeReseller {
		common.ApiErrorMsg(c, "仅代理商组织可访问")
		return nil, false
	}
	return org, true
}

type createCustomerRequest struct {
	Name         string `json:"name"`
	PriceGroup   string `json:"price_group"`
	InitialQuota int    `json:"initial_quota"`
}

// CreateMyCustomer — POST /api/organization/customers
func CreateMyCustomer(c *gin.Context) {
	reseller, ok := callerReseller(c)
	if !ok {
		return
	}
	var req createCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ValidateOrgName(strings.TrimSpace(req.Name)); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	customer, err := model.CreateResellerCustomer(reseller.Id, strings.TrimSpace(req.Name), strings.TrimSpace(req.PriceGroup), req.InitialQuota, c.GetInt("id"))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	model.RecordOrgAudit(reseller.Id, c.GetInt("id"), "customer.create", fmt.Sprintf("org:%d", customer.Id), fmt.Sprintf("%s quota=%d", customer.Name, req.InitialQuota))
	common.ApiSuccess(c, customer)
}

// ListMyCustomers — GET /api/organization/customers
func ListMyCustomers(c *gin.Context) {
	reseller, ok := callerReseller(c)
	if !ok {
		return
	}
	customers, err := model.ListResellerCustomers(reseller.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, customers)
}

// GetMyCustomerUsage — GET /api/organization/customers/:id/usage
// A reseller may view a customer's usage only if it is actually its customer
// (has ever allocated to it).
func GetMyCustomerUsage(c *gin.Context) {
	reseller, ok := callerReseller(c)
	if !ok {
		return
	}
	customerId, _ := strconv.Atoi(c.Param("id"))
	isCustomer, err := model.IsResellerCustomer(reseller.Id, customerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !isCustomer {
		common.ApiErrorMsg(c, "该组织不是你的客户")
		return
	}
	from, to, ok := parseUsageWindow(c)
	if !ok {
		return
	}
	report, err := model.GetOrgUsage(customerId, from, to)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}
