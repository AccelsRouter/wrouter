/*
Refund history dialog — lists the current user's own refund requests
with status, amount, method, and submitted time. Read-only; cancel of
a pending request is handled by the wallet banner.
*/
import { useQuery } from '@tanstack/react-query'
import { Inbox, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { listMyRefundRequests } from '../api'
import type { RefundRequest, RefundStatus } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RefundHistoryDialog(props: Props) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['refund-history'],
    queryFn: () => listMyRefundRequests(50),
    enabled: props.open,
    staleTime: 15_000,
  })

  const items = data ?? []

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Refund history')}</DialogTitle>
          <DialogDescription>
            {t('Your refund requests and their current status.')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex h-32 items-center justify-center'>
            <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
          </div>
        ) : items.length === 0 ? (
          <div className='border-border/40 flex h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed'>
            <Inbox className='text-muted-foreground/60 h-7 w-7' />
            <p className='text-muted-foreground text-sm'>
              {t('No refund requests yet.')}
            </p>
          </div>
        ) : (
          <div className='flex flex-col gap-2'>
            {items.map((r) => (
              <RefundHistoryRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RefundHistoryRow({ request: r }: { request: RefundRequest }) {
  const { t } = useTranslation()
  const methodLabel = r.method === 'bank' ? t('Bank') : t('Crypto')
  return (
    <div className='border-border/60 bg-muted/20 flex flex-col gap-1.5 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground font-mono text-xs'>
            #{r.id}
          </span>
          <RefundStatusBadge status={r.status} />
        </div>
        <span className='text-sm font-semibold tabular-nums'>
          ${r.amount_usd.toFixed(2)}
        </span>
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs'>
        <span>
          {t('Method')}: {methodLabel}
        </span>
        <span>
          {t('Submitted')}: {new Date(r.created_at).toLocaleString()}
        </span>
      </div>
      {r.admin_note && r.status === 'rejected' && (
        <p className='text-muted-foreground border-border/40 mt-0.5 border-t pt-1.5 text-xs'>
          {t('Reason')}: {r.admin_note}
        </p>
      )}
    </div>
  )
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const { t } = useTranslation()
  const cls: Record<RefundStatus, string> = {
    pending: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    approved: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    refunded: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/15 text-red-700 dark:text-red-300',
    cancelled: 'bg-muted text-muted-foreground',
  }
  const label: Record<RefundStatus, string> = {
    pending: t('Pending'),
    approved: t('Approved'),
    refunded: t('Refunded'),
    rejected: t('Rejected'),
    cancelled: t('Cancelled'),
  }
  return (
    <span
      className={`${cls[status]} rounded-full px-2 py-0.5 text-[10px] font-semibold`}
    >
      {label[status]}
    </span>
  )
}
