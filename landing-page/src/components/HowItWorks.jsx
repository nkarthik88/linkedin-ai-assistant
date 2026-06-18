import { motion } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

const steps = [
  {
    number: '1',
    icon: '🔧',
    title: 'Install free from Chrome Store',
    desc: 'One click. No account needed to start.',
    accent: '#22d3ee',
  },
  {
    number: '2',
    icon: '🌐',
    title: 'Browse LinkedIn or Reddit',
    desc: 'ProPostly appears automatically on any LinkedIn profile, post, or Reddit thread.',
    accent: '#f59e0b',
  },
  {
    number: '3',
    icon: '✨',
    title: 'Click ProPostly and generate!',
    desc: 'Get AI-written content in seconds. Edit, copy, post — done.',
    accent: '#22d3ee',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#080c18' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How it works</h2>
          <p className="text-slate-400 text-lg">Three steps. No learning curve.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="flex flex-col items-center text-center rounded-2xl p-8"
              style={{ background: '#111827', border: `1px solid ${step.accent}18` }}
            >
              <div
                className="relative flex items-center justify-center w-20 h-20 rounded-full text-3xl mb-5"
                style={{ background: `${step.accent}12`, border: `1px solid ${step.accent}25` }}
              >
                <span>{step.icon}</span>
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: step.accent, color: '#0a0f1e' }}
                >
                  {step.number}
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex justify-center mt-12"
        >
          <a
            href={CHROME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all text-sm"
            style={{ background: '#22d3ee', color: '#0a0f1e', boxShadow: '0 0 24px rgba(34,211,238,0.3)' }}
          >
            Install Free on Chrome →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
