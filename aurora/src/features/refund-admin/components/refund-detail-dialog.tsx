/*
Refund detail + admin actions dialog. Shows the full request data
and three primary actions based on status:
  - pending  → Approve / Reject
  - approved → Mark refunded / Reject (no, business rule says reject
    only from pending; show only Mark refunded here)
  - other    → read-only
*/
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  DollarSign,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  approveRefundRequest,
  markRefundRefunded,
  rejectRefundRequest,
} from '../api'
import type { RefundRequest, RefundStatus } from '../types'

type Props = {
  request: RefundRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ActionKind = 'approve' | 'reject' | 'mark-refunded'

const ACTION_LABELS: Record<ActionKind, string> = {
  approve: 'Approve',
  reject: 'Reject',
  'mark-refunded': 'Mark as refunded',
}

export function RefundDetailDialog(props: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const r = props.request

  const mutation = useMutation({
    mutationFn: async ({
      kind,
      note,
      id,
    }: {
      kind: ActionKind
      note: string
      id: number
    }) => {
      if (kind === 'approve') return approveRefundRequest(id, note)
      if (kind === 'reject') return rejectRefundRequest(id, note)
      return markRefundRefunded(id, note)
    },
    onSuccess: (_data, vars) => {
      const msgKey =
        vars.kind === 'approve'
          ? 'Refund request approved'
          : vars.kind === 'reject'
            ? 'Refund request rejected'
            : 'Refund marked as refunded · balance debited'
      toast.success(t(msgKey))
      queryClient.invalidateQueries({ queryKey: ['admin-refund-list'] })
      setActiveAction(null)
      setNoteDraft('')
      props.onOpenChange(false)
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t('Action failed'))
    },
  })

  if (!r) return null

  const handleStartAction = (kind: ActionKind) => {
    setActiveAction(kind)
    setNoteDraft('')
  }

  const handleConfirm = () => {
    if (!activeAction || !r) return
    if (activeAction === 'reject' && noteDraft.trim().length < 1) {
      toast.error(t('Reject requires a note explaining the reason'))
      return
    }
    mutation.mutate({ kind: activeAction, note: noteDraft, id: r.id })
  }

  const canApprove = r.status === 'pending'
  const canReject = r.status === 'pending'
  const canMarkRefunded = r.status === 'approved'

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        props.onOpenChange(o)
        if (!o) setActiveAction(null)
      }}
    >
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {t('Refund #{{id}}', { id: r.id })}
            <StatusBadge status={r.status} />
          </DialogTitle>
          <DialogDescription>
            {r.username} · {r.email}
          </DialogDescription>
        </DialogHeader>

        {activeAction == null ? (
          <DetailBody request={r} />
        ) : (
          <ActionForm
            actionKind={activeAction}
            request={r}
            noteDraft={noteDraft}
            onNoteDraftChange={setNoteDraft}
          />
        )}

        <DialogFooter className='gap-2'>
          {activeAction == null ? (
            <>
              <Button
                variant='outline'
                onClick={() => props.onOpenChange(false)}
              >
                {t('Close')}
              </Button>
              {canApprove && (
                <Button
                  variant='outline'
                  onClick={() => handleStartAction('approve')}
                  className='gap-1.5'
                >
                  <CheckCircle2 className='h-4 w-4 text-emerald-500' />
                  {t(ACTION_LABELS.approve)}
                </Button>
              )}
              {canReject && (
                <Button
                  variant='outline'
                  onClick={() => handleStartAction('reject')}
                  className='gap-1.5'
                >
                  <XCircle className='h-4 w-4 text-red-500' />
                  {t(ACTION_LABELS.reject)}
                </Button>
              )}
              {canMarkRefunded && (
                <Button
                  onClick={() => handleStartAction('mark-refunded')}
                  className='gap-1.5'
                >
                  <DollarSign className='h-4 w-4' />
                  {t(ACTION_LABELS['mark-refunded'])}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant='outline'
                onClick={() => {
                  setActiveAction(null)
                  setNoteDraft('')
                }}
                disabled={mutation.isPending}
              >
                {t('Back')}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={mutation.isPending}
                className='gap-1.5'
                variant={activeAction === 'reject' ? 'destructive' : 'default'}
              >
                {mutation.isPending ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm {{action}}', {
                  action: t(ACTION_LABELS[activeAction]),
                })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({ request: r }: { request: RefundRequest }) {
  const { t } = useTranslation()
  const balanceUSD = (r.balance_snapshot ?? 0) / 500000

  return (
    <div className='flex flex-col gap-3'>
      <Row label={t('Amount requested')} value={`$${r.amount_usd.toFixed(2)} USD`} />
      <Row
        label={t('Balance at submit')}
        value={`$${balanceUSD.toFixed(2)} USD`}
      />
      <Row label={t('Method')} value={r.method} />
      <BlockRow label={t('Refund destination')} value={r.refund_destination} />
      <BlockRow label={t('Reason')} value={r.reason} />
      <Row
        label={t('Backup contact')}
        value={r.contact_info || '-'}
      />
      <Row
        label={t('Submitted')}
        value={new Date(r.created_at).toLocaleString()}
      />
      {r.processed_at && (
        <Row
          label={t('Processed')}
          value={new Date(r.processed_at).toLocaleString()}
        />
      )}
      {r.admin_note && <BlockRow label={t('Admin note')} value={r.admin_note} />}
    </div>
  )
}

function ActionForm(props: {
  actionKind: ActionKind
  request: RefundRequest
  noteDraft: string
  onNoteDraftChange: (s: string) => void
}) {
  const { t } = useTranslation()

  if (props.actionKind === 'mark-refunded') {
    return (
      <div className='flex flex-col gap-3'>
        <div className='border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/10 flex items-start gap-3 rounded-md border p-3'>
          <AlertCircle className='text-amber-500 mt-0.5 h-4 w-4 shrink-0' />
          <p className='text-xs leading-5'>
            {t(
              'Confirm the actual refund has been sent OFF-platform (bank transfer / crypto transaction). This will deduct ${{amount}} USD from the user\'s wallet balance. The action is atomic and cannot be undone.',
              { amount: props.request.amount_usd.toFixed(2) }
            )}
          </p>
        </div>
        <Label htmlFor='refund-note'>
          {t('Internal note (txid / receipt / reference)')}
        </Label>
        <Textarea
          id='refund-note'
          rows={3}
          placeholder={t('e.g. tx 0xabc... / receipt #1234')}
          value={props.noteDraft}
          onChange={(e) => props.onNoteDraftChange(e.target.value)}
        />
      </div>
    )
  }
  if (props.actionKind === 'reject') {
    return (
      <div className='flex flex-col gap-3'>
        <p className='text-muted-foreground text-xs leading-5'>
          {t(
            'Provide a reason that will be stored in the audit log. The user will be informed; phrase it accordingly.'
          )}
        </p>
        <Label htmlFor='refund-note'>{t('Rejection reason')} *</Label>
        <Textarea
          id='refund-note'
          rows={4}
          placeholder={t('Required — explain why the refund is rejected.')}
          value={props.noteDraft}
          onChange={(e) => props.onNoteDraftChange(e.target.value)}
        />
      </div>
    )
  }
  // approve
  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-xs leading-5'>
        {t(
          'Approving means: "we agree to refund this user". Balance is NOT touched at this stage; mark as refunded only after the payout has actually been sent.'
        )}
      </p>
      <Label htmlFor='refund-note'>{t('Internal note (optional)')}</Label>
      <Textarea
        id='refund-note'
        rows={3}
        placeholder={t('e.g. verified email matches')}
        value={props.noteDraft}
        onChange={(e) => props.onNoteDraftChange(e.target.value)}
      />
    </div>
  )
}

function Row(props: { label: string; value: string }) {
  return (
    <div className='border-border/60 bg-muted/20 flex items-center justify-between rounded-md border px-3 py-2'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='text-sm font-medium'>{props.value}</span>
    </div>
  )
}

function BlockRow(props: { label: string; value: string }) {
  return (
    <div className='border-border/60 bg-muted/20 flex flex-col gap-1 rounded-md border px-3 py-2'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='text-sm leading-5 break-words whitespace-pre-wrap'>
        {props.value}
      </span>
    </div>
  )
}

export function StatusBadge({ status }: { status: RefundStatus }) {
  const cls: Record<RefundStatus, string> = {
    pending: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    approved: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    refunded: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/15 text-red-700 dark:text-red-300',
    cancelled: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={`${cls[status]} rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase`}
    >
      {status}
    </span>
  )
}
