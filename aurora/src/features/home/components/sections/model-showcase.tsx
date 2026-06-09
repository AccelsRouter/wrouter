/*
Model showcase grid: visual proof of provider/model breadth.
Renders ~24 curated logos via @lobehub/icons; loader silently
falls back if a name is not present in the icon library.
*/
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { getLobeIcon } from '@/lib/lobe-icon'

// Curated set of mainstream LLM providers. Trimmed to the 12 most
// recognized brands (global + China) so the showcase reads as
// "here are the names you know" rather than "here are every
// integration we ship".
//
// All names verified against aurora/node_modules/@lobehub/icons/es/
// `.Color` is dropped for entries that ship only a Mono variant.
const SHOWCASE_MODELS: string[] = [
  // Global headliners
  'OpenAI',
  'Claude.Color',
  'Gemini.Color',
  'Grok',
  // Open source + EU
  'Meta.Color',
  'Mistral.Color',
  // China mainstream
  'DeepSeek.Color',
  'Qwen.Color',
  'Doubao.Color',
  'Wenxin.Color',
  'Zhipu.Color',
  'Minimax.Color',
]

export function ModelShowcase() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-20 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 text-center md:mb-14'>
          <p className='text-muted-foreground/70 mb-2 text-xs font-medium tracking-widest uppercase'>
            {t('150+ models supported')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('A wide selection of top-tier large language models')}{' '}
            <span className='font-extrabold' style={{ color: '#5EF1A0' }}>
              150+
            </span>
          </h2>
        </AnimateInView>

        <AnimateInView animation='fade-up'>
          <div className='border-border/40 bg-card/40 rounded-2xl border p-5 shadow-sm backdrop-blur-sm md:p-8'>
            <div className='grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 md:gap-5'>
              {SHOWCASE_MODELS.map((name, i) => {
                // Strip ".Color" / ".Mono" for the a11y label.
                const label = name.split('.')[0]
                return (
                  <AnimateInView
                    key={`${name}-${i}`}
                    delay={i * 35}
                    animation='scale-in'
                    className='border-border/60 bg-background hover:border-[color:rgba(94,241,160,0.55)] hover:shadow-lg group flex aspect-square items-center justify-center rounded-2xl border shadow-sm transition-all duration-300'
                    style={{ ['--tw-shadow-color' as string]: 'rgba(94,241,160,0.18)' }}
                  >
                    <span
                      role='img'
                      aria-label={label}
                      title={label}
                      className='transition-transform duration-300 group-hover:scale-110'
                    >
                      {getLobeIcon(name, 44)}
                    </span>
                  </AnimateInView>
                )
              })}
            </div>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
