package service

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type wonderGateSearchEntry = struct {
	Code          int    `json:"code"`
	Message       string `json:"message"`
	TransactionID string `json:"transactionId"`
	UniqueID      string `json:"uniqueId"`
}

// Contract test against the documented notification signing scheme: sort all
// parameters except sign by key ASCII order, concatenate the non-empty values,
// append the SecretKey, SHA256-hex. A drift here would silently 401 every
// genuine gateway notification.
func TestVerifyWonderGateNotification(t *testing.T) {
	origSandbox := setting.WonderGateSandbox
	origSecret := setting.WonderGateSandboxSecretKey
	setting.WonderGateSandbox = true
	setting.WonderGateSandboxSecretKey = "test-secret"
	t.Cleanup(func() {
		setting.WonderGateSandbox = origSandbox
		setting.WonderGateSandboxSecretKey = origSecret
	})

	// Keys in ASCII order: appId, code, timestamp, transactionAmount,
	// transactionCurrency, transactionId, transactionType, uniqueId.
	// emptyField ("") and the nested object are excluded per spec; numbers
	// keep their raw JSON form.
	concat := "77" + "100" + "1756180000" + "20.00" + "USD" + "WG-SIGN-TEST" + "Sale" + "987654321" + "test-secret"
	sum := sha256.Sum256([]byte(concat))
	sign := hex.EncodeToString(sum[:])

	body := `{
		"appId": 77,
		"code": 100,
		"timestamp": 1756180000,
		"transactionAmount": "20.00",
		"transactionCurrency": "USD",
		"transactionId": "WG-SIGN-TEST",
		"transactionType": "Sale",
		"uniqueId": "987654321",
		"emptyField": "",
		"billingAddress": {"country": "US"},
		"sign": "` + sign + `"
	}`

	fields, err := VerifyWonderGateNotification([]byte(body))
	require.NoError(t, err, "a correctly signed notification must verify")
	code, ok := WonderGateNotificationInt(fields, "code")
	require.True(t, ok)
	assert.Equal(t, WonderGateCodeTransactionSuccess, code)

	tampered := []byte(`{"appId":77,"code":100,"timestamp":1756180000,"transactionAmount":"99.00","transactionCurrency":"USD","transactionId":"WG-SIGN-TEST","transactionType":"Sale","uniqueId":"987654321","sign":"` + sign + `"}`)
	_, err = VerifyWonderGateNotification(tampered)
	require.Error(t, err, "a tampered amount must fail verification")

	_, err = VerifyWonderGateNotification([]byte(`{"code":100}`))
	require.Error(t, err, "a notification without sign must be rejected")
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
