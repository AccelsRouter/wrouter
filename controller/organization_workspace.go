// Fork-only workspace + BYOK console handlers, scoped to the caller's own org.
package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ListMyWorkspaces — GET /api/organization/workspaces
func ListMyWorkspaces(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	ws, err := model.ListWorkspaces(org.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ws)
}

type workspaceRequest struct {
	Name          string  `json:"name"`
	MonthlyBudget *int    `json:"monthly_budget"`
	Status        *string `json:"status"`
}

// CreateMyWorkspace — POST /api/organization/workspaces
func CreateMyWorkspace(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	var req workspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	budget := 0
	if req.MonthlyBudget != nil {
		if *req.MonthlyBudget < 0 {
			common.ApiErrorMsg(c, "budget cannot be negative")
			return
		}
		budget = *req.MonthlyBudget
	}
	ws := &model.Workspace{OrgId: org.Id, Name: req.Name, MonthlyBudget: budget}
	if err := model.CreateWorkspace(ws); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, ws)
}

// ownWorkspace resolves a workspace id and confirms it belongs to the caller's
// org. Returns nil (and writes the error) when it does not.
func ownWorkspace(c *gin.Context, org *model.Organization) *model.Workspace {
	id, _ := strconv.Atoi(c.Param("id"))
	ws, err := model.GetWorkspaceById(id)
	if err != nil {
		common.ApiError(c, err)
		return nil
	}
	if ws == nil || ws.OrgId != org.Id {
		common.ApiErrorMsg(c, "workspace not in your organization")
		return nil
	}
	return ws
}

// UpdateMyWorkspace — PUT /api/organization/workspaces/:id
func UpdateMyWorkspace(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	ws := ownWorkspace(c, org)
	if ws == nil {
		return
	}
	var req workspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	fields := map[string]interface{}{}
	if strings.TrimSpace(req.Name) != "" {
		fields["name"] = strings.TrimSpace(req.Name)
	}
	if req.MonthlyBudget != nil {
		if *req.MonthlyBudget < 0 {
			common.ApiErrorMsg(c, "budget cannot be negative")
			return
		}
		fields["monthly_budget"] = *req.MonthlyBudget
	}
	if req.Status != nil {
		if *req.Status != model.OrgStatusActive && *req.Status != model.OrgStatusSuspended {
			common.ApiErrorMsg(c, "invalid status")
			return
		}
		fields["status"] = *req.Status
	}
	if len(fields) == 0 {
		common.ApiSuccess(c, nil)
		return
	}
	if err := model.UpdateWorkspaceFields(ws.Id, fields); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// DeleteMyWorkspace — DELETE /api/organization/workspaces/:id
func DeleteMyWorkspace(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	ws := ownWorkspace(c, org)
	if ws == nil {
		return
	}
	if err := model.DeleteWorkspace(ws.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type bindTokenRequest struct {
	TokenId int `json:"token_id"`
}

// BindMyWorkspaceToken — POST /api/organization/workspaces/:id/tokens
// The token must belong to a user inside the caller's org, preventing a token
// from another org (or a self-paying user) being pulled into this workspace.
func BindMyWorkspaceToken(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	ws := ownWorkspace(c, org)
	if ws == nil {
		return
	}
	var req bindTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	token, tErr := model.GetTokenById(req.TokenId)
	if tErr != nil || token == nil {
		common.ApiErrorMsg(c, "token not found")
		return
	}
	acc, _ := model.GetOrgAccountByUser(token.UserId)
	if acc == nil || acc.OrgId != org.Id {
		common.ApiErrorMsg(c, "token does not belong to a member of your organization")
		return
	}
	if err := model.BindTokenToWorkspace(org.Id, ws.Id, req.TokenId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---------------------------------------------------------------------------
// BYOK: an org supplies provider credentials, materialized as a normal channel
// serving the org's private group. Reuses the whole channel machinery; only
// ownership is recorded so the console can never touch another org's channels.
// ---------------------------------------------------------------------------

type byokRequest struct {
	Name    string `json:"name"`
	Type    int    `json:"type"`
	Key     string `json:"key"`
	BaseURL string `json:"base_url"`
	Models  string `json:"models"`
}

// CreateMyByokChannel — POST /api/organization/byok
func CreateMyByokChannel(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	var req byokRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Key) == "" || strings.TrimSpace(req.Models) == "" {
		common.ApiErrorMsg(c, "name, key and models are required")
		return
	}
	group := model.OrgPrivateGroup(org.Id)
	baseURL := req.BaseURL
	channel := &model.Channel{
		Type:   req.Type,
		Name:   "[BYOK] " + req.Name,
		Key:    req.Key,
		Models: req.Models,
		Group:  group, // isolated to this org's private group only
		Status: common.ChannelStatusEnabled,
	}
	if baseURL != "" {
		channel.BaseURL = &baseURL
	}
	if err := channel.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.AddOrgChannel(org.Id, channel.Id); err != nil {
		// best-effort cleanup of the orphaned channel
		_ = channel.Delete()
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": channel.Id, "group": group})
}

// ListMyByokChannels — GET /api/organization/byok
func ListMyByokChannels(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	ids, err := model.ListOrgChannelIds(org.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	out := make([]gin.H, 0, len(ids))
	for _, id := range ids {
		ch, err := model.GetChannelById(id, false)
		if err != nil || ch == nil {
			continue
		}
		out = append(out, gin.H{
			"channel_id": ch.Id,
			"name":       ch.Name,
			"type":       ch.Type,
			"models":     ch.Models,
			"status":     ch.Status,
			"key_masked": maskChannelKey(ch.Key),
		})
	}
	common.ApiSuccess(c, out)
}

// DeleteMyByokChannel — DELETE /api/organization/byok/:channel_id
func DeleteMyByokChannel(c *gin.Context) {
	org, _, ok := callerOrg(c)
	if !ok {
		return
	}
	channelId, _ := strconv.Atoi(c.Param("channel_id"))
	owns, err := model.OrgOwnsChannel(org.Id, channelId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !owns {
		common.ApiErrorMsg(c, "channel does not belong to your organization")
		return
	}
	ch, err := model.GetChannelById(channelId, false)
	if err != nil || ch == nil {
		common.ApiErrorMsg(c, "channel not found")
		return
	}
	if err := ch.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.RemoveOrgChannel(org.Id, channelId)
	common.ApiSuccess(c, nil)
}

func maskChannelKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
