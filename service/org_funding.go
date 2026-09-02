package service

// Fork-only organization funding source (design doc: "wrouter 组织与分销架构").
// A managed account's requests are paid by its organization's wallet —
// consolidated billing, AWS-reseller style. Plugs into the existing
// FundingSource seam next to WalletFunding and SubscriptionFunding.
//
// Invariants:
//   - Reserve is a single atomic conditional UPDATE on the org wallet; an
//     insufficient balance never mutates anything.
//   - Member and workspace budgets are enforced at reserve time (hard gate);
//     the settle-overshoot path records spend past the budget instead of
//     dropping the debt, so budgets throttle FUTURE requests, never erase
//     consumed cost.
//   - Every failure path unwinds its own partial counters.

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

const BillingSourceOrgWallet = "org_wallet"

var (
	errOrgBudgetExceeded       = errors.New("org member monthly budget exceeded")
	errWorkspaceBudgetExceeded = errors.New("workspace monthly budget exceeded")
	// Distinct from ErrInsufficientWalletQuota on purpose: preConsume rewrites
	// that sentinel into a personal-quota message, which would mislead managed
	// users; this one flows through untouched and is mapped below.
	errOrgWalletInsufficient = errors.New("organization wallet quota insufficient")
)

// OrgWalletFunding charges the managing organization's wallet.
type OrgWalletFunding struct {
	orgId       int
	userId      int
	workspaceId int // 0 = token not bound to a workspace
	consumed    int // reserved org quota (for refund)
}

func (o *OrgWalletFunding) Source() string { return BillingSourceOrgWallet }

func (o *OrgWalletFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	// 1. Member budget gate.
	ok, err := model.AddOrgAccountSpend(o.orgId, o.userId, amount, true)
	if err != nil {
		return err
	}
	if !ok {
		return errOrgBudgetExceeded
	}
	// 2. Workspace budget gate (unwind member counter on failure).
	ok, err = model.AddWorkspaceSpend(o.workspaceId, amount, true)
	if err == nil && !ok {
		err = errWorkspaceBudgetExceeded
	}
	if err != nil {
		if rErr := model.ReduceOrgAccountSpend(o.orgId, o.userId, amount); rErr != nil {
			common.SysError("org funding: unwind member spend failed: " + rErr.Error())
		}
		return err
	}
	// 3. Atomic wallet reserve (unwind both counters on failure).
	reserved, err := model.TryReserveOrgQuota(o.orgId, amount)
	if err == nil && !reserved {
		err = errOrgWalletInsufficient
	}
	if err != nil {
		if rErr := model.ReduceOrgAccountSpend(o.orgId, o.userId, amount); rErr != nil {
			common.SysError("org funding: unwind member spend failed: " + rErr.Error())
		}
		if rErr := model.ReduceWorkspaceSpend(o.workspaceId, amount); rErr != nil {
			common.SysError("org funding: unwind workspace spend failed: " + rErr.Error())
		}
		return err
	}
	o.consumed = amount
	return nil
}

func (o *OrgWalletFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	if delta > 0 {
		// Overshoot: the upstream tokens are consumed; record unconditionally.
		if err := model.DecreaseOrgQuota(o.orgId, delta); err != nil {
			return err
		}
		if _, err := model.AddOrgAccountSpend(o.orgId, o.userId, delta, false); err != nil {
			common.SysError("org funding: settle member spend failed: " + err.Error())
		}
		if _, err := model.AddWorkspaceSpend(o.workspaceId, delta, false); err != nil {
			common.SysError("org funding: settle workspace spend failed: " + err.Error())
		}
		return nil
	}
	refund := -delta
	if err := model.IncreaseOrgQuota(o.orgId, refund); err != nil {
		return err
	}
	if err := model.ReduceOrgAccountSpend(o.orgId, o.userId, refund); err != nil {
		common.SysError("org funding: settle member spend reduce failed: " + err.Error())
	}
	if err := model.ReduceWorkspaceSpend(o.workspaceId, refund); err != nil {
		common.SysError("org funding: settle workspace spend reduce failed: " + err.Error())
	}
	return nil
}

func (o *OrgWalletFunding) Refund() error {
	if o.consumed <= 0 {
		return nil
	}
	// Like WalletFunding.Refund: quota += N is non-idempotent, never retry.
	if err := model.IncreaseOrgQuota(o.orgId, o.consumed); err != nil {
		return err
	}
	if err := model.ReduceOrgAccountSpend(o.orgId, o.userId, o.consumed); err != nil {
		common.SysError("org funding: refund member spend failed: " + err.Error())
	}
	if err := model.ReduceWorkspaceSpend(o.workspaceId, o.consumed); err != nil {
		common.SysError("org funding: refund workspace spend failed: " + err.Error())
	}
	return nil
}

// tryOrgBillingSession returns a session charging the managing organization
// when the user is a managed account, (nil, nil) when the user pays for
// itself, or an error that must abort the request (suspension, budget, or an
// empty org wallet — managed accounts never fall back to personal funds:
// consolidated billing would otherwise silently leak cost onto employees).
func tryOrgBillingSession(c *gin.Context, relayInfo *relaycommon.RelayInfo, preConsumedQuota int) (*BillingSession, *types.NewAPIError) {
	payer, err := model.GetOrgPayerInfo(relayInfo.UserId)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	if payer == nil {
		return nil, nil // not managed — caller proceeds with wallet/subscription
	}
	if payer.OrgStatus != model.OrgStatusActive {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("所属组织已被暂停"),
			types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
			types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
	}
	if payer.AccountStatus != model.OrgStatusActive {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("账号已被组织暂停"),
			types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
			types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
	}

	workspaceId, wsErr := model.GetTokenWorkspaceId(relayInfo.TokenId)
	if wsErr != nil {
		return nil, types.NewError(wsErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}

	session := &BillingSession{
		relayInfo: relayInfo,
		funding: &OrgWalletFunding{
			orgId:       payer.OrgId,
			userId:      relayInfo.UserId,
			workspaceId: workspaceId,
		},
	}
	if apiErr := session.preConsume(c, preConsumedQuota); apiErr != nil {
		return nil, orgFundingError(apiErr)
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("org billing: user %d charged to org %d (workspace %d)", relayInfo.UserId, payer.OrgId, workspaceId))
	return session, nil
}

// orgFundingError maps funding failures to user-readable 403s.
func orgFundingError(apiErr *types.NewAPIError) *types.NewAPIError {
	msg := apiErr.Error()
	switch {
	case errors.Is(apiErr.Err, errOrgBudgetExceeded):
		msg = "本月组织预算已用尽，请联系组织管理员调整"
	case errors.Is(apiErr.Err, errWorkspaceBudgetExceeded):
		msg = "本月 workspace 预算已用尽，请联系组织管理员调整"
	case errors.Is(apiErr.Err, errOrgWalletInsufficient):
		msg = "组织钱包余额不足，请联系组织管理员充值"
	default:
		return apiErr
	}
	return types.NewErrorWithStatusCode(
		errors.New(msg),
		types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
		types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}
