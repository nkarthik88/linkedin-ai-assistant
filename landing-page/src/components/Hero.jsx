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

const browsers = [
  {
    name: 'Chrome',
    url: CHROME_URL,
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <circle cx="12" cy="12" r="10" fill="#fff" stroke="#e5e7eb" strokeWidth="0.5"/>
        <circle cx="12" cy="12" r="4.2" fill="#4285F4"/>
        <path d="M12 7.8h8.5a10 10 0 0 0-17-1.1z" fill="#EA4335"/>
        <path d="M20.5 7.8H12l-4.25 7.35A10 10 0 0 0 20.5 7.8z" fill="#FBBC05"/>
        <path d="M7.75 15.15 3.5 7.8a10 10 0 0 0 8.2 14.15z" fill="#34A853"/>
      </svg>
    ),
  },
  {
    name: 'Brave',
    url: CHROME_URL,
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FB542B">
        <path d="M20.92 9.13l.27-1.35-.93-.85.19-1.36-1.27-.53-.46-1.29-1.38.07-.92-1.02-1.3.52L12 2.5l-3.12.82-1.3-.52-.92 1.02-1.38-.07-.46 1.29-1.27.53.19 1.36-.93.85.27 1.35-.56 1.23.56 1.23s.38 2.55 2.41 4.58c2.04 2.04 4.72 3.52 4.72 3.52s2.68-1.48 4.72-3.52c2.03-2.03 2.41-4.58 2.41-4.58l.56-1.23z"/>
      </svg>
    ),
  },
  {
    name: 'Opera',
    url: CHROME_URL,
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FF1B2D">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17.5c-2.07 0-3.93-1.04-5.08-2.64A7.46 7.46 0 0 1 4.5 12c0-1.71.57-3.28 1.52-4.54C7.14 5.95 9.01 4.5 12 4.5s4.86 1.45 5.98 2.96A7.46 7.46 0 0 1 19.5 12a7.46 7.46 0 0 1-1.42 4.36C16.93 18.46 14.07 19.5 12 19.5z"/>
      </svg>
    ),
  },
  {
    name: 'Vivaldi',
    url: CHROME_URL,
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#EF3939">
        <path d="M12 2L3 7v10l9 5 9-5V7L12 2zm0 2.5l6.5 3.6v7.3L12 19l-6.5-3.6V8.1L12 4.5z"/>
        <path d="M12 8l-4 7h8l-4-7z" fill="#EF3939"/>
      </svg>
    ),
  },
]

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
            <span>Free Chrome Extension for LinkedIn &amp; Reddit</span>
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

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400">Works on:</span>
            {browsers.map((b) => (
              <a
                key={b.name}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5 transition-colors font-medium"
              >
                {b.svg}
                {b.name}
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
