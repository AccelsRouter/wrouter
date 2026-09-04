// Fork-only reseller (distributor) customer management, layered on the existing
// org credit primitives. A reseller is an Organization of type "reseller" that
// provisions downstream CUSTOMER orgs and funds them from its own wallet via
// the append-only credit_ledger. There is no parent link on Organization — the
// reseller⇄customer relationship lives only in the ledger, so request-time
// billing stays single-hop (a customer's own wallet pays for its usage). Margin
// is realized off-platform: the reseller buys quota at wholesale and its
// customers consume at their own (retail) price group.
package model

import (
	"errors"

	"gorm.io/gorm"
)

// ResellerCustomer is one row of a reseller's customer list: the customer org
// plus how much the reseller has net-allocated to it (allocated − revoked).
type ResellerCustomer struct {
	Org          *Organization `json:"org"`
	NetAllocated int           `json:"net_allocated"`
}

// CreateResellerCustomer provisions a customer org (type enterprise, retail
// price group) and seeds it with an initial allocation from the reseller's
// wallet. The initial allocation both funds the customer and establishes the
// ledger relationship that makes it appear in the reseller's customer list.
// The customer starts ownerless (a reseller-managed shell); its owner is
// onboarded separately via the invitation flow.
func CreateResellerCustomer(resellerOrgId int, name, priceGroup string, initialQuota, operatorId int) (*Organization, error) {
	reseller, err := GetOrganizationById(resellerOrgId)
	if err != nil {
		return nil, err
	}
	if reseller == nil || reseller.Type != OrgTypeReseller {
		return nil, errors.New("只有代理商组织可以创建客户")
	}
	if initialQuota <= 0 {
		return nil, errors.New("初始划拨额度必须为正")
	}
	if reseller.WalletQuota < initialQuota {
		return nil, errors.New("代理商钱包余额不足")
	}
	if priceGroup == "" {
		priceGroup = "default"
	}
	customer := &Organization{Name: name, Type: OrgTypeEnterprise, PriceGroup: priceGroup}
	if err := CreateOrganization(customer); err != nil {
		return nil, err
	}
	// Fund it (atomic wallet move + ledger). On failure — e.g. a race drained
	// the reseller wallet after the pre-check — remove the orphan shell.
	if err := TransferOrgCredit(resellerOrgId, customer.Id, initialQuota, operatorId, LedgerTypeAllocate, "initial allocation"); err != nil {
		DB.Delete(&Organization{}, customer.Id)
		return nil, err
	}
	// Re-fetch so the returned org reflects the funded wallet (TransferOrgCredit
	// updated the DB row, not the in-memory struct).
	if fresh, err := GetOrganizationById(customer.Id); err == nil && fresh != nil {
		customer = fresh
	}
	return customer, nil
}

// ListResellerCustomers returns every org the reseller has ever allocated to
// (its customers), each with the org and the current net allocation. Derived
// from the ledger — no parent link.
func ListResellerCustomers(resellerOrgId int) ([]*ResellerCustomer, error) {
	var customerIds []int
	if err := DB.Model(&CreditLedger{}).
		Where("from_org_id = ? AND type = ?", resellerOrgId, LedgerTypeAllocate).
		Distinct().Pluck("to_org_id", &customerIds).Error; err != nil {
		return nil, err
	}
	out := make([]*ResellerCustomer, 0, len(customerIds))
	for _, id := range customerIds {
		org, err := GetOrganizationById(id)
		if err != nil || org == nil {
			continue
		}
		net, err := NetAllocatedBetween(resellerOrgId, id)
		if err != nil {
			return nil, err
		}
		out = append(out, &ResellerCustomer{Org: org, NetAllocated: net})
	}
	return out, nil
}

// IsResellerCustomer authorizes a reseller to view/manage a customer: true when
// the reseller has ever allocated credit to it. Prevents a reseller from
// reaching arbitrary orgs it has no relationship with.
func IsResellerCustomer(resellerOrgId, customerOrgId int) (bool, error) {
	var count int64
	err := DB.Model(&CreditLedger{}).
		Where("from_org_id = ? AND to_org_id = ? AND type = ?", resellerOrgId, customerOrgId, LedgerTypeAllocate).
		Count(&count).Error
	if err == gorm.ErrRecordNotFound {
		return false, nil
	}
	return count > 0, err
}
