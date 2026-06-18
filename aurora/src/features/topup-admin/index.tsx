/*
Admin top-up orders page — list all users' recharge orders with
keyword search, pagination, and manual reconcile (补单) for
non-completed orders. Parity with classic's TopupHistoryModal admin
mode. Backend: GET /api/user/topup, POST /api/user/topup/complete.
*/
import { useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Loader2, RefreshCw, Search, Inbox, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionPageLayout } from '@/components/layout'
import { completeTopUp, listTopUps } from './api'
import type { TopUpOrder } from './types'

const PAGE_SIZE = 20

export function TopUpAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-topup-list', page, keyword],
    queryFn: () => listTopUps({ page, pageSize: PAGE_SIZE, keyword }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const completeMutation = useMutation({
    mutationFn: (tradeNo: string) => completeTopUp(tradeNo),
    onSuccess: () => {
      toast.success(t('Order reconciled'))
      queryClient.invalidateQueries({ queryKey: ['admin-topup-list'] })
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t('Reconcile failed'))
    },
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onSearch = () => {
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Recharge Orders')}</SectionPageLayout.Title>
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
          <div className='flex gap-2'>
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder={t('Search by username / trade no.')}
              className='max-w-xs'
            />
            <Button variant='outline' className='gap-1.5' onClick={onSearch}>
              <Search className='h-4 w-4' />
              {t('Search')}
            </Button>
          </div>

          {isLoading ? (
            <div className='flex h-40 items-center justify-center'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            </div>
          ) : items.length === 0 ? (
            <div className='border-border/40 flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed'>
              <Inbox className='text-muted-foreground/60 h-8 w-8' />
              <p className='text-muted-foreground text-sm'>
                {t('No recharge orders found.')}
              </p>
            </div>
          ) : (
            <div className='flex flex-col gap-2'>
              {items.map((o) => (
                <TopUpRow
                  key={o.id}
                  order={o}
                  onComplete={() => completeMutation.mutate(o.trade_no)}
                  completing={completeMutation.isPending}
                />
              ))}
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className='flex items-center justify-center gap-3'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('Previous')}
              </Button>
              <span className='text-muted-foreground text-xs tabular-nums'>
                {page} / {totalPages} · {total}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('Next')}
              </Button>
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function TopUpRow(props: {
  order: TopUpOrder
  onComplete: () => void
  completing: boolean
}) {
  const { t } = useTranslation()
  const o = props.order
  const isSuccess = o.status === 'success'
  return (
    <div className='border-border/60 bg-card grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-md border p-4'>
      <div className='flex flex-col items-start gap-1'>
        <span className='text-muted-foreground font-mono text-xs'>#{o.id}</span>
        <StatusBadge status={o.status} />
      </div>
      <div className='flex min-w-0 flex-col gap-0.5'>
        <span className='truncate text-sm font-medium'>
          {t('User')} #{o.user_id}
          <span className='text-muted-foreground ml-2 text-xs'>
            {payLabel(o)}
          </span>
        </span>
        <span className='text-muted-foreground truncate font-mono text-[11px]'>
          {o.trade_no}
        </span>
        <span className='text-muted-foreground text-xs'>
          {t('Created')}: {fmtTime(o.create_time)}
          {o.complete_time > 0 && (
            <> · {t('Completed')}: {fmtTime(o.complete_time)}</>
          )}
        </span>
      </div>
      <div className='flex flex-col items-end gap-1.5'>
        <span className='text-base font-semibold tabular-nums'>
          ${o.money.toFixed(2)}
        </span>
        {!isSuccess && (
          <Button
            size='sm'
            variant='outline'
            className='gap-1'
            onClick={props.onComplete}
            disabled={props.completing}
          >
            <CheckCircle2 className='h-3.5 w-3.5' />
            {t('Reconcile')}
          </Button>
        )}
      </div>
    </div>
  )
}

function payLabel(o: TopUpOrder): string {
  return o.payment_method || o.payment_provider || '-'
}

function fmtTime(unixSec: number): string {
  if (!unixSec) return '-'
  return new Date(unixSec * 1000).toLocaleString()
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { cls: string; label: string }> = {
    success: {
      cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      label: t('Success'),
    },
    pending: {
      cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      label: t('Pending'),
    },
  }
  const s = map[status] ?? {
    cls: 'bg-muted text-muted-foreground',
    label: status || '-',
  }
  return (
    <span className={`${s.cls} rounded-full px-2 py-0.5 text-[10px] font-semibold`}>
      {s.label}
    </span>
  )
}
