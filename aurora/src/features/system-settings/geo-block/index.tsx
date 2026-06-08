/*
GeoBlock feature page entry. Wired into the system-settings route tree.
*/
import { SettingsPage } from '../components/settings-page'
import { DEFAULT_GEO_BLOCK_SETTINGS } from './defaults'
import {
  GEO_BLOCK_DEFAULT_SECTION,
  getGeoBlockSectionContent,
  getGeoBlockSectionMeta,
} from './section-registry'

export function GeoBlockSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/geo-block/$section'
      defaultSettings={DEFAULT_GEO_BLOCK_SETTINGS}
      defaultSection={GEO_BLOCK_DEFAULT_SECTION}
      getSectionContent={getGeoBlockSectionContent}
      getSectionMeta={getGeoBlockSectionMeta}
    />
  )
}
