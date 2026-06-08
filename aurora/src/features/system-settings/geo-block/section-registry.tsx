/*
Section registry for the GeoBlock admin page.
*/
import { createSectionRegistry } from '../utils/section-registry'
import { GeoBlockSection } from './geo-block-section'
import type { GeoBlockPageSettings } from './types'

const GEO_BLOCK_SECTIONS = [
  {
    id: 'restrictions',
    titleKey: 'Geo-based model restrictions',
    build: (settings: GeoBlockPageSettings) => (
      <GeoBlockSection defaultValues={settings} />
    ),
  },
] as const

export type GeoBlockSectionId = (typeof GEO_BLOCK_SECTIONS)[number]['id']

const registry = createSectionRegistry<
  GeoBlockSectionId,
  GeoBlockPageSettings
>({
  sections: GEO_BLOCK_SECTIONS,
  defaultSection: 'restrictions',
  basePath: '/system-settings/geo-block',
  urlStyle: 'path',
})

export const GEO_BLOCK_SECTION_IDS = registry.sectionIds
export const GEO_BLOCK_DEFAULT_SECTION = registry.defaultSection
export const getGeoBlockSectionNavItems = registry.getSectionNavItems
export const getGeoBlockSectionContent = registry.getSectionContent
export const getGeoBlockSectionMeta = registry.getSectionMeta
