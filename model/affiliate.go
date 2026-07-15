// Fork-only: list the users a given user has invited, for the wallet
// referral panel. Invitation time is the invitee's registration time
// (users.created_at). Only non-sensitive fields are exposed.
package model

import "github.com/QuantumNous/new-api/common"

// InvitedUser is a lightweight, privacy-safe view of an invited user.
type InvitedUser struct {
	Id          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	CreatedAt   int64  `json:"created_at"` // registration time == invitation time
}

// ListInvitedUsers returns paginated users whose inviter_id equals inviterId,
// newest first, along with the total count.
func ListInvitedUsers(
	inviterId int,
	page *common.PageInfo,
) ([]*InvitedUser, int64, error) {
	var total int64
	if err := DB.Model(&User{}).
		Where("inviter_id = ?", inviterId).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []*InvitedUser
	err := DB.Model(&User{}).
		Where("inviter_id = ?", inviterId).
		Select("id, username, display_name, created_at").
		Order("id DESC").
		Limit(page.GetPageSize()).
		Offset(page.GetStartIdx()).
		Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}
