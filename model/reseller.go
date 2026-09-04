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

	"github.com/QuantumNous/new-api/common"
)

// ResellerCustomerLink is the explicit reseller⇄customer relationship. It is
// the AUTHORIZATION record (not the ledger): a reseller may fund/view only an
// org linked to it here. CustomerOrgId is UNIQUE — a customer belongs to at
// most one reseller. This is intentionally NOT a field on Organization and is
// never consulted in the request-time billing path, so billing stays single-
// hop; it only scopes reseller-console access.
type ResellerCustomerLink struct {
	Id            int   `json:"id" gorm:"primarykey"`
	ResellerOrgId int   `json:"reseller_org_id" gorm:"index;not null"`
	CustomerOrgId int   `json:"customer_org_id" gorm:"uniqueIndex;not null"`
	CreatedTime   int64 `json:"created_time"`
}

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
	// Record the authorization link before funding.
	if err := DB.Create(&ResellerCustomerLink{ResellerOrgId: resellerOrgId, CustomerOrgId: customer.Id, CreatedTime: common.GetTimestamp()}).Error; err != nil {
		DB.Delete(&Organization{}, customer.Id)
		return nil, err
	}
	// Fund it (atomic wallet move + ledger). On failure — e.g. a race drained
	// the reseller wallet after the pre-check — remove the orphan shell + link.
	if err := TransferOrgCredit(resellerOrgId, customer.Id, initialQuota, operatorId, LedgerTypeAllocate, "initial allocation"); err != nil {
		DB.Where("customer_org_id = ?", customer.Id).Delete(&ResellerCustomerLink{})
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

// ListResellerCustomers returns the reseller's linked customers, each with the
// org and the current net allocation.
func ListResellerCustomers(resellerOrgId int) ([]*ResellerCustomer, error) {
	var links []ResellerCustomerLink
	if err := DB.Where("reseller_org_id = ?", resellerOrgId).Order("id ASC").Find(&links).Error; err != nil {
		return nil, err
	}
	out := make([]*ResellerCustomer, 0, len(links))
	for _, link := range links {
		org, err := GetOrganizationById(link.CustomerOrgId)
		if err != nil || org == nil {
			continue
		}
		net, err := NetAllocatedBetween(resellerOrgId, link.CustomerOrgId)
		if err != nil {
			return nil, err
		}
		out = append(out, &ResellerCustomer{Org: org, NetAllocated: net})
	}
	return out, nil
}

// IsResellerCustomer authorizes a reseller to fund/view a customer: true only
// when an explicit link exists. A ledger allocation alone does NOT grant
// access, so a reseller can never reach an org it did not provision (e.g. by
// pushing 1 quota at a stranger org to spy on its usage).
func IsResellerCustomer(resellerOrgId, customerOrgId int) (bool, error) {
	var count int64
	err := DB.Model(&ResellerCustomerLink{}).
		Where("reseller_org_id = ? AND customer_org_id = ?", resellerOrgId, customerOrgId).
		Count(&count).Error
	return count > 0, err
}
