/*
GeoBlock admin section: top-level enable toggle + a card for each
configured model family (prefixes + blocked countries).
*/
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  formatCountry,
  getCountryByCode,
} from './data/countries'
import { DEFAULT_FAMILIES } from './defaults'
import type { GeoBlockFamily, GeoBlockPageSettings } from './types'

type GeoBlockSectionProps = {
  defaultValues: GeoBlockPageSettings
}

function parseFamilies(raw: string): GeoBlockFamily[] {
  if (!raw || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (f): f is GeoBlockFamily =>
          !!f &&
          typeof f === 'object' &&
          typeof (f as GeoBlockFamily).key === 'string'
      )
      .map((f) => ({
        key: f.key,
        label: f.label ?? f.key,
        prefixes: Array.isArray(f.prefixes)
          ? f.prefixes.filter((p) => typeof p === 'string')
          : [],
        blocked_countries: Array.isArray(f.blocked_countries)
          ? f.blocked_countries
              .filter((c) => typeof c === 'string')
              .map((c) => c.toUpperCase())
          : [],
      }))
  } catch {
    return []
  }
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function normalizeFamily(family: GeoBlockFamily): GeoBlockFamily {
  return {
    ...family,
    key: family.key.trim().toLowerCase(),
    label: family.label.trim(),
    prefixes: family.prefixes
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0),
    blocked_countries: family.blocked_countries
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length === 2),
  }
}

function isFamiliesEqual(a: GeoBlockFamily[], b: GeoBlockFamily[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function GeoBlockSection({ defaultValues }: GeoBlockSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const initialFamilies = useMemo<GeoBlockFamily[]>(() => {
    const parsed = parseFamilies(defaultValues['geo_block.families'])
    return parsed.length > 0 ? parsed : DEFAULT_FAMILIES
  }, [defaultValues])

  const initialEnabled = defaultValues['geo_block.enabled']

  const [enabled, setEnabled] = useState(initialEnabled)
  const [families, setFamilies] = useState<GeoBlockFamily[]>(initialFamilies)

  useEffect(() => {
    setEnabled(initialEnabled)
    setFamilies(initialFamilies)
  }, [initialEnabled, initialFamilies])

  const isDirty =
    enabled !== initialEnabled ||
    !isFamiliesEqual(
      families.map(normalizeFamily),
      initialFamilies.map(normalizeFamily)
    )

  const updateFamily = (index: number, patch: Partial<GeoBlockFamily>) => {
    setFamilies((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    )
  }

  const addFamily = () => {
    setFamilies((prev) => [
      ...prev,
      {
        key: `custom-${prev.length + 1}`,
        label: 'Custom family',
        prefixes: [],
        blocked_countries: [],
      },
    ])
  }

  const removeFamily = (index: number) => {
    setFamilies((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async () => {
    // Validate: every family must have non-empty key, no duplicate keys.
    const normalized = families.map(normalizeFamily)
    const keys = new Set<string>()
    for (const f of normalized) {
      if (!f.key) {
        toast.error(t('Every family needs a key.'))
        return
      }
      if (keys.has(f.key)) {
        toast.error(t('Duplicate family key: {{key}}', { key: f.key }))
        return
      }
      keys.add(f.key)
    }

    const serializedFamilies = JSON.stringify(normalized)
    const serializedInitial = JSON.stringify(
      initialFamilies.map(normalizeFamily)
    )

    const updates: Array<Promise<unknown>> = []
    if (enabled !== initialEnabled) {
      updates.push(
        updateOption.mutateAsync({
          key: 'geo_block.enabled',
          value: enabled ? 'true' : 'false',
        })
      )
    }
    if (serializedFamilies !== serializedInitial) {
      updates.push(
        updateOption.mutateAsync({
          key: 'geo_block.families',
          value: serializedFamilies,
        })
      )
    }
    if (updates.length === 0) return
    await Promise.all(updates)
    // Reset local state so dirty check returns clean.
    setFamilies(normalized)
  }

  const onReset = () => {
    setEnabled(initialEnabled)
    setFamilies(initialFamilies)
  }

  return (
    <SettingsSection title={t('Geo-based model restrictions')}>
      <SettingsPageFormActions
        onSave={onSubmit}
        onReset={onReset}
        isSaving={updateOption.isPending}
        isResetDisabled={!isDirty}
        saveLabel='Save restrictions'
        resetLabel='Discard changes'
      />

      <div className='flex flex-col gap-6'>
        <div className='border-border/60 bg-muted/30 flex items-start justify-between gap-4 rounded-md border p-4'>
          <div className='flex flex-col gap-1'>
            <Label className='text-sm font-medium'>
              {t('Enable geo-based restrictions')}
            </Label>
            <p className='text-muted-foreground text-xs leading-5'>
              {t(
                'When enabled, model requests originating from blocked countries (as reported by the CloudFront-Viewer-Country header) will be refused with a 403 response. Requires CloudFront in front of the load balancer.'
              )}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && families.length === 0 && (
          <div className='text-muted-foreground border-border/60 rounded-md border border-dashed p-6 text-center text-sm'>
            {t('No families configured. Add one to start enforcing geo rules.')}
          </div>
        )}

        {families.map((family, index) => (
          <div
            key={`${family.key}-${index}`}
            className='border-border/60 bg-card flex flex-col gap-4 rounded-md border p-4'
          >
            <div className='flex items-start justify-between gap-2'>
              <div className='grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2'>
                <div className='flex flex-col gap-1.5'>
                  <Label className='text-xs font-medium'>
                    {t('Family key')}
                  </Label>
                  <Input
                    value={family.key}
                    placeholder='openai'
                    onChange={(e) =>
                      updateFamily(index, { key: e.target.value })
                    }
                  />
                  <p className='text-muted-foreground text-xs'>
                    {t('Stable identifier, lowercase. No spaces.')}
                  </p>
                </div>
                <div className='flex flex-col gap-1.5'>
                  <Label className='text-xs font-medium'>
                    {t('Display label')}
                  </Label>
                  <Input
                    value={family.label}
                    placeholder='OpenAI'
                    onChange={(e) =>
                      updateFamily(index, { label: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive'
                onClick={() => removeFamily(index)}
                aria-label={t('Remove family')}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label className='text-xs font-medium'>
                {t('Model name prefixes')}
              </Label>
              <Textarea
                value={family.prefixes.join('\n')}
                rows={4}
                placeholder={'gpt-\no1-\no3-'}
                onChange={(e) =>
                  updateFamily(index, { prefixes: splitLines(e.target.value) })
                }
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'One prefix per line (case-insensitive). A request matches this family when its model name starts with any prefix.'
                )}
              </p>
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label className='text-xs font-medium'>
                {t('Blocked countries (ISO 3166-1 alpha-2)')}
              </Label>
              <Textarea
                value={family.blocked_countries.join('\n')}
                rows={3}
                placeholder={'CN\nHK'}
                onChange={(e) =>
                  updateFamily(index, {
                    blocked_countries: splitLines(e.target.value).map((c) =>
                      c.toUpperCase()
                    ),
                  })
                }
              />
              {family.blocked_countries.length > 0 ? (
                <div className='text-muted-foreground flex flex-wrap gap-1.5 text-xs'>
                  {family.blocked_countries.map((code) => {
                    const known = getCountryByCode(code)
                    return (
                      <span
                        key={code}
                        className={
                          'bg-muted/60 rounded px-2 py-0.5 ' +
                          (known ? '' : 'text-amber-600')
                        }
                      >
                        {known ? formatCountry(code) : `⚠️ ${code}`}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className='text-muted-foreground text-xs'>
                  {t('Two-letter codes, one per line. Example: CN, HK')}
                </p>
              )}
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='outline'
          className='gap-2 self-start'
          onClick={addFamily}
        >
          <Plus className='h-4 w-4' />
          {t('Add custom family')}
        </Button>
      </div>
    </SettingsSection>
  )
}
