import { createFileRoute, redirect } from '@tanstack/react-router'
import { GEO_BLOCK_DEFAULT_SECTION } from '@/features/system-settings/geo-block/section-registry'

export const Route = createFileRoute(
  '/_authenticated/system-settings/geo-block/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/geo-block/$section',
      params: { section: GEO_BLOCK_DEFAULT_SECTION },
    })
  },
})
