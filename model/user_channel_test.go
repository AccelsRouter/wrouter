package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The BYOK private group is per-user and IsOwnByokGroup is the ONLY seam that
// lets a request reach it, so it must match solely the caller's own id — never
// another user's group, and never a non-BYOK group.
func TestIsOwnByokGroupIsolation(t *testing.T) {
	assert.Equal(t, "user-7", UserPrivateGroup(7))

	assert.True(t, IsOwnByokGroup(7, "user-7"), "owner reaches its own group")
	assert.False(t, IsOwnByokGroup(7, "user-8"), "must never reach another user's group")
	assert.False(t, IsOwnByokGroup(8, "user-7"), "must never reach another user's group")
	assert.False(t, IsOwnByokGroup(7, "default"), "a normal group is not a BYOK group")
	assert.False(t, IsOwnByokGroup(7, ""), "empty group is never a BYOK group")
}

// Ownership gates every personal-BYOK channel operation.
func TestUserChannelOwnership(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserChannel{}))
	DB.Exec("DELETE FROM user_channels")

	require.NoError(t, AddUserChannel(7, 100))
	require.NoError(t, AddUserChannel(7, 101))
	require.NoError(t, AddUserChannel(8, 200))

	owns, err := UserOwnsChannel(7, 100)
	require.NoError(t, err)
	assert.True(t, owns)

	// A user cannot own another user's channel.
	owns, err = UserOwnsChannel(7, 200)
	require.NoError(t, err)
	assert.False(t, owns, "cross-user channel access must be denied")

	ids, err := ListUserChannelIds(7)
	require.NoError(t, err)
	assert.ElementsMatch(t, []int{100, 101}, ids)

	count, err := CountUserChannels(7)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	// Removing a channel you don't own fails; removing your own succeeds.
	require.Error(t, RemoveUserChannel(7, 200))
	require.NoError(t, RemoveUserChannel(7, 100))
	count, _ = CountUserChannels(7)
	assert.Equal(t, int64(1), count)

	// TokenId is unique: a channel can be owned by at most one user.
	require.Error(t, AddUserChannel(9, 101), "a channel is owned by exactly one user")
}
