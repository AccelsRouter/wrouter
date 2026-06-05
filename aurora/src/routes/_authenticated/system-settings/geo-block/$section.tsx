import { createFileRoute, redirect } from '@tanstack/react-router'
import { GeoBlockSettings } from '@/features/system-settings/geo-block'
import {
  GEO_BLOCK_DEFAULT_SECTION,
  GEO_BLOCK_SECTION_IDS,
} from '@/features/system-settings/geo-block/section-registry'

export const Route = createFileRoute(
  '/_authenticated/system-settings/geo-block/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = GEO_BLOCK_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/geo-block/$section',
        params: { section: GEO_BLOCK_DEFAULT_SECTION },
      })
    }
  },
  component: GeoBlockSettings,
})
