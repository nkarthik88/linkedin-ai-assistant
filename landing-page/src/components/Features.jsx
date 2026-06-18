import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const linkedinFeatures = [
  {
    icon: '✍️',
    title: 'Generate Post',
    desc: '3 human-sounding post options from any topic. High-conversion copy that sounds like you.',
    accent: '#22d3ee',
  },
  {
    icon: '💬',
    title: 'Personalized DM',
    desc: 'Reads their LinkedIn profile and writes a DM tailored to them. Not a template — personal.',
    accent: '#22d3ee',
  },
  {
    icon: '🔁',
    title: 'Reply to Comment',
    desc: 'Thoughtful, human-sounding replies that grow your engagement and reach.',
    accent: '#22d3ee',
  },
  {
    icon: '📝',
    title: 'Improve Headline',
    desc: 'Rewrite your headline to attract the right people and opportunities.',
    accent: '#22d3ee',
  },
  {
    icon: '🎯',
    title: 'Deep Lead Search',
    desc: 'Scan search results, get Hot/Warm rated leads with DMs ready to send.',
    accent: '#22d3ee',
  },
]

const redditFeatures = [
  {
    icon: '📝',
    title: 'Post Generator',
    desc: '3 post modes: Quick, From URL, or Community Scan. Auto anti-ban check on every post.',
    accent: '#f59e0b',
    badge: '🛡️ Anti-ban protection',
  },
  {
    icon: '🔍',
    title: 'Subreddit Finder',
    desc: 'Discover where your audience actually hangs out. Stop posting in the wrong communities.',
    accent: '#f59e0b',
  },
  {
    icon: '💬',
    title: 'Comment Reply',
    desc: 'Mentor, Witty, or Curious persona — fits the community style perfectly.',
    accent: '#f59e0b',
  },
]

function FeatureCard({ feature, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="rounded-2xl p-7 hover:scale-[1.02] transition-transform"
      style={{
        background: '#111827',
        border: `1px solid ${feature.accent}22`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
      }}
    >
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl mb-5"
        style={{ background: `${feature.accent}15`, border: `1px solid ${feature.accent}30` }}
      >
        {feature.icon}
      </div>
      {feature.badge && (
        <div className="mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
            {feature.badge}
          </span>
        </div>
      )}
      <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
    </motion.div>
  )
}

export default function Features() {
  const [platform, setPlatform] = useState('linkedin')
  const isLinkedIn = platform === 'linkedin'
  const features = isLinkedIn ? linkedinFeatures : redditFeatures
  const accent = isLinkedIn ? '#22d3ee' : '#f59e0b'

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#080c18' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to grow
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            5 LinkedIn tools and 3 Reddit tools — all living inside your browser.
          </p>
        </motion.div>

        {/* Platform toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setPlatform('linkedin')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={isLinkedIn ? { background: '#22d3ee', color: '#0a0f1e' } : { color: '#64748b' }}
            >
              💼 LinkedIn Features
            </button>
            <button
              onClick={() => setPlatform('reddit')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={!isLinkedIn ? { background: '#f59e0b', color: '#0a0f1e' } : { color: '#64748b' }}
            >
              🟠 Reddit Features
            </button>
          </div>
        </div>

        {/* Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={platform}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`grid gap-5 ${isLinkedIn ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}
          >
            {features.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
