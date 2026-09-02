/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/*
Accept-invitation page reachable at /organization/join?code=... An invited
user previews which organization and role they would be joining and must click
"Join" to consent. On success they are routed to the "My Organization" console.
*/
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { acceptInvitation, previewInvitation } from './api'
import { Field } from './shared'

export function JoinOrganization({ code }: { code?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [manualCode, setManualCode] = useState('')

  const activeCode = (code ?? '').trim()

  const {
    data: preview,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invitation-preview', activeCode],
    queryFn: () => previewInvitation(activeCode),
    enabled: activeCode.length > 0,
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(activeCode),
    onSuccess: () => {
      toast.success(t('You have joined the organization.'))
      queryClient.invalidateQueries({ queryKey: ['org-self'] })
      navigate({ to: '/organization' })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Join an Organization')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-md flex-col gap-5'>
          {activeCode.length === 0 ? (
            <div className='border-border/60 flex flex-col gap-4 rounded-lg border p-5'>
              <p className='text-muted-foreground text-sm'>
                {t('Enter the invitation code you received.')}
              </p>
              <Field label={t('Invitation code')}>
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
              </Field>
              <Button
                className='self-start'
                disabled={manualCode.trim().length === 0}
                onClick={() =>
                  navigate({
                    to: '/organization/join',
                    search: { code: manualCode.trim() },
                  })
                }
              >
                {t('Continue')}
              </Button>
            </div>
          ) : isLoading ? (
            <div className='flex h-40 items-center justify-center'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            </div>
          ) : error || !preview ? (
            <div className='border-border/60 flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center'>
              <Building2 className='text-muted-foreground/60 h-8 w-8' />
              <p className='text-muted-foreground text-sm'>
                {error instanceof Error
                  ? error.message
                  : t('This invitation is invalid or has expired.')}
              </p>
            </div>
          ) : (
            <div className='border-border/60 flex flex-col gap-4 rounded-lg border p-5'>
              <div className='flex items-center justify-between gap-3'>
                <span className='text-lg font-semibold'>
                  {preview.org_name}
                </span>
                <Badge
                  variant={
                    preview.org_type === 'reseller' ? 'default' : 'secondary'
                  }
                >
                  {preview.org_type === 'reseller'
                    ? t('Reseller')
                    : t('Enterprise')}
                </Badge>
              </div>
              <p className='text-muted-foreground text-sm'>
                {t('You are invited to join as')}{' '}
                <span className='text-foreground font-medium'>
                  {preview.role || preview.relation}
                </span>
                .
              </p>
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className='gap-1.5 self-start'
              >
                {acceptMutation.isPending && (
                  <Loader2 className='h-4 w-4 animate-spin' />
                )}
                {t('Join')}
              </Button>
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
