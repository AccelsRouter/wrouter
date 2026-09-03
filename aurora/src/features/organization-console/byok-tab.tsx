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
BYOK (bring-your-own-key) tab of the organization console. Lists the org's
own upstream channels (masked keys) and allows create/delete. These
credentials serve only this organization.
*/
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CHANNEL_TYPES } from '@/features/channels/constants'
import { getChannelTypeIcon } from '@/features/channels/lib/channel-utils'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  createOrgByok,
  deleteOrgByok,
  listOrgByok,
} from './api'
import { Field, Td, Th } from './shared'
import type { OrgByokChannel } from './types'

// Mainstream providers offered in the BYOK dropdown. The base URLs are the
// providers' official endpoints, mirroring the backend ChannelBaseURLs table
// (constant/channel.go). Selecting one auto-fills the base URL (still editable)
// and sets the numeric channel type sent to the backend.
const BYOK_PROVIDERS: { id: number; baseUrl: string }[] = [
  { id: 1, baseUrl: 'https://api.openai.com' }, // OpenAI
  { id: 14, baseUrl: 'https://api.anthropic.com' }, // Anthropic
  { id: 24, baseUrl: 'https://generativelanguage.googleapis.com' }, // Gemini
  { id: 43, baseUrl: 'https://api.deepseek.com' }, // DeepSeek
  { id: 25, baseUrl: 'https://api.moonshot.cn' }, // Moonshot
  { id: 42, baseUrl: 'https://api.mistral.ai' }, // Mistral
  { id: 20, baseUrl: 'https://openrouter.ai/api' }, // OpenRouter
  { id: 16, baseUrl: 'https://open.bigmodel.cn' }, // Zhipu
  { id: 17, baseUrl: 'https://dashscope.aliyuncs.com' }, // Ali / Qwen
  { id: 45, baseUrl: 'https://ark.cn-beijing.volces.com' }, // VolcEngine / Doubao
  { id: 48, baseUrl: 'https://api.x.ai' }, // xAI / Grok
  { id: 40, baseUrl: 'https://api.siliconflow.cn' }, // SiliconFlow
  { id: 27, baseUrl: 'https://api.perplexity.ai' }, // Perplexity
  { id: 34, baseUrl: 'https://api.cohere.ai' }, // Cohere
]

const BYOK_BASE_URL: Record<number, string> = Object.fromEntries(
  BYOK_PROVIDERS.map((p) => [p.id, p.baseUrl])
)

export function ByokTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteChannel, setDeleteChannel] = useState<OrgByokChannel | null>(
    null
  )

  const { data, isLoading } = useQuery({
    queryKey: ['org-byok'],
    queryFn: listOrgByok,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['org-byok'] })

  const deleteMutation = useMutation({
    mutationFn: (channelId: number) => deleteOrgByok(channelId),
    onSuccess: () => {
      toast.success(t('BYOK channel deleted'))
      invalidate()
      setDeleteChannel(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  })

  const channels = data ?? []

  return (
    <div className='flex flex-col gap-4'>
      <Alert>
        <AlertDescription>
          {t(
            'These credentials serve only this organization. Keys are stored securely and shown masked.'
          )}
        </AlertDescription>
      </Alert>

      <div className='flex justify-end'>
        <Button
          size='sm'
          className='gap-1.5'
          onClick={() => setCreateOpen(true)}
        >
          <Plus className='h-3.5 w-3.5' />
          {t('New BYOK Channel')}
        </Button>
      </div>

      {isLoading ? (
        <div className='flex h-32 items-center justify-center'>
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        </div>
      ) : channels.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('No BYOK channels yet.')}
        </p>
      ) : (
        <div className='border-border/60 overflow-x-auto rounded-md border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/40 text-muted-foreground text-xs'>
              <tr>
                <Th>{t('Name')}</Th>
                <Th>{t('Type')}</Th>
                <Th>{t('Key')}</Th>
                <Th>{t('Models')}</Th>
                <Th className='text-right'>{t('Action')}</Th>
              </tr>
            </thead>
            <tbody className='divide-border/60 divide-y'>
              {channels.map((c) => (
                <tr key={c.channel_id} className='hover:bg-muted/30'>
                  <Td>
                    <span className='font-medium'>{c.name}</span>
                    <span className='text-muted-foreground ml-1 text-xs'>
                      #{c.channel_id}
                    </span>
                  </Td>
                  <Td className='text-muted-foreground'>{c.type}</Td>
                  <Td>
                    <span className='font-mono text-[11px]'>
                      {c.key_masked || '-'}
                    </span>
                  </Td>
                  <Td className='text-muted-foreground max-w-[16rem] truncate text-xs'>
                    {c.models || '-'}
                  </Td>
                  <Td className='text-right'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setDeleteChannel(c)}
                    >
                      {t('Delete')}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateByokDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={invalidate}
      />
      <ConfirmDialog
        open={!!deleteChannel}
        onOpenChange={(o) => !o && setDeleteChannel(null)}
        title={t('Delete BYOK channel')}
        desc={t('This permanently deletes the channel and its stored key.')}
        destructive
        isLoading={deleteMutation.isPending}
        confirmText={t('Delete')}
        handleConfirm={() =>
          deleteChannel && deleteMutation.mutate(deleteChannel.channel_id)
        }
      />
    </div>
  )
}

function CreateByokDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [models, setModels] = useState('')

  const reset = () => {
    setName('')
    setType('')
    setKey('')
    setBaseUrl('')
    setModels('')
  }

  const providerOptions = BYOK_PROVIDERS.map((p) => ({
    value: String(p.id),
    label: (CHANNEL_TYPES as Record<number, string>)[p.id] ?? `#${p.id}`,
    icon: getLobeIcon(`${getChannelTypeIcon(p.id)}.Color`, 16),
  }))

  const selectProvider = (value: string) => {
    setType(value)
    const url = BYOK_BASE_URL[Number(value)]
    if (url) setBaseUrl(url)
  }

  const mutation = useMutation({
    mutationFn: () =>
      createOrgByok({
        name: name.trim(),
        type: Number(type) || 0,
        key: key.trim(),
        base_url: baseUrl.trim(),
        models: models.trim(),
      }),
    onSuccess: () => {
      toast.success(t('BYOK channel created'))
      props.onSaved()
      reset()
      props.onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  })

  const canSubmit =
    name.trim().length > 0 && key.trim().length > 0 && Number(type) > 0

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) reset()
        props.onOpenChange(o)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('New BYOK Channel')}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <Field label={t('Name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('Provider')}>
            <Combobox
              options={providerOptions}
              value={type}
              onValueChange={(v) => v && selectProvider(v)}
              placeholder={t('Select a provider')}
              searchPlaceholder={t('Search providers...')}
              emptyText={t('No provider found.')}
            />
          </Field>
          <Field label={t('Key')}>
            <Input
              type='password'
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
          <Field label={t('Base URL')}>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('Optional')}
            />
          </Field>
          <Field label={t('Models (comma separated)')}>
            <Textarea
              value={models}
              onChange={(e) => setModels(e.target.value)}
              rows={2}
            />
          </Field>
        </div>
        <DialogFooter className='gap-2'>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className='gap-1.5'
          >
            {mutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
            {t('Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
