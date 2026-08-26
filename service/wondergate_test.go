package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type wonderGateSearchEntry = struct {
	Code          int    `json:"code"`
	Message       string `json:"message"`
	TransactionID string `json:"transactionId"`
	UniqueID      string `json:"uniqueId"`
}

// Regression: the /search/list/order endpoint returned OTHER orders alongside
// (or instead of) the queried transactionId; a declined order was credited off
// another order's approved entry. Crediting must require an exact
// transactionId echo — ambiguity must never yield code 100.
func TestMatchWonderGateOrderCode(t *testing.T) {
	const ours = "WG-OURS"

	tests := []struct {
		name     string
		entries  []wonderGateSearchEntry
		wantCode int
		wantErr  bool
	}{
		{
			name:    "empty result -> not found",
			entries: nil,
			wantErr: true,
		},
		{
			name: "exact match approved",
			entries: []wonderGateSearchEntry{
				{Code: WonderGateCodeTransactionSuccess, TransactionID: ours},
			},
			wantCode: WonderGateCodeTransactionSuccess,
		},
		{
			name: "exact match declined stays declined even when another order is approved",
			entries: []wonderGateSearchEntry{
				{Code: WonderGateCodeTransactionSuccess, TransactionID: "WG-OTHER-PAID"},
				{Code: WonderGateCodeTransactionDeclined, TransactionID: ours},
			},
			wantCode: WonderGateCodeTransactionDeclined,
		},
		{
			name: "filter broken: only other orders returned -> not found, never credit",
			entries: []wonderGateSearchEntry{
				{Code: WonderGateCodeTransactionSuccess, TransactionID: "WG-OTHER-PAID"},
				{Code: WonderGateCodeTransactionPending, TransactionID: "WG-OTHER-PENDING"},
			},
			wantErr: true,
		},
		{
			name: "no transactionId echo -> unmatchable, never credit",
			entries: []wonderGateSearchEntry{
				{Code: WonderGateCodeTransactionSuccess},
			},
			wantErr: true,
		},
		{
			name: "duplicate entries for ours: approved wins over earlier declined attempt",
			entries: []wonderGateSearchEntry{
				{Code: WonderGateCodeTransactionDeclined, TransactionID: ours},
				{Code: WonderGateCodeTransactionSuccess, TransactionID: ours},
			},
			wantCode: WonderGateCodeTransactionSuccess,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := wonderGateOrderSearchResult{Code: wonderGateCodeSearchSuccess, Data: tc.entries}
			code, err := matchWonderGateOrderCode(result, ours)
			if tc.wantErr {
				require.Error(t, err)
				assert.NotEqual(t, WonderGateCodeTransactionSuccess, code,
					"an error path must never report an approved code")
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantCode, code)
		})
	}
}
