// Enterprise inquiry proxy to Lark webhook.
//
// This file is intentionally isolated so upstream merges never touch it.
// The only upstream integration point is one route registration in
// router/api-router.go.
package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/gin-gonic/gin"
)

const (
	larkWebhookEnvVar  = "LARK_ENTERPRISE_WEBHOOK_URL"
	larkRequestTimeout = 8 * time.Second
)

type enterpriseInquiryRequest struct {
	Name           string   `json:"name"`
	Company        string   `json:"company"`
	WorkEmail      string   `json:"work_email"`
	Country        string   `json:"country"`
	MonthlyVolume  string   `json:"monthly_volume"`
	ModelsInterest []string `json:"models_interest"`
	UseCase        string   `json:"use_case"`
	Source         string   `json:"source"`
}

type larkCardPayload struct {
	MsgType string         `json:"msg_type"`
	Card    map[string]any `json:"card"`
}

// PostEnterpriseInquiry receives the form payload from aurora's /enterprise
// page and forwards a Lark interactive card to the configured webhook.
//
// The webhook URL is loaded from LARK_ENTERPRISE_WEBHOOK_URL at request time
// (not at startup) so operators can rotate it without restarting the server.
func PostEnterpriseInquiry(c *gin.Context) {
	webhookURL := strings.TrimSpace(os.Getenv(larkWebhookEnvVar))
	if webhookURL == "" {
		logger.LogError(c.Request.Context(), "enterprise inquiry rejected: "+larkWebhookEnvVar+" not set")
		common.ApiError(c, fmt.Errorf("enterprise contact is not configured"))
		return
	}

	var req enterpriseInquiryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, fmt.Errorf("invalid payload: %w", err))
		return
	}

	// Minimal server-side validation. Frontend already validates with zod,
	// but never trust the client.
	req.Name = strings.TrimSpace(req.Name)
	req.Company = strings.TrimSpace(req.Company)
	req.WorkEmail = strings.TrimSpace(req.WorkEmail)
	req.Country = strings.TrimSpace(req.Country)
	req.UseCase = strings.TrimSpace(req.UseCase)
	if req.Name == "" || req.Company == "" || req.WorkEmail == "" ||
		req.Country == "" || req.UseCase == "" {
		common.ApiError(c, fmt.Errorf("missing required fields"))
		return
	}
	if !strings.Contains(req.WorkEmail, "@") {
		common.ApiError(c, fmt.Errorf("invalid work email"))
		return
	}
	if len(req.UseCase) > 4000 {
		common.ApiError(c, fmt.Errorf("use case too long"))
		return
	}

	card := buildLarkCard(&req, c.ClientIP(), c.Request.UserAgent())
	body, err := common.Marshal(larkCardPayload{MsgType: "interactive", Card: card})
	if err != nil {
		common.ApiError(c, fmt.Errorf("failed to encode webhook payload: %w", err))
		return
	}

	httpReq, err := http.NewRequestWithContext(c.Request.Context(),
		http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		common.ApiError(c, fmt.Errorf("failed to build webhook request: %w", err))
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: larkRequestTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(),
			fmt.Sprintf("enterprise inquiry webhook POST failed: %v", err))
		common.ApiError(c, fmt.Errorf("failed to reach contact service, please try again later"))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		// Read up to 1KB of body for log diagnostics; don't expose to client.
		preview, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		logger.LogError(c.Request.Context(),
			fmt.Sprintf("enterprise inquiry webhook returned %d: %s",
				resp.StatusCode, string(preview)))
		common.ApiError(c, fmt.Errorf("contact service returned an error, please try again later"))
		return
	}

	common.ApiSuccess(c, gin.H{"submitted": true})
}

// buildLarkCard returns a Lark "interactive" card body. Lark webhook expects a
// "card" object at the top level when msg_type=interactive.
func buildLarkCard(req *enterpriseInquiryRequest, clientIP, userAgent string) map[string]any {
	models := strings.Join(req.ModelsInterest, ", ")
	if models == "" {
		models = "-"
	}
	volume := req.MonthlyVolume
	if strings.TrimSpace(volume) == "" {
		volume = "-"
	}
	source := req.Source
	if strings.TrimSpace(source) == "" {
		source = "-"
	}

	fieldsMarkdown := strings.Join([]string{
		fmt.Sprintf("**Name**\n%s", escapeLark(req.Name)),
		fmt.Sprintf("**Company**\n%s", escapeLark(req.Company)),
		fmt.Sprintf("**Work Email**\n%s", escapeLark(req.WorkEmail)),
		fmt.Sprintf("**Country / Region**\n%s", escapeLark(req.Country)),
		fmt.Sprintf("**Expected Monthly Volume (USD)**\n%s", escapeLark(volume)),
		fmt.Sprintf("**Models of Interest**\n%s", escapeLark(models)),
		fmt.Sprintf("**Source**\n%s", escapeLark(source)),
		fmt.Sprintf("**Use Case**\n%s", escapeLark(req.UseCase)),
	}, "\n\n")

	footer := fmt.Sprintf("Submitted %s · IP %s · UA %s",
		time.Now().UTC().Format(time.RFC3339), clientIP, truncate(userAgent, 80))

	return map[string]any{
		"config": map[string]any{
			"wide_screen_mode": true,
		},
		"header": map[string]any{
			"template": "blue",
			"title": map[string]any{
				"tag":     "plain_text",
				"content": "🏢 New Enterprise Inquiry",
			},
		},
		"elements": []any{
			map[string]any{
				"tag": "div",
				"text": map[string]any{
					"tag":     "lark_md",
					"content": fieldsMarkdown,
				},
			},
			map[string]any{"tag": "hr"},
			map[string]any{
				"tag": "note",
				"elements": []any{
					map[string]any{
						"tag":     "plain_text",
						"content": footer,
					},
				},
			},
		},
	}
}

// escapeLark replaces characters that would break Lark markdown rendering.
func escapeLark(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	// Lark lark_md treats bare newlines literally, no escape needed.
	// Just avoid raw control chars.
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
