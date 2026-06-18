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
    ctaStyle: 'linkedin',
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
    ctaStyle: 'reddit',
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
    description: 'Everything, unlimited.',
    highlight: true,
    badge: 'Best Value',
    savings: 'SAVE $5/month',
    cta: 'Get Bundle',
    ctaHref: 'https://checkout.dodopayments.com/buy/pdt_0Nh23AJmTvBuWAXKsi2ds',
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

const ctaClasses = {
  border: 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50',
  linkedin: 'bg-[#0a66c2] hover:bg-[#004182] text-white',
  reddit: 'bg-[#ff4500] hover:bg-[#cc3700] text-white',
  bundle: 'bg-[#0a66c2] hover:bg-[#004182] text-white',
}

function PlanCard({ plan, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
      className={`relative flex flex-col rounded-2xl p-6 bg-white ${plan.highlight ? 'border-2 border-[#0a66c2] shadow-lg' : 'border border-gray-200 shadow-sm'}`}
    >
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-[#0a66c2] text-white text-xs font-bold px-3 py-1 rounded-full">{plan.badge}</span>
        </div>
      )}
      {plan.savings && (
        <div className="mb-3">
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">{plan.savings}</span>
        </div>
      )}
      <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
      <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
      <div className="flex items-end gap-1 mb-6">
        <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
        <span className="text-gray-400 text-sm mb-1.5">{plan.period}</span>
      </div>
      <a
        href={plan.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`block text-center font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors mb-6 ${ctaClasses[plan.ctaStyle]}`}
      >
        {plan.cta}
      </a>
      <div className="border-t border-gray-100 mb-4" />
      <ul className="space-y-3 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">Start free. Upgrade when you're ready. No hidden fees.</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => <PlanCard key={plan.name} plan={plan} index={i} />)}
        </div>
      </div>
    </section>
  )
}
