package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// migrateOrgTables makes the org schema available on the shared in-memory
// test DB (TestMain lives in task_cas_test.go).
func migrateOrgTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&Organization{}, &OrgAccount{}, &CreditLedger{}, &Workspace{}, &WorkspaceToken{}, &OrgChannel{},
	))
	// isolate between tests
	DB.Exec("DELETE FROM organizations")
	DB.Exec("DELETE FROM org_accounts")
	DB.Exec("DELETE FROM credit_ledgers")
	DB.Exec("DELETE FROM workspaces")
	DB.Exec("DELETE FROM workspace_tokens")
}

func mustCreateOrg(t *testing.T, name, typ string, wallet int) *Organization {
	t.Helper()
	org := &Organization{Name: name, Type: typ, OwnerUserId: 1}
	require.NoError(t, CreateOrganization(org))
	if wallet > 0 {
		require.NoError(t, PlatformCreditOrg(org.Id, wallet, 1, "test-credit", "seed"))
	}
	fresh, err := GetOrganizationById(org.Id)
	require.NoError(t, err)
	return fresh
}

// The org wallet is the payer for consolidated billing: reserves must be
// atomic and an insufficient balance must never mutate anything.
func TestOrgWalletReserve(t *testing.T) {
	migrateOrgTables(t)
	org := mustCreateOrg(t, "acme", OrgTypeEnterprise, 100)

	ok, err := TryReserveOrgQuota(org.Id, 60)
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = TryReserveOrgQuota(org.Id, 41) // only 40 left
	require.NoError(t, err)
	assert.False(t, ok, "insufficient balance must not reserve")

	fresh, _ := GetOrganizationById(org.Id)
	assert.Equal(t, 40, fresh.WalletQuota, "failed reserve must not change the wallet")

	// A suspended org must not reserve even with balance.
	require.NoError(t, UpdateOrganizationFields(org.Id, map[string]interface{}{"status": OrgStatusSuspended}))
	ok, err = TryReserveOrgQuota(org.Id, 1)
	require.NoError(t, err)
	assert.False(t, ok)

	// Negative amounts are rejected outright.
	_, err = TryReserveOrgQuota(org.Id, -5)
	require.Error(t, err)
}

// Budgets gate reserves hard, record settle-overshoot unconditionally, and
// roll over between periods.
func TestOrgAccountBudget(t *testing.T) {
	migrateOrgTables(t)
	org := mustCreateOrg(t, "acme", OrgTypeEnterprise, 0)
	require.NoError(t, AttachOrgAccount(&OrgAccount{
		OrgId: org.Id, UserId: 42, Relation: OrgRelationMember, Role: OrgRoleMember, MonthlyBudget: 100,
	}))

	ok, err := AddOrgAccountSpend(org.Id, 42, 80, true)
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = AddOrgAccountSpend(org.Id, 42, 30, true) // 80+30 > 100
	require.NoError(t, err)
	assert.False(t, ok, "budget must gate the reserve path")

	// Settle overshoot records past the budget instead of dropping the debt.
	ok, err = AddOrgAccountSpend(org.Id, 42, 30, false)
	require.NoError(t, err)
	assert.True(t, ok)

	var acc OrgAccount
	require.NoError(t, DB.Where("org_id = ? AND user_id = ?", org.Id, 42).First(&acc).Error)
	assert.Equal(t, 110, acc.PeriodSpend)

	// Refund path floors at zero.
	require.NoError(t, ReduceOrgAccountSpend(org.Id, 42, 500))
	require.NoError(t, DB.Where("org_id = ? AND user_id = ?", org.Id, 42).First(&acc).Error)
	assert.Equal(t, 0, acc.PeriodSpend)

	// Period rollover resets the counter and re-opens the budget.
	require.NoError(t, DB.Model(&OrgAccount{}).Where("user_id = ?", 42).
		Updates(map[string]interface{}{"period_key": "200001", "period_spend": 999}).Error)
	ok, err = AddOrgAccountSpend(org.Id, 42, 10, true)
	require.NoError(t, err)
	assert.True(t, ok, "a new period must reset the counter")
	require.NoError(t, DB.Where("org_id = ? AND user_id = ?", org.Id, 42).First(&acc).Error)
	assert.Equal(t, 10, acc.PeriodSpend)
}

// Ledger transfers are all-or-nothing and bounded by the source's unconsumed
// balance; every movement appends exactly one ledger row.
func TestTransferOrgCredit(t *testing.T) {
	migrateOrgTables(t)
	reseller := mustCreateOrg(t, "reseller", OrgTypeReseller, 100)
	customer := mustCreateOrg(t, "customer", OrgTypeEnterprise, 0)

	require.NoError(t, TransferOrgCredit(reseller.Id, customer.Id, 60, 1, LedgerTypeAllocate, ""))
	r, _ := GetOrganizationById(reseller.Id)
	c, _ := GetOrganizationById(customer.Id)
	assert.Equal(t, 40, r.WalletQuota)
	assert.Equal(t, 60, c.WalletQuota)

	// Over-allocation fails atomically: neither wallet changes.
	err := TransferOrgCredit(reseller.Id, customer.Id, 41, 1, LedgerTypeAllocate, "")
	require.Error(t, err)
	r, _ = GetOrganizationById(reseller.Id)
	c, _ = GetOrganizationById(customer.Id)
	assert.Equal(t, 40, r.WalletQuota)
	assert.Equal(t, 60, c.WalletQuota)

	// Revoke is bounded by the target's unconsumed balance.
	err = TransferOrgCredit(customer.Id, reseller.Id, 61, 1, LedgerTypeRevoke, "")
	require.Error(t, err, "revoke may only reclaim unconsumed balance")
	require.NoError(t, TransferOrgCredit(customer.Id, reseller.Id, 60, 1, LedgerTypeRevoke, ""))

	// Guards.
	require.Error(t, TransferOrgCredit(reseller.Id, reseller.Id, 1, 1, LedgerTypeAllocate, ""))
	require.Error(t, TransferOrgCredit(reseller.Id, customer.Id, 0, 1, LedgerTypeAllocate, ""))
	require.Error(t, TransferOrgCredit(reseller.Id, customer.Id, 1, 1, "consume", ""))

	var count int64
	DB.Model(&CreditLedger{}).Count(&count)
	assert.Equal(t, int64(3), count, "seed purchase + allocate + revoke")
}

// UNIQUE(user_id): one account has exactly one payer, ever.
func TestOrgAccountUniquePayer(t *testing.T) {
	migrateOrgTables(t)
	a := mustCreateOrg(t, "org-a", OrgTypeEnterprise, 0)
	b := mustCreateOrg(t, "org-b", OrgTypeReseller, 0)

	require.NoError(t, AttachOrgAccount(&OrgAccount{OrgId: a.Id, UserId: 7, Relation: OrgRelationMember, Role: OrgRoleMember}))
	err := AttachOrgAccount(&OrgAccount{OrgId: b.Id, UserId: 7, Relation: OrgRelationCustomer, Role: OrgRoleMember})
	require.Error(t, err, "a second payer for the same user must be rejected by the schema")

	// Payer resolution reflects attach/detach through cache invalidation.
	info, err := GetOrgPayerInfo(7)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, a.Id, info.OrgId)

	require.NoError(t, DetachOrgAccount(a.Id, 7))
	info, err = GetOrgPayerInfo(7)
	require.NoError(t, err)
	assert.Nil(t, info, "detached user pays for itself again")
}

// Workspace budgets mirror member budgets and bind tokens uniquely.
func TestWorkspaceBudgetAndBinding(t *testing.T) {
	migrateOrgTables(t)
	org := mustCreateOrg(t, "acme", OrgTypeEnterprise, 0)
	ws := &Workspace{OrgId: org.Id, Name: "prod", MonthlyBudget: 50}
	require.NoError(t, CreateWorkspace(ws))

	ok, err := AddWorkspaceSpend(ws.Id, 50, true)
	require.NoError(t, err)
	assert.True(t, ok)
	ok, err = AddWorkspaceSpend(ws.Id, 1, true)
	require.NoError(t, err)
	assert.False(t, ok, "workspace budget must gate")

	// Unbound tokens (workspaceId 0) are a no-op gate.
	ok, err = AddWorkspaceSpend(0, 100, true)
	require.NoError(t, err)
	assert.True(t, ok)

	// Token binding is unique; rebinding moves the token.
	require.NoError(t, BindTokenToWorkspace(org.Id, ws.Id, 900))
	ws2 := &Workspace{OrgId: org.Id, Name: "staging"}
	require.NoError(t, CreateWorkspace(ws2))
	require.NoError(t, BindTokenToWorkspace(org.Id, ws2.Id, 900))
	got, err := GetTokenWorkspaceId(900)
	require.NoError(t, err)
	assert.Equal(t, ws2.Id, got)

	require.NoError(t, UnbindTokenFromWorkspace(900))
	got, err = GetTokenWorkspaceId(900)
	require.NoError(t, err)
	assert.Equal(t, 0, got)
}
