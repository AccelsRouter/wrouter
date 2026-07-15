/*
Invited users dialog — lists the users the current user has referred,
showing each invitee's name and the time they registered (== invitation
time). Read-only.
*/
import { useQuery } from '@tanstack/react-query'
import { Inbox, Loader2, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getInvitedUsers } from '../../api'
import type { InvitedUser } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteesDialog(props: Props) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['invited-users'],
    queryFn: () => getInvitedUsers(100),
    enabled: props.open,
    staleTime: 15_000,
  })

  const items = data?.items ?? []

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Invited users')}</DialogTitle>
          <DialogDescription>
            {t('People who signed up with your referral link.')}
            {data ? ` (${data.total})` : ''}
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
              {t('No invited users yet.')}
            </p>
          </div>
        ) : (
          <div className='flex flex-col gap-2'>
            {items.map((u) => (
              <InviteeRow key={u.id} user={u} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InviteeRow({ user }: { user: InvitedUser }) {
  const { t } = useTranslation()
  const name = user.display_name?.trim() || user.username
  const invitedAt =
    user.created_at > 0
      ? new Date(user.created_at * 1000).toLocaleString()
      : '-'
  return (
    <div className='border-border/60 bg-muted/20 flex items-center justify-between gap-3 rounded-md border p-3'>
      <div className='flex min-w-0 items-center gap-2.5'>
        <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-full border'>
          <UserRound className='text-muted-foreground size-4' />
        </div>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{name}</p>
          {user.display_name?.trim() && (
            <p className='text-muted-foreground truncate text-xs'>
              @{user.username}
            </p>
          )}
        </div>
      </div>
      <div className='text-muted-foreground shrink-0 text-right text-xs'>
        <div className='text-[10px] tracking-wider uppercase'>
          {t('Invited')}
        </div>
        <div className='tabular-nums'>{invitedAt}</div>
      </div>
    </div>
  )
}
