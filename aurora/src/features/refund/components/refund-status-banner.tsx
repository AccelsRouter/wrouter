/*
Banner shown above wallet stats when the user has an active refund
request (pending or approved). Provides quick cancel for pending.
*/
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cancelRefundRequest, fetchActiveRefundRequest } from '../api'

export function RefundStatusBanner() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const { data: active } = useQuery({
    queryKey: ['refund-active'],
    queryFn: fetchActiveRefundRequest,
    staleTime: 30_000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelRefundRequest(id),
    onSuccess: () => {
      toast.success(t('Refund request cancelled'))
      queryClient.invalidateQueries({ queryKey: ['refund-active'] })
      queryClient.invalidateQueries({ queryKey: ['refund-precheck'] })
      queryClient.invalidateQueries({ queryKey: ['user-tokens'] })
      setConfirming(false)
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t('Failed to cancel'))
    },
  })

  if (!active) return null

  const isPending = active.status === 'pending'
  const isApproved = active.status === 'approved'

  const Icon = isApproved ? Check : Clock
  const tone = isApproved
    ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10'
    : 'border-blue-500/40 bg-blue-50/50 dark:bg-blue-500/10'

  return (
    <div
      className={`${tone} flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className='flex items-start gap-3'>
        <Icon
          className={
            isApproved
              ? 'mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400'
              : 'mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400'
          }
        />
        <div className='flex flex-col gap-0.5'>
          <p className='text-sm font-medium'>
            {isApproved
              ? t('Refund approved · awaiting payout')
              : t('Refund request pending review')}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Refund #{{id}} · ${{amount}} USD · submitted {{when}}',
              {
                id: active.id,
                amount: active.amount_usd.toFixed(2),
                when: formatRelativeTime(active.created_at, t),
              }
            )}
          </p>
        </div>
      </div>

      {isPending && (
        <div className='flex shrink-0 gap-2'>
          {confirming ? (
            <>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setConfirming(false)}
                disabled={cancelMutation.isPending}
              >
                {t('Keep request')}
              </Button>
              <Button
                size='sm'
                variant='destructive'
                onClick={() => cancelMutation.mutate(active.id)}
                disabled={cancelMutation.isPending}
                className='gap-1.5'
              >
                {cancelMutation.isPending && (
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                )}
                {t('Confirm cancel')}
              </Button>
            </>
          ) : (
            <Button
              size='sm'
              variant='outline'
              onClick={() => setConfirming(true)}
            >
              {t('Cancel request')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(
  iso: string,
  t: (k: string, opts?: Record<string, unknown>) => string
): string {
  try {
    const d = new Date(iso).getTime()
    const diff = Date.now() - d
    const m = Math.floor(diff / 60_000)
    if (m < 1) return t('just now')
    if (m < 60) return t('{{n}} min ago', { n: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('{{n}} hour(s) ago', { n: h })
    const days = Math.floor(h / 24)
    if (days < 7) return t('{{n}} day(s) ago', { n: days })
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}
