package setting

// WonderGate (acquiring / card + local payment) configuration.
// Docs: https://document.wondergate.io/zh/reference/introduction.html
//
// Gateway (API) hosts are fixed per environment; the admin only toggles
// Sandbox and fills in credentials. Mirrors the WCheckout layout: package-level
// vars for fast access, mutated via the option API in model.UpdateOption.
var (
	WonderGateEnabled bool
	WonderGateSandbox bool = true

	// Production credentials (Basic Auth merchantId:secretKey + appId).
	WonderGateMerchantId string
	WonderGateSecretKey  string
	WonderGateAppId      string

	// Sandbox credentials.
	WonderGateSandboxMerchantId string
	WonderGateSandboxSecretKey  string
	WonderGateSandboxAppId      string

	WonderGateUnitPrice     float64 = 1.0  // USD per quota unit
	WonderGateMinTopUp      int     = 1    // minimum top-up amount (quota units)
	WonderGateBillingCountry string = "US" // default billingAddress.country (checkout requires it)
)

const (
	wonderGateSandboxGatewayURL = "https://sandbox-securegtw.wondergate.io"
	wonderGateProdGatewayURL    = "https://securegtw-hk.wondergate.io"
)

// WonderGateGatewayBaseURL returns the API host for the active environment.
func WonderGateGatewayBaseURL() string {
	if WonderGateSandbox {
		return wonderGateSandboxGatewayURL
	}
	return wonderGateProdGatewayURL
}

// WonderGateActiveCredentials returns the merchantId / secretKey / appId for the
// active environment (sandbox vs production).
func WonderGateActiveCredentials() (merchantId, secretKey, appId string) {
	if WonderGateSandbox {
		return WonderGateSandboxMerchantId, WonderGateSandboxSecretKey, WonderGateSandboxAppId
	}
	return WonderGateMerchantId, WonderGateSecretKey, WonderGateAppId
}
