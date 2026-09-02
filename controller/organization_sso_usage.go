// Fork-only org console + admin handlers for SSO domain auto-provisioning and
// usage reporting / invoice export. SSO domain mappings are admin-managed (the
// platform verifies domain ownership); the org console can only view them.
package controller

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// SSO domain mappings — admin-managed
// ---------------------------------------------------------------------------

// AdminListOrgSsoDomains — GET /api/admin/organizations/:id/sso-domains
func AdminListOrgSsoDomains(c *gin.Context) {
	orgId, _ := strconv.Atoi(c.Param("id"))
	domains, err := model.ListOrgSsoDomains(orgId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, domains)
}

type ssoDomainRequest struct {
	Domain   string `json:"domain"`
	Provider string `json:"provider"` // OAuth provider (SSO connection) allowed to provision
}

// AdminAddOrgSsoDomain — POST /api/admin/organizations/:id/sso-domains
func AdminAddOrgSsoDomain(c *gin.Context) {
	orgId, _ := strconv.Atoi(c.Param("id"))
	org, err := model.GetOrganizationById(orgId)
	if err != nil || org == nil {
		common.ApiErrorMsg(c, "organization not found")
		return
	}
	var req ssoDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if model.NormalizeSsoDomain(req.Domain) == "" {
		common.ApiErrorMsg(c, "invalid domain")
		return
	}
	if req.Provider == "" {
		common.ApiErrorMsg(c, "provider is required")
		return
	}
	rec, err := model.AddOrgSsoDomain(orgId, req.Domain, req.Provider)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, rec)
}

// AdminDeleteOrgSsoDomain — DELETE /api/admin/organizations/:id/sso-domains/:domain_id
func AdminDeleteOrgSsoDomain(c *gin.Context) {
	orgId, _ := strconv.Atoi(c.Param("id"))
	domainId, _ := strconv.Atoi(c.Param("domain_id"))
	if err := model.DeleteOrgSsoDomain(domainId, orgId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ListMyOrgSsoDomains — GET /api/organization/sso-domains (read-only for the org)
func ListMyOrgSsoDomains(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	domains, err := model.ListOrgSsoDomains(org.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, domains)
}

// ---------------------------------------------------------------------------
// Usage reporting + invoice export
// ---------------------------------------------------------------------------

// usageWindow parses ?from=&to= (unix seconds). When both are absent it
// defaults to the last 30 days. A missing/zero bound stays open on that side.
func usageWindow(c *gin.Context) (from, to int64) {
	from, _ = strconv.ParseInt(c.Query("from"), 10, 64)
	to, _ = strconv.ParseInt(c.Query("to"), 10, 64)
	if from == 0 && to == 0 {
		from = time.Now().AddDate(0, 0, -30).Unix()
	}
	return from, to
}

// GetMyOrgUsage — GET /api/organization/usage
func GetMyOrgUsage(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	from, to := usageWindow(c)
	report, err := model.GetOrgUsage(org.Id, from, to)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}

// ExportMyOrgUsage — GET /api/organization/usage/export (CSV invoice export)
func ExportMyOrgUsage(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	from, to := usageWindow(c)
	report, err := model.GetOrgUsage(org.Id, from, to)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeUsageCSV(c, org, report)
}

// AdminGetOrgUsage — GET /api/admin/organizations/:id/usage
func AdminGetOrgUsage(c *gin.Context) {
	orgId, _ := strconv.Atoi(c.Param("id"))
	from, to := usageWindow(c)
	report, err := model.GetOrgUsage(orgId, from, to)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}

// writeUsageCSV streams the report as a CSV invoice. Quota is rendered in the
// platform's display unit via common.LogQuota-style conversion so the exported
// numbers match the console.
func writeUsageCSV(c *gin.Context, org *model.Organization, report *model.OrgUsageReport) {
	filename := fmt.Sprintf("usage-%d-%d-%d.csv", org.Id, report.From, report.To)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")

	w := csv.NewWriter(c.Writer)
	defer w.Flush()

	_ = w.Write([]string{"Organization", csvSafe(org.Name)})
	_ = w.Write([]string{"From (unix)", strconv.FormatInt(report.From, 10)})
	_ = w.Write([]string{"To (unix)", strconv.FormatInt(report.To, 10)})
	_ = w.Write([]string{"Total quota", strconv.FormatInt(report.TotalQuota, 10)})
	_ = w.Write([]string{"Total requests", strconv.FormatInt(report.TotalRequests, 10)})
	_ = w.Write([]string{"Total prompt tokens", strconv.FormatInt(report.TotalPrompt, 10)})
	_ = w.Write([]string{"Total completion tokens", strconv.FormatInt(report.TotalCompletion, 10)})
	_ = w.Write(nil)

	writeSection := func(title string, buckets []model.OrgUsageBucket) {
		_ = w.Write([]string{title, "Quota", "Requests", "Prompt tokens", "Completion tokens"})
		for _, b := range buckets {
			_ = w.Write([]string{
				csvSafe(b.Key),
				strconv.FormatInt(b.Quota, 10),
				strconv.FormatInt(b.Requests, 10),
				strconv.FormatInt(b.PromptTokens, 10),
				strconv.FormatInt(b.CompletionTokens, 10),
			})
		}
		_ = w.Write(nil)
	}
	writeSection("By workspace", report.ByWorkspace)
	writeSection("By model", report.ByModel)
	writeSection("By member", report.ByMember)
}

// csvSafe neutralizes CSV formula (macro) injection: a cell beginning with a
// formula trigger is prefixed with a single quote so spreadsheet apps treat it
// as text. Member labels are downstream usernames (a different trust boundary
// from the admin who opens the invoice), and usernames have no charset limit.
func csvSafe(s string) string {
	if s == "" {
		return s
	}
	switch s[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + s
	}
	return s
}
