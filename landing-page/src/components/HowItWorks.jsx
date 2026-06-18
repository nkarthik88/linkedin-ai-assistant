import { motion } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

const steps = [
  { number: '1', icon: '🔧', title: 'Install free from Chrome Store', desc: 'One click. No account needed to start.' },
  { number: '2', icon: '🌐', title: 'Browse LinkedIn or Reddit', desc: 'ProPostly appears automatically on any page.' },
  { number: '3', icon: '✨', title: 'Click ProPostly and generate!', desc: 'AI-written content in seconds. Edit, copy, post.' },
]

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
          <p className="text-gray-500 text-lg">Three steps. No learning curve.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="flex flex-col items-center text-center bg-gray-50 rounded-2xl p-8 border border-gray-100"
            >
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 text-3xl mb-5">
                <span>{step.icon}</span>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#0a66c2] flex items-center justify-center text-xs font-bold text-white">
                  {step.number}
                </div>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-12">
          <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-sm">
            Install Free on Chrome →
          </a>
        </div>
      </div>
    </section>
  )
}
