/*
Enterprise inquiry form (right column on the enterprise page).
Posts to /api/enterprise-inquiry which proxies to a Lark webhook.
*/
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { submitEnterpriseInquiry } from '../api'
import {
  COUNTRY_OPTIONS,
  MODEL_FAMILIES,
  MONTHLY_VOLUME_RANGES,
  REFERRAL_SOURCES,
} from '../constants'
import {
  enterpriseFormDefaults,
  enterpriseFormSchema,
  type EnterpriseFormValues,
} from '../lib/form-schema'

export function EnterpriseForm() {
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<EnterpriseFormValues>({
    resolver: zodResolver(enterpriseFormSchema),
    defaultValues: enterpriseFormDefaults,
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: EnterpriseFormValues) {
    try {
      const res = await submitEnterpriseInquiry({
        name: values.name.trim(),
        company: values.company.trim(),
        work_email: values.work_email.trim(),
        country: values.country,
        monthly_volume: values.monthly_volume ?? '',
        models_interest: values.models_interest ?? [],
        use_case: values.use_case.trim(),
        source: values.source ?? '',
      })

      if (res?.success) {
        toast.success(t('Thanks! We will be in touch shortly.'))
        setSubmitted(true)
        form.reset(enterpriseFormDefaults)
      } else {
        toast.error(
          res?.message || t('Submission failed. Please try again later.')
        )
      }
    } catch {
      // Errors are surfaced by the global interceptor as toasts.
    }
  }

  if (submitted) {
    return (
      <div className='border-border/60 bg-muted/30 flex flex-col items-center gap-4 rounded-lg border p-10 text-center'>
        <CheckCircle2 className='text-primary h-12 w-12' />
        <h2 className='text-xl font-semibold'>
          {t('Inquiry received')}
        </h2>
        <p className='text-muted-foreground max-w-md text-sm leading-6'>
          {t(
            "We've notified our sales engineering team. Someone will reach out within one business day to schedule a call."
          )}
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setSubmitted(false)}
        >
          {t('Submit another inquiry')}
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='border-border/60 bg-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm sm:p-8'
        noValidate
      >
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Your name')} <span className='text-destructive'>*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Jane Doe')}
                    autoComplete='name'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='company'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Company')} <span className='text-destructive'>*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Acme, Inc.')}
                    autoComplete='organization'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='work_email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('Work email')} <span className='text-destructive'>*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder='jane@acme.com'
                  autoComplete='email'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='country'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('Country / Region')}{' '}
                <span className='text-destructive'>*</span>
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('Select your country or region')}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className='mr-2'>{c.flag}</span>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='monthly_volume'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Expected monthly volume (USD)')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('Optional')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MONTHLY_VOLUME_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='models_interest'
          render={({ field }) => {
            const value = field.value ?? []
            const toggle = (id: string) => {
              const next = value.includes(id)
                ? value.filter((v) => v !== id)
                : [...value, id]
              field.onChange(next)
            }
            return (
              <FormItem>
                <FormLabel>{t('Models of interest')}</FormLabel>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                  {MODEL_FAMILIES.map((m) => {
                    const checked = value.includes(m.value)
                    return (
                      <label
                        key={m.value}
                        className='hover:border-primary/60 flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm'
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(m.value)}
                        />
                        <span>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )
          }}
        />

        <FormField
          control={form.control}
          name='use_case'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('Use case')} <span className='text-destructive'>*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder={t(
                    'Tell us about your product, traffic profile, and any compliance constraints.'
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='source'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('How did you hear about us?')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('Optional')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {REFERRAL_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type='submit'
          className='mt-2 w-full justify-center gap-2 sm:w-auto sm:self-start'
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {t('Talk to sales')}
        </Button>

        <p className='text-muted-foreground text-xs leading-5'>
          {t(
            'We only use this information to follow up about your inquiry. See our Privacy Policy.'
          )}
        </p>
      </form>
    </Form>
  )
}
