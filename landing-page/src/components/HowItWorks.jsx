import { motion } from 'framer-motion'

const steps = [
  {
    number: '1',
    icon: '🔧',
    title: 'Install Free',
    desc: 'Add ProPostly to Chrome in one click. No account needed to start.',
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
  {
    number: '2',
    icon: '🌐',
    title: 'Browse LinkedIn or Reddit',
    desc: 'Open any LinkedIn profile, post, or Reddit thread — ProPostly appears automatically.',
    color: '#ff4500',
    bg: '#fff4f0',
  },
  {
    number: '3',
    icon: '✨',
    title: 'Click ProPostly → Generate!',
    desc: 'Hit the ProPostly button and get AI-written content in seconds. Edit, copy, done.',
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            How it works
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Three steps. No learning curve.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px bg-gray-200" style={{ left: '18%', right: '18%' }} />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="flex flex-col items-center text-center"
            >
              {/* Step circle */}
              <div
                className="relative flex items-center justify-center w-20 h-20 rounded-full text-3xl mb-5 shadow-sm border-2"
                style={{ backgroundColor: step.bg, borderColor: step.color + '33' }}
              >
                <span>{step.icon}</span>
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: step.color }}
                >
                  {step.number}
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex justify-center mt-12"
        >
          <a
            href="https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-sm"
          >
            Install Free on Chrome →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
