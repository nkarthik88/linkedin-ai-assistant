import { motion } from 'framer-motion'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Start growing at no cost.',
    highlight: false,
    badge: null,
    savings: null,
    cta: 'Install Free',
    ctaHref: 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb',
    ctaExternal: true,
    ctaStyle: 'border',
    features: [
      '5 uses per LinkedIn feature/month',
      '1 Deep Lead Search/month',
      '5 Reddit posts/month',
      '3 Subreddit searches/month',
      '5 Reddit replies/month',
      'No credit card required',
    ],
  },
  {
    name: 'LinkedIn Pro',
    price: '$15',
    period: '/month',
    description: 'Unlimited LinkedIn power.',
    highlight: false,
    badge: null,
    savings: null,
    cta: 'Get LinkedIn Pro',
    ctaHref: 'https://checkout.dodopayments.com/buy/pdt_0NfglmAMcUzd4GiVlnt0H',
    ctaExternal: true,
    ctaStyle: 'cyan',
    features: [
      'Unlimited all 5 LinkedIn features',
      '25 Deep Lead Searches/month',
      'Reddit stays at free limits',
    ],
  },
  {
    name: 'Reddit Pro',
    price: '$15',
    period: '/month',
    description: 'Unlimited Reddit power.',
    highlight: false,
    badge: null,
    savings: null,
    cta: 'Get Reddit Pro',
    ctaHref: 'https://checkout.dodopayments.com/buy/pdt_0Nh1zryt8Ch4KTi9B5yVJ',
    ctaExternal: true,
    ctaStyle: 'amber',
    features: [
      'Unlimited all 3 Reddit features',
      'Anti-ban protection on every post',
      'LinkedIn stays at free limits',
    ],
  },
  {
    name: 'Bundle',
    price: '$25',
    period: '/month',
    description: 'Unlimited everything.',
    highlight: true,
    badge: 'Best Value',
    savings: 'SAVE $5/month',
    cta: 'Get Bundle',
    ctaHref: 'https://checkout.dodopayments.com/buy/pdt_0Nh23AJmTvBuWAXKsi2ds',
    ctaExternal: true,
    ctaStyle: 'bundle',
    features: [
      'Unlimited EVERYTHING',
      'All 5 LinkedIn features unlimited',
      'All 3 Reddit features unlimited',
      '25 Deep Lead Searches/month',
      'Save $5 vs buying separately!',
    ],
  },
]

function PlanCard({ plan, index }) {
  const ctaStyles = {
    border: { background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)' },
    cyan: { background: '#22d3ee', color: '#0a0f1e', border: 'none' },
    amber: { background: '#f59e0b', color: '#0a0f1e', border: 'none' },
    bundle: { background: 'linear-gradient(135deg, #22d3ee, #3b82f6)', color: '#0a0f1e', border: 'none' },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
      className="relative flex flex-col rounded-2xl p-6"
      style={{
        background: plan.highlight ? 'rgba(34,211,238,0.06)' : '#111827',
        border: plan.highlight ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: plan.highlight ? '0 0 40px rgba(34,211,238,0.1)' : '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#22d3ee', color: '#0a0f1e' }}>
            {plan.badge}
          </span>
        </div>
      )}

      {plan.savings && (
        <div className="mb-3">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
            {plan.savings}
          </span>
        </div>
      )}

      <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
      <p className="text-sm text-slate-500 mb-4">{plan.description}</p>

      <div className="flex items-end gap-1 mb-6">
        <span className="text-4xl font-extrabold text-white">{plan.price}</span>
        <span className="text-slate-500 text-sm mb-1.5">{plan.period}</span>
      </div>

      <a
        href={plan.ctaHref}
        target={plan.ctaExternal ? '_blank' : undefined}
        rel={plan.ctaExternal ? 'noopener noreferrer' : undefined}
        className="block text-center font-semibold text-sm px-4 py-2.5 rounded-xl transition-all mb-6 hover:opacity-90"
        style={ctaStyles[plan.ctaStyle]}
      >
        {plan.cta}
      </a>

      <div className="mb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      <ul className="space-y-3 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#22d3ee' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#0a0f1e' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start free. Upgrade when you're ready. No hidden fees.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
