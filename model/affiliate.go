// Fork-only: list the users a given user has invited, for the wallet
// referral panel. Invitation time is the invitee's registration time
// (users.created_at). Only non-sensitive fields are exposed — in particular
// HasToppedUp is a boolean only; top-up amounts are never returned.
package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// maskIdentifier hides the middle of a name for privacy, keeping only the
// first and last character with '*' in between (rune-aware for CJK names).
//   - "" -> ""      "a" -> "a"      "ab" -> "a*"
//   - "johndoe" -> "j*****e"
func maskIdentifier(s string) string {
	r := []rune(s)
	switch n := len(r); {
	case n <= 1:
		return s
	case n == 2:
		return string(r[0]) + "*"
	default:
		return string(r[0]) + strings.Repeat("*", n-2) + string(r[n-1])
	}
}

// InvitedUser is a lightweight, privacy-safe view of an invited user.
type InvitedUser struct {
	Id          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	CreatedAt   int64  `json:"created_at"`    // registration time == invitation time
	HasToppedUp bool   `json:"has_topped_up"` // any successful top-up (boolean only)
}

// ListInvitedUsers returns paginated users whose inviter_id equals inviterId,
// newest first, along with the total count. Each row is flagged with whether
// the invitee has at least one successful top-up (no amounts exposed).
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
	if len(rows) == 0 {
		return rows, total, nil
	}

	// Flag invitees that have at least one successful top-up. A separate
	// set query (instead of a correlated EXISTS) keeps the boolean result
	// portable across SQLite/MySQL/PostgreSQL.
	ids := make([]int, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.Id)
	}
	var toppedUpIds []int
	if err := DB.Model(&TopUp{}).
		Where("user_id IN ? AND status = ?", ids, common.TopUpStatusSuccess).
		Distinct("user_id").
		Pluck("user_id", &toppedUpIds).Error; err != nil {
		return nil, 0, err
	}
	toppedUp := make(map[int]struct{}, len(toppedUpIds))
	for _, id := range toppedUpIds {
		toppedUp[id] = struct{}{}
	}
	for _, r := range rows {
		if _, ok := toppedUp[r.Id]; ok {
			r.HasToppedUp = true
		}
		// Mask identities before they leave the server — the inviter should
		// not see other users' full usernames / display names.
		r.Username = maskIdentifier(r.Username)
		r.DisplayName = maskIdentifier(r.DisplayName)
	}

	return rows, total, nil
}
