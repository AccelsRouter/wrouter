import { createFileRoute } from '@tanstack/react-router'
import { TopUpAdmin } from '@/features/topup-admin'

export const Route = createFileRoute(
  '/_authenticated/system-settings/topups/'
)({
  component: TopUpAdmin,
})
