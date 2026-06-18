import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const linkedinFeatures = [
  { icon: '✍️', label: 'Generate Post' },
  { icon: '💬', label: 'Personalized DM' },
  { icon: '🎯', label: 'Deep Lead Search' },
  { icon: '🔁', label: 'Reply to Comment' },
  { icon: '📝', label: 'Improve Headline' },
]

const redditFeatures = [
  { icon: '📝', label: 'Post Generator' },
  { icon: '🔍', label: 'Subreddit Finder' },
  { icon: '💬', label: 'Comment Reply' },
]

const browsers = [
  { name: 'Chrome', icon: '🟡' },
  { name: 'Brave', icon: '🦁' },
  { name: 'Opera', icon: '🔴' },
  { name: 'Vivaldi', icon: '🎵' },
]

export default function Hero() {
  const [platform, setPlatform] = useState('linkedin')

  const accentColor = platform === 'linkedin' ? '#0a66c2' : '#ff4500'
  const features = platform === 'linkedin' ? linkedinFeatures : redditFeatures

  return (
    <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
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
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
              Grow on LinkedIn &amp; Reddit with AI that{' '}
              <span className="text-[#0a66c2]">writes like you</span>
            </h1>

            {/* Subtext */}
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              Generate posts, find leads, write DMs — all inside your browser. No tab switching. Free to start.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-8">
              <a
                href="#"
                className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-sm"
              >
                Install Free on Chrome →
              </a>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                See Plans ↓
              </a>
            </div>

            {/* Browser row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Works on all Chromium browsers:</span>
              {browsers.map((b) => (
                <div key={b.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span>{b.icon}</span>
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
            className="flex flex-col items-center"
          >
            {/* Platform toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setPlatform('linkedin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  platform === 'linkedin'
                    ? 'bg-white text-[#0a66c2] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                💼 LinkedIn
              </button>
              <button
                onClick={() => setPlatform('reddit')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  platform === 'reddit'
                    ? 'bg-white text-[#ff4500] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🟠 Reddit
              </button>
            </div>

            {/* Mockup card */}
            <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
              {/* Browser bar */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1 text-xs text-gray-400 ml-2">
                  {platform === 'linkedin' ? 'linkedin.com' : 'reddit.com'}
                </div>
              </div>

              {/* Panel header */}
              <div
                className="px-4 py-3 flex items-center gap-2"
                style={{ backgroundColor: platform === 'linkedin' ? '#ebf5fb' : '#fff4f0' }}
              >
                <span className="text-lg">{platform === 'linkedin' ? '💼' : '🟠'}</span>
                <span className="font-bold text-sm" style={{ color: accentColor }}>
                  ProPostly {platform === 'linkedin' ? 'LinkedIn' : 'Reddit'}
                </span>
              </div>

              {/* Feature rows */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={platform}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="divide-y divide-gray-100"
                >
                  {features.map((f) => (
                    <div key={f.label} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <span className="text-base">{f.icon}</span>
                      <span className="text-sm font-medium text-gray-700 flex-1">{f.label}</span>
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: accentColor }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* CTA in panel */}
              <div className="p-4">
                <button
                  className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  Try it free →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
