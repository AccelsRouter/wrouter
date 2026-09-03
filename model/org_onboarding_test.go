package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A user opens their OWN org by applying + approval; approval creates the org
// and makes the applicant its owner. The applicant must be unmanaged, and
// re-approving a processed application is a no-op.
func TestOrgApplicationApproval(t *testing.T) {
	migrateOrgTables(t)

	app := &OrgApplication{UserId: 100, Type: OrgTypeReseller, OrgName: "acme-reseller"}
	require.NoError(t, CreateOrgApplication(app))

	// One pending application per user.
	dup := &OrgApplication{UserId: 100, Type: OrgTypeEnterprise, OrgName: "acme-2"}
	require.Error(t, CreateOrgApplication(dup))

	org, err := ApproveOrgApplication(app.Id, 1, "partner-a", "ok")
	require.NoError(t, err)
	require.NotNil(t, org)
	assert.Equal(t, OrgTypeReseller, org.Type)
	assert.Equal(t, "partner-a", org.PriceGroup)
	assert.Equal(t, 100, org.OwnerUserId)

	// Applicant is now the org owner and resolves as its own payer.
	info, err := GetOrgPayerInfo(100)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, org.Id, info.OrgId)

	// Re-approving the same (now approved) application fails.
	_, err = ApproveOrgApplication(app.Id, 1, "", "")
	require.Error(t, err)

	// A user already in an org cannot apply again (valid name, so the failure
	// is the already-managed guard, not name validation).
	require.Error(t, CreateOrgApplication(&OrgApplication{UserId: 100, Type: OrgTypeEnterprise, OrgName: "another-org"}))
}

// Org names must be at least 3 characters and free of special characters.
func TestValidateOrgName(t *testing.T) {
	require.NoError(t, ValidateOrgName("acme"))
	require.NoError(t, ValidateOrgName("Acme Corp"))
	require.NoError(t, ValidateOrgName("acme-2_test"))
	require.NoError(t, ValidateOrgName("北京团队"))    // CJK letters count
	require.NoError(t, ValidateOrgName("  abc  ")) // trimmed to 3

	require.Error(t, ValidateOrgName(""))
	require.Error(t, ValidateOrgName("ab"))       // < 3
	require.Error(t, ValidateOrgName("acme!"))    // special char
	require.Error(t, ValidateOrgName("a@b.com"))  // special chars
	require.Error(t, ValidateOrgName("<script>")) // special chars
}

// Default onboarding policy mirrors OpenRouter: an enterprise org opens
// instantly (self-serve), while a reseller stays review-gated. This guards the
// product decision that opening an enterprise org needs no human approval but
// granting reseller (which can allocate credit to other orgs) does.
func TestDefaultOrgAutoApprovePolicy(t *testing.T) {
	assert.True(t, OrgTypeAutoApproves(OrgTypeEnterprise), "enterprise must open instantly by default")
	assert.False(t, OrgTypeAutoApproves(OrgTypeReseller), "reseller must stay review-gated by default")
}

// Invitations are consent tokens: only the accepting user is attached, an
// invite is single-use, and a user already in an org cannot accept.
func TestOrgInvitationConsent(t *testing.T) {
	migrateOrgTables(t)
	org := mustCreateOrg(t, "acme", OrgTypeEnterprise, 0)

	inv := &OrgInvitation{OrgId: org.Id, Relation: OrgRelationMember, Role: OrgRoleMember, MonthlyBudget: 500, CreatedBy: 1}
	require.NoError(t, CreateOrgInvitation(inv))
	assert.NotEmpty(t, inv.Code)

	// A random user accepts → becomes a managed member.
	accepted, err := AcceptOrgInvitation(inv.Code, 55)
	require.NoError(t, err)
	assert.Equal(t, org.Id, accepted.OrgId)
	info, err := GetOrgPayerInfo(55)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, org.Id, info.OrgId)
	assert.Equal(t, 500, info.MonthlyBudget)

	// Single-use: the same code cannot be accepted again.
	_, err = AcceptOrgInvitation(inv.Code, 66)
	require.Error(t, err)

	// A user already in an org cannot accept a new invite.
	inv2 := &OrgInvitation{OrgId: org.Id, Relation: OrgRelationMember, Role: OrgRoleMember, CreatedBy: 1}
	require.NoError(t, CreateOrgInvitation(inv2))
	_, err = AcceptOrgInvitation(inv2.Code, 55)
	require.Error(t, err, "an already-managed user cannot be double-attached")

	// Revoked invites cannot be accepted.
	inv3 := &OrgInvitation{OrgId: org.Id, Relation: OrgRelationMember, Role: OrgRoleMember, CreatedBy: 1}
	require.NoError(t, CreateOrgInvitation(inv3))
	require.NoError(t, RevokeOrgInvitation(org.Id, inv3.Id))
	_, err = AcceptOrgInvitation(inv3.Code, 77)
	require.Error(t, err)

	// An invite can only be revoked by its owning org.
	other := mustCreateOrg(t, "other", OrgTypeEnterprise, 0)
	inv4 := &OrgInvitation{OrgId: org.Id, Relation: OrgRelationMember, Role: OrgRoleMember, CreatedBy: 1}
	require.NoError(t, CreateOrgInvitation(inv4))
	require.Error(t, RevokeOrgInvitation(other.Id, inv4.Id), "a foreign org cannot revoke another org's invite")
}
