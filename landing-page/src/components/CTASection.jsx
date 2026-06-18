import { motion } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

export default function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#0a0f1e' }}>
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl py-16 px-8"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(59,130,246,0.08))',
            border: '1px solid rgba(34,211,238,0.15)',
            boxShadow: '0 0 80px rgba(34,211,238,0.06)',
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Start growing today — it&apos;s free
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            No credit card. No setup. Just install and start.
          </p>
          <a
            href={CHROME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-base px-8 py-4 rounded-xl transition-all"
            style={{ background: '#22d3ee', color: '#0a0f1e', boxShadow: '0 0 32px rgba(34,211,238,0.4)' }}
          >
            Install Free on Chrome →
          </a>
          <p className="mt-4 text-sm text-slate-600">
            Works on Chrome · Brave · Opera · Vivaldi
          </p>
        </motion.div>
      </div>
    </section>
  )
}
