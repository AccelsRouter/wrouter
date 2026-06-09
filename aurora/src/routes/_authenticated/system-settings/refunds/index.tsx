import { createFileRoute } from '@tanstack/react-router'
import { RefundAdmin } from '@/features/refund-admin'

export const Route = createFileRoute(
  '/_authenticated/system-settings/refunds/'
)({
  component: RefundAdmin,
})
