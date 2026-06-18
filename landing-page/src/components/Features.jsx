import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const linkedinFeatures = [
  {
    icon: '✍️',
    title: 'Generate Post',
    desc: 'Get 3 ready-to-publish post options from any topic in seconds.',
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
  {
    icon: '💬',
    title: 'Personalized DM',
    desc: "Reads their LinkedIn profile and writes a DM tailored to them.",
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
  {
    icon: '🔁',
    title: 'Reply to Comment',
    desc: 'Thoughtful replies that grow your engagement and reach.',
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
  {
    icon: '📝',
    title: 'Improve Headline',
    desc: 'Rewrite your headline to attract the right people.',
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
  {
    icon: '🎯',
    title: 'Deep Lead Search',
    desc: 'Scan search results, get Hot/Warm rated leads with DMs ready to send. LinkedIn only.',
    color: '#0a66c2',
    bg: '#ebf5fb',
  },
]

const redditFeatures = [
  {
    icon: '📝',
    title: 'Post Generator',
    desc: '3 post options with anti-ban check. Quick, From URL, or Community Scan mode.',
    color: '#ff4500',
    bg: '#fff4f0',
  },
  {
    icon: '🔍',
    title: 'Subreddit Finder',
    desc: 'Discover where your audience actually hangs out.',
    color: '#ff4500',
    bg: '#fff4f0',
  },
  {
    icon: '💬',
    title: 'Comment Reply',
    desc: 'Mentor, Witty, or Curious tone — fits the community style.',
    color: '#ff4500',
    bg: '#fff4f0',
  },
]

function FeatureCard({ feature, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow"
    >
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl mb-5"
        style={{ backgroundColor: feature.bg }}
      >
        {feature.icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
    </motion.div>
  )
}

export default function Features() {
  const [platform, setPlatform] = useState('linkedin')
  const features = platform === 'linkedin' ? linkedinFeatures : redditFeatures

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything you need to grow
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            5 powerful LinkedIn tools and 3 Reddit tools — all living inside your browser.
          </p>
        </motion.div>

        {/* Platform toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1">
            <button
              onClick={() => setPlatform('linkedin')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                platform === 'linkedin'
                  ? 'bg-[#0a66c2] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              💼 LinkedIn Features
            </button>
            <button
              onClick={() => setPlatform('reddit')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                platform === 'reddit'
                  ? 'bg-[#ff4500] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🟠 Reddit Features
            </button>
          </div>
        </div>

        {/* Anti-ban badge for Reddit */}
        <AnimatePresence>
          {platform === 'reddit' && (
            <motion.div
              key="antibanbadge"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex justify-center mb-6"
            >
              <span className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-full">
                🛡️ Anti-ban protection built-in
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={platform}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`grid gap-5 ${
              platform === 'linkedin'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-3'
            }`}
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
