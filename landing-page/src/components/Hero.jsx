import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

const actions = [
  { text: 'LinkedIn posts', color: '#0a66c2' },
  { text: 'Reddit threads', color: '#ff4500' },
  { text: 'personalized DMs', color: '#0a66c2' },
  { text: 'lead outreach', color: '#0a66c2' },
  { text: 'comment replies', color: '#ff4500' },
]

const browsers = ['Chrome', 'Brave', 'Opera', 'Vivaldi']

export default function Hero() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % actions.length), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full mb-6">
            <span>✨</span>
            <span>AI-Powered Chrome Extension</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-4">
            One click.
            <br />
            AI writes it.
            <br />
            <span className="text-gray-400 font-semibold text-4xl sm:text-5xl">You take the credit.</span>
          </h1>

          {/* Animated use-case line */}
          <div className="flex items-center justify-center gap-3 mb-6 text-2xl sm:text-3xl font-bold h-12 overflow-hidden">
            <span className="text-gray-700">AI for your</span>
            <span className="relative inline-block min-w-[300px] text-left">
              <AnimatePresence mode="wait">
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="inline-block"
                  style={{ color: actions[idx].color }}
                >
                  {actions[idx].text}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <p className="text-lg text-gray-500 mb-10 leading-relaxed max-w-xl mx-auto">
            ProPostly lives inside your browser. Open LinkedIn or Reddit, click once — and your content is ready to post.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <a
              href={CHROME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] text-white font-bold px-8 py-4 rounded-xl transition-colors text-base shadow-lg"
            >
              Install on Chrome — It&apos;s Free →
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-6 py-4 rounded-xl transition-colors text-base"
            >
              See how it works ↓
            </a>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="text-sm text-gray-400">Works on all Chromium browsers:</span>
            {browsers.map((b) => (
              <span key={b} className="text-sm text-gray-500">{b}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
