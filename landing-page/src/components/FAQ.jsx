import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const faqs = [
  { q: 'Is ProPostly really free?', a: 'Yes. The free plan includes 5 uses per feature per month with no credit card required. Install and start immediately.' },
  { q: 'Which browsers does it work on?', a: 'Chrome, Brave, Opera, and Vivaldi — any Chromium-based browser.' },
  { q: 'Does it work on both LinkedIn and Reddit?', a: 'Yes. LinkedIn and Reddit features are completely separate. Upgrade one or both independently.' },
  { q: 'Is my data safe?', a: 'ProPostly only reads the LinkedIn or Reddit page you are actively viewing. No data is stored or sold.' },
  { q: 'What is Deep Lead Search?', a: 'Scans LinkedIn people search results, rates each profile as Hot or Warm based on your target, and writes a personalized DM for each lead.' },
  { q: 'What is the anti-ban protection?', a: 'Every Reddit post goes through an automatic check to flag content that could trigger Reddit spam filters before you post.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from inside the extension at any time. No contracts, no fees.' },
]

function FAQItem({ faq, index }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="border-b border-gray-200 last:border-0"
    >
      <button onClick={() => setOpen(!open)} className="flex items-start justify-between w-full py-5 text-left gap-4">
        <span className="text-sm font-semibold text-gray-900">{faq.q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0 mt-0.5 text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="pb-5 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQ() {
  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
          <p className="text-gray-500 text-lg">Everything you need to know before installing.</p>
        </motion.div>
        <div className="bg-white border border-gray-200 rounded-2xl px-6">
          {faqs.map((faq, i) => <FAQItem key={faq.q} faq={faq} index={i} />)}
        </div>
      </div>
    </section>
  )
}
