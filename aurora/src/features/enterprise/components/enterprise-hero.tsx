/*
wspn fork: marketing copy on the enterprise page (left column).
*/
import { useTranslation } from 'react-i18next'
import { Building2, Shield, Zap, Headset } from 'lucide-react'

export function EnterpriseHero() {
  const { t } = useTranslation()

  const bullets = [
    {
      icon: Zap,
      title: t('Higher throughput, lower latency'),
      body: t(
        'Dedicated capacity across OpenAI, Anthropic, Google, and xAI with auto-failover and regional routing.'
      ),
    },
    {
      icon: Shield,
      title: t('Compliance & data residency'),
      body: t(
        'Custom data retention, regional deployment, and per-team isolation. SOC 2 / ISO 27001 audits available on request.'
      ),
    },
    {
      icon: Headset,
      title: t('Dedicated support'),
      body: t(
        'Named technical contact, prioritized incident response, and quarterly review with our engineering team.'
      ),
    },
    {
      icon: Building2,
      title: t('Flexible procurement'),
      body: t(
        'Monthly or annual contracts, prepaid credits, custom invoicing, and multi-tenant billing for agencies.'
      ),
    },
  ]

  return (
    <div className='flex flex-col gap-8'>
      <div className='flex flex-col gap-3'>
        <span className='text-primary text-xs font-semibold tracking-widest uppercase'>
          {t('Enterprise')}
        </span>
        <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>
          {t('Built for teams that ship AI at scale')}
        </h1>
        <p className='text-muted-foreground max-w-xl text-base leading-7'>
          {t(
            'Tell us about your workload and a sales engineer will reach out within one business day. No pressure, no SDR fluff.'
          )}
        </p>
      </div>

      <ul className='flex flex-col gap-6'>
        {bullets.map(({ icon: Icon, title, body }) => (
          <li key={title} className='flex items-start gap-4'>
            <div className='bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md'>
              <Icon className='h-5 w-5' />
            </div>
            <div className='flex flex-col gap-1'>
              <p className='text-sm font-medium'>{title}</p>
              <p className='text-muted-foreground text-sm leading-6'>{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
