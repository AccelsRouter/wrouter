package system_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// ThemeSettings holds the active frontend theme. This fork keeps a runtime
// theme switch (upstream removed it in v1.0.0-rc.22): "aurora" is the custom
// product frontend and the default; "default" falls back to the upstream
// dashboard. The value is persisted as the "theme.frontend" option and applied
// to common.SetTheme after each database load (see loadOptionsFromDatabase).
type ThemeSettings struct {
	Frontend string `json:"frontend"`
}

var themeSettings = ThemeSettings{
	Frontend: "aurora",
}

func init() {
	config.GlobalConfig.Register("theme", &themeSettings)
	syncThemeToCommon()
}

func syncThemeToCommon() {
	common.SetTheme(themeSettings.Frontend)
}

func GetThemeSettings() *ThemeSettings {
	return &themeSettings
}

// UpdateAndSyncTheme applies the theme config to common after a DB load.
func UpdateAndSyncTheme() {
	syncThemeToCommon()
}
