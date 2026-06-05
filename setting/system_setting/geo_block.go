// Geo-based model access restrictions.
//
// Used by middleware/geo_block.go to deny requests from specific countries
// when the requested model matches a configured family. Country is taken
// from the `CloudFront-Viewer-Country` header (CF-IPCountry as fallback).
//
// This file is fork-local: upstream syncs never touch it.
package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// GeoBlockFamily groups a set of model-name prefixes (e.g. "gpt-", "o1-")
// under a single label and pairs them with a list of ISO 3166-1 alpha-2
// country codes that should be denied access.
type GeoBlockFamily struct {
	Key              string   `json:"key"`               // stable identifier, used as map key
	Label            string   `json:"label"`             // display name shown in admin UI
	Prefixes         []string `json:"prefixes"`          // model-name prefixes (case-insensitive match)
	BlockedCountries []string `json:"blocked_countries"` // ISO 3166-1 alpha-2 codes (uppercase)
}

// GeoBlockSettings is the full configuration persisted under the
// "geo_block" key in the global option map.
type GeoBlockSettings struct {
	Enabled  bool             `json:"enabled"`
	Families []GeoBlockFamily `json:"families"`
}

var defaultGeoBlockSettings = GeoBlockSettings{
	Enabled: false, // operators must explicitly opt in
	Families: []GeoBlockFamily{
		{
			Key:              "openai",
			Label:            "OpenAI",
			Prefixes:         []string{"gpt-", "o1-", "o3-", "o4-", "chatgpt-", "text-embedding-", "dall-e-", "tts-", "whisper-"},
			BlockedCountries: []string{"CN", "HK"},
		},
		{
			Key:              "claude",
			Label:            "Anthropic Claude",
			Prefixes:         []string{"claude-"},
			BlockedCountries: []string{"CN", "HK"},
		},
		{
			Key:              "gemini",
			Label:            "Google Gemini",
			Prefixes:         []string{"gemini-", "imagen-", "veo-"},
			BlockedCountries: []string{"CN", "HK"},
		},
		{
			Key:              "grok",
			Label:            "xAI Grok",
			Prefixes:         []string{"grok-"},
			BlockedCountries: []string{"CN", "HK"},
		},
	},
}

func init() {
	config.GlobalConfig.Register("geo_block", &defaultGeoBlockSettings)
}

// GetGeoBlockSettings returns a pointer to the live settings struct. Callers
// should treat the returned value as read-only.
func GetGeoBlockSettings() *GeoBlockSettings {
	return &defaultGeoBlockSettings
}
