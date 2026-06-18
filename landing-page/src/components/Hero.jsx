import { useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

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
  const cardRef = useRef(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateY = useSpring(useTransform(mouseX, [-150, 150], [18, -18]), { stiffness: 150, damping: 20 })
  const rotateX = useSpring(useTransform(mouseY, [-150, 150], [-12, 12]), { stiffness: 150, damping: 20 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    mouseX.set(e.clientX - centerX)
    mouseY.set(e.clientY - centerY)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  const isLinkedIn = platform === 'linkedin'
  const accent = isLinkedIn ? '#22d3ee' : '#f59e0b'
  const accentBg = isLinkedIn ? 'rgba(34,211,238,0.08)' : 'rgba(245,158,11,0.08)'
  const features = isLinkedIn ? linkedinFeatures : redditFeatures

  return (
    <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(160deg, #0a0f1e 60%, #0d1a2e 100%)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}>
              <span>✨</span>
              <span>AI-Powered Chrome Extension</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
              Master LinkedIn &amp; Reddit
              <br />
              <span style={{ color: '#22d3ee' }}>from one side panel</span>
            </h1>

            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              ProPostly is your AI command center for content, leads, and engagement.
              Never leave your browser.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <a
                href={CHROME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all text-sm shadow-lg"
                style={{ background: '#22d3ee', color: '#0a0f1e', boxShadow: '0 0 24px rgba(34,211,238,0.35)' }}
              >
                Install on Chrome — It&apos;s Free →
              </a>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors text-sm text-slate-300 hover:text-white"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              >
                See Plans ↓
              </a>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Works on:</span>
              {browsers.map((b) => (
                <div key={b.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{b.icon}</span>
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — 3D interactive mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
            className="flex flex-col items-center"
          >
            {/* Platform toggle */}
            <div className="flex rounded-xl p-1 mb-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setPlatform('linkedin')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={isLinkedIn ? { background: '#22d3ee', color: '#0a0f1e' } : { color: '#94a3b8' }}
              >
                💼 LinkedIn
              </button>
              <button
                onClick={() => setPlatform('reddit')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={!isLinkedIn ? { background: '#f59e0b', color: '#0a0f1e' } : { color: '#94a3b8' }}
              >
                🟠 Reddit
              </button>
            </div>

            {/* 3D card — mouse drag effect */}
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ perspective: '1000px', cursor: 'grab' }}
              className="w-full max-w-sm"
            >
              <motion.div
                style={{
                  rotateY,
                  rotateX,
                  transformStyle: 'preserve-3d',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                  background: '#111827',
                  border: `1px solid ${accent}33`,
                  boxShadow: `0 25px 60px rgba(0,0,0,0.5), 0 0 40px ${accent}22`,
                }}
              >
                {/* Browser bar */}
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: '#0d1117', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 rounded-md px-3 py-1 text-xs text-slate-500 ml-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {isLinkedIn ? 'linkedin.com' : 'reddit.com'}
                  </div>
                </div>

                {/* Panel header */}
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: accentBg, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-lg">{isLinkedIn ? '💼' : '🟠'}</span>
                  <span className="font-bold text-sm" style={{ color: accent }}>
                    ProPostly {isLinkedIn ? 'LinkedIn' : 'Reddit'}
                  </span>
                </div>

                {/* Feature rows */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={platform}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {features.map((f) => (
                      <div key={f.label} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className="text-base">{f.icon}</span>
                        <span className="text-sm font-medium text-slate-200 flex-1">{f.label}</span>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: accent }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* CTA */}
                <div className="p-4">
                  <button
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: accent, color: '#0a0f1e' }}
                  >
                    Try it free →
                  </button>
                </div>
              </motion.div>
            </div>

            <p className="mt-4 text-xs text-slate-600">← Drag to rotate</p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
