import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion'

const PLATFORMS = {
  linkedin: {
    label: '💼 LinkedIn',
    color: '#0a66c2',
    bg: '#ebf5fb',
    lightBg: '#f0f8ff',
    url: 'linkedin.com',
    title: 'ProPostly LinkedIn',
    features: [
      { icon: '✍️', name: 'Generate Post', desc: '3 human-sounding post options in seconds', tag: 'High-conversion' },
      { icon: '💬', name: 'Personalized DM', desc: 'Reads their profile, writes a DM just for them', tag: 'Personal' },
      { icon: '🎯', name: 'Deep Lead Search', desc: 'Hot/Warm rated leads with DMs ready to send', tag: 'Sales' },
      { icon: '🔁', name: 'Reply to Comment', desc: 'Thoughtful replies that grow your reach', tag: 'Engagement' },
      { icon: '📝', name: 'Improve Headline', desc: 'Attract the right people and opportunities', tag: 'Profile' },
    ],
  },
  reddit: {
    label: '🟠 Reddit',
    color: '#ff4500',
    bg: '#fff4f0',
    lightBg: '#fff8f6',
    url: 'reddit.com',
    title: 'ProPostly Reddit',
    features: [
      { icon: '📝', name: 'Post Generator', desc: '3 modes: Quick, From URL, Community Scan', tag: '🛡️ Anti-ban' },
      { icon: '🔍', name: 'Subreddit Finder', desc: 'Find where your audience actually hangs out', tag: 'Discovery' },
      { icon: '💬', name: 'Comment Reply', desc: 'Mentor, Witty, or Curious — fits the community', tag: '3 Personas' },
    ],
  },
}

export default function FeaturesShowcase() {
  const [platform, setPlatform] = useState('linkedin')
  const [activeIdx, setActiveIdx] = useState(0)
  const cardRef = useRef(null)

  const p = PLATFORMS[platform]

  // Auto-cycle features
  useEffect(() => {
    setActiveIdx(0)
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % p.features.length)
    }, 2200)
    return () => clearInterval(t)
  }, [platform, p.features.length])

  // 3D mouse tilt
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateY = useSpring(useTransform(mouseX, [-160, 160], [14, -14]), { stiffness: 120, damping: 18 })
  const rotateX = useSpring(useTransform(mouseY, [-160, 160], [-10, 10]), { stiffness: 120, damping: 18 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (rect.left + rect.width / 2))
    mouseY.set(e.clientY - (rect.top + rect.height / 2))
  }
  const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0) }

  const switchPlatform = (pl) => {
    if (pl === platform) return
    setPlatform(pl)
  }

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            See it work in real time
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Every feature runs directly inside LinkedIn and Reddit. No new tabs, no copy-pasting.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: feature list */}
          <div>
            {/* Platform toggle */}
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-8 w-fit">
              {Object.entries(PLATFORMS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => switchPlatform(key)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={platform === key
                    ? { backgroundColor: val.color, color: '#fff' }
                    : { color: '#9ca3af' }
                  }
                >
                  {val.label}
                </button>
              ))}
            </div>

            {/* Feature list */}
            <AnimatePresence mode="wait">
              <motion.div
                key={platform}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {p.features.map((f, i) => (
                  <motion.button
                    key={f.name}
                    onClick={() => setActiveIdx(i)}
                    className="w-full text-left rounded-2xl px-5 py-4 flex items-start gap-4 transition-all"
                    style={activeIdx === i
                      ? { background: p.bg, border: `1.5px solid ${p.color}40`, boxShadow: `0 4px 20px ${p.color}18` }
                      : { background: '#ffffff', border: '1.5px solid #f1f5f9' }
                    }
                    whileHover={{ scale: 1.01 }}
                  >
                    <span className="text-2xl mt-0.5">{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{f.name}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${p.color}15`, color: p.color }}
                        >
                          {f.tag}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{f.desc}</p>
                    </div>
                    {activeIdx === i && (
                      <motion.div
                        layoutId="activeCheck"
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ background: p.color }}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Progress dots */}
            <div className="flex gap-2 mt-5 pl-1">
              {p.features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: activeIdx === i ? 24 : 8,
                    height: 8,
                    background: activeIdx === i ? p.color : '#e2e8f0',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right: 3D browser mockup */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: '1200px' }}
            className="flex flex-col items-center"
          >
            <motion.div
              style={{
                rotateY,
                rotateX,
                transformStyle: 'preserve-3d',
              }}
              className="w-full max-w-sm"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={platform}
                  initial={{ opacity: 0, rotateY: -25 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: 25 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${p.color}30`,
                    boxShadow: `0 32px 80px rgba(0,0,0,0.14), 0 0 0 1px ${p.color}15, 20px 20px 40px rgba(0,0,0,0.08)`,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Browser bar */}
                  <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1 text-xs text-gray-400 ml-2">
                      {p.url}
                    </div>
                  </div>

                  {/* Panel header */}
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: p.bg }}>
                    <span className="text-lg">{platform === 'linkedin' ? '💼' : '🟠'}</span>
                    <span className="font-bold text-sm" style={{ color: p.color }}>{p.title}</span>
                    <span className="ml-auto text-xs text-gray-400 font-medium">AI Ready ✓</span>
                  </div>

                  {/* Feature rows — auto-highlight */}
                  <div className="divide-y divide-gray-50">
                    {p.features.map((f, i) => (
                      <motion.div
                        key={f.name}
                        animate={activeIdx === i
                          ? { backgroundColor: p.bg, x: 4 }
                          : { backgroundColor: '#ffffff', x: 0 }
                        }
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="text-base">{f.icon}</span>
                        <span className="text-sm font-medium text-gray-700 flex-1">{f.name}</span>
                        <AnimatePresence>
                          {activeIdx === i && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="flex items-center gap-1"
                            >
                              <motion.div
                                animate={{ opacity: [1, 0.4, 1] }}
                                transition={{ repeat: Infinity, duration: 1.2 }}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: p.color }}
                              />
                              <span className="text-xs font-semibold" style={{ color: p.color }}>Generating...</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {activeIdx !== i && (
                          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* Active feature output preview */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${platform}-${activeIdx}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mx-4 mb-4 mt-2 rounded-xl p-3 text-xs text-gray-500 leading-relaxed overflow-hidden"
                      style={{ background: p.lightBg, border: `1px dashed ${p.color}30` }}
                    >
                      <span className="font-semibold" style={{ color: p.color }}>✓ {p.features[activeIdx].name}</span>
                      {' — '}{p.features[activeIdx].desc}
                    </motion.div>
                  </AnimatePresence>

                  {/* CTA */}
                  <div className="px-4 pb-4">
                    <button
                      className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
                      style={{ background: p.color }}
                    >
                      Try it free →
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <p className="mt-4 text-xs text-gray-400">Move your mouse over the card to rotate it</p>
          </div>
        </div>
      </div>
    </section>
  )
}
