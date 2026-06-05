/*
Enterprise contact page entrypoint.
*/
import { PublicLayout } from '@/components/layout'
import { EnterpriseHero } from './components/enterprise-hero'
import { EnterpriseForm } from './components/enterprise-form'

export function Enterprise() {
  return (
    <PublicLayout>
      <section className='mx-auto w-full max-w-6xl px-4 py-12 sm:py-16 lg:py-20'>
        <div className='grid gap-10 lg:grid-cols-2 lg:gap-16'>
          <EnterpriseHero />
          <EnterpriseForm />
        </div>
      </section>
    </PublicLayout>
  )
}
