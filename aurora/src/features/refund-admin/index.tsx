/*
Refund admin page — list with status filter tabs + detail dialog.
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'

import { listRefundRequests } from './api'
import { RefundDetailDialog, StatusBadge } from './components/refund-detail-dialog'
import type { RefundRequest, RefundStatus } from './types'

type StatusFilter = '' | RefundStatus

const FILTERS: Array<{ key: StatusFilter; labelKey: string }> = [
  { key: '', labelKey: 'All' },
  { key: 'pending', labelKey: 'Pending' },
  { key: 'approved', labelKey: 'Approved' },
  { key: 'refunded', labelKey: 'Refunded' },
  { key: 'rejected', labelKey: 'Rejected' },
  { key: 'cancelled', labelKey: 'Cancelled' },
]

export function RefundAdmin() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [selected, setSelected] = useState<RefundRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const queryKey = useMemo(
    () => ['admin-refund-list', statusFilter] as const,
    [statusFilter]
  )

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      listRefundRequests({
        status: statusFilter || undefined,
        limit: 100,
      }),
    staleTime: 30_000,
  })

  const items = data?.items ?? []

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Refund Requests')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          className='gap-1.5'
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
          ) : (
            <RefreshCw className='h-3.5 w-3.5' />
          )}
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <Tabs
            value={statusFilter || 'all'}
            onValueChange={(v) =>
              setStatusFilter((v === 'all' ? '' : v) as StatusFilter)
            }
          >
            <TabsList className='flex flex-wrap'>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.key || 'all'} value={f.key || 'all'}>
                  {t(f.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isLoading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <div className='flex flex-col gap-2'>
              {items.map((r) => (
                <RefundRow
                  key={r.id}
                  request={r}
                  onClick={() => {
                    setSelected(r)
                    setDetailOpen(true)
                  }}
                />
              ))}
            </div>
          )}

          {data && data.total > items.length && (
            <p className='text-muted-foreground text-center text-xs'>
              {t('Showing {{shown}} of {{total}} requests', {
                shown: items.length,
                total: data.total,
              })}
            </p>
          )}
        </div>

        <RefundDetailDialog
          request={selected}
          open={detailOpen}
          onOpenChange={(o) => {
            setDetailOpen(o)
            if (!o) setSelected(null)
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function RefundRow(props: { request: RefundRequest; onClick: () => void }) {
  const { t } = useTranslation()
  const r = props.request
  const methodLabel = r.method === 'bank' ? t('Bank') : t('Crypto')
  return (
    <button
      type='button'
      onClick={props.onClick}
      className='border-border/60 bg-card hover:bg-muted/40 grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-md border p-4 text-left transition-colors'
    >
      <div className='flex flex-col items-start gap-1'>
        <span className='font-mono text-xs text-muted-foreground'>
          #{r.id}
        </span>
        <StatusBadge status={r.status} />
      </div>
      <div className='flex min-w-0 flex-col gap-0.5'>
        <span className='truncate text-sm font-medium'>
          {r.username}
          <span className='text-muted-foreground ml-2 text-xs'>
            {r.email}
          </span>
        </span>
        <span className='text-muted-foreground truncate text-xs'>
          {t('Method')}: {methodLabel} ·{' '}
          {t('Submitted')}: {new Date(r.created_at).toLocaleString()}
        </span>
      </div>
      <div className='flex flex-col items-end gap-0.5'>
        <span className='text-base font-semibold tabular-nums'>
          ${r.amount_usd.toFixed(2)}
        </span>
        <span className='text-muted-foreground text-[10px] uppercase tracking-wider'>
          USD
        </span>
      </div>
    </button>
  )
}

function LoadingState() {
  return (
    <div className='flex h-40 items-center justify-center'>
      <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
    </div>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className='border-border/40 flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed'>
      <Inbox className='text-muted-foreground/60 h-8 w-8' />
      <p className='text-muted-foreground text-sm'>
        {t('No refund requests in this view.')}
      </p>
    </div>
  )
}
