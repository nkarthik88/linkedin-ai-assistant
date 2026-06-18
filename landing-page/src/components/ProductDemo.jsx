import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Typewriter hook
function useTypewriter(text, active, speed = 28) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active) { setDisplayed(''); return }
    setDisplayed('')
    let i = 0
    const t = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(t)
    }, speed)
    return () => clearInterval(t)
  }, [text, active, speed])
  return displayed
}

// ─── LinkedIn page backgrounds per feature ───────────────────────────────────
function LinkedInFeed() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">YO</div>
        <div>
          <div className="text-xs font-semibold text-gray-800">Your Name</div>
          <div className="text-[10px] text-gray-400">What do you want to talk about?</div>
        </div>
      </div>
      {['After 5 years in sales...', 'The mistake most founders...', 'I turned down a $2M deal...'].map((t, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-2 text-[10px] text-gray-500 border border-gray-100">{t}</div>
      ))}
    </div>
  )
}

function LinkedInProfile() {
  return (
    <div className="p-3">
      <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg p-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold text-sm">SM</div>
          <div>
            <div className="text-xs font-bold text-gray-900">Sarah Miller</div>
            <div className="text-[10px] text-gray-500">Head of Growth @ TechCorp</div>
            <div className="text-[10px] text-gray-400">San Francisco · 500+ connections</div>
          </div>
        </div>
      </div>
      <div className="text-[10px] text-gray-500 leading-relaxed px-1">
        Passionate about scaling B2B SaaS from 0→$10M ARR. Ex-Salesforce. Love hiking and building great teams.
      </div>
    </div>
  )
}

function LinkedInSearch() {
  const leads = [
    { name: 'Alex Chen', title: 'VP Sales · Startup', hot: true },
    { name: 'Maria Lopez', title: 'Founder · B2B SaaS', hot: true },
    { name: 'James Park', title: 'Head of Growth', hot: false },
  ]
  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] font-semibold text-gray-600 mb-2">People · 847 results</div>
      {leads.map((l, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
          <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-bold text-blue-700">
            {l.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-gray-800 truncate">{l.name}</div>
            <div className="text-[9px] text-gray-400 truncate">{l.title}</div>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${l.hot ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
            {l.hot ? '🔥 Hot' : '⚡ Warm'}
          </span>
        </div>
      ))}
    </div>
  )
}

function LinkedInPost() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-purple-200 flex items-center justify-center text-[10px] font-bold text-purple-700">JD</div>
        <div>
          <div className="text-[10px] font-bold text-gray-800">John Doe</div>
          <div className="text-[9px] text-gray-400">CEO @ Acme · 2h</div>
        </div>
      </div>
      <div className="text-[10px] text-gray-700 leading-relaxed mb-2">
        The biggest mistake I made scaling from 0 to $5M ARR was hiring too fast. Here&apos;s what I wish I knew...
      </div>
      <div className="flex gap-3 text-[9px] text-gray-400">
        <span>👍 284 likes</span><span>💬 47 comments</span>
      </div>
      <div className="mt-2 border-t border-gray-100 pt-2">
        <div className="bg-gray-50 rounded-lg px-2 py-1 text-[10px] text-gray-400">Write a reply...</div>
      </div>
    </div>
  )
}

function LinkedInHeadline() {
  return (
    <div className="p-3">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-indigo-300 flex items-center justify-center text-white font-bold text-sm">YO</div>
          <div>
            <div className="text-xs font-bold text-gray-900">Your Name</div>
            <div className="text-[10px] text-gray-500 line-through">Sales Manager at Company</div>
            <div className="text-[10px] text-blue-600 font-medium">→ Rewriting...</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Reddit page backgrounds ──────────────────────────────────────────────────
function RedditPostPage() {
  return (
    <div className="p-3">
      <div className="text-[10px] text-orange-500 font-semibold mb-1">r/entrepreneur</div>
      <div className="text-[11px] font-bold text-gray-800 mb-2">How I got my first 100 customers without paid ads</div>
      <div className="text-[10px] text-gray-500 leading-relaxed">
        Started 6 months ago with zero budget. Here&apos;s the exact playbook I used...
      </div>
      <div className="flex gap-2 mt-2 text-[9px] text-gray-400">
        <span>⬆ 2.4k</span><span>💬 183 comments</span>
      </div>
    </div>
  )
}

function RedditSubreddits() {
  const subs = ['r/entrepreneur · 2.1M', 'r/startups · 1.8M', 'r/SaaS · 340K', 'r/growthacking · 190K']
  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] font-semibold text-gray-600">Best subreddits for your audience:</div>
      {subs.map((s, i) => (
        <div key={i} className="flex items-center gap-2 bg-orange-50 rounded-lg p-2 border border-orange-100">
          <div className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center text-[9px] font-bold text-orange-700">r/</div>
          <span className="text-[10px] font-medium text-gray-700">{s}</span>
          <span className="ml-auto text-[9px] text-green-600 font-bold">✓ Match</span>
        </div>
      ))}
    </div>
  )
}

function RedditThread() {
  return (
    <div className="p-3">
      <div className="text-[10px] text-orange-500 font-semibold mb-1">r/Entrepreneur</div>
      <div className="text-[10px] font-bold text-gray-800 mb-2">What&apos;s the best way to validate a SaaS idea?</div>
      <div className="space-y-1.5">
        {['Build a landing page first and see if people sign up 👆', 'Talk to 20 potential customers before writing a single line of code'].map((c, i) => (
          <div key={i} className="bg-gray-50 rounded p-1.5 text-[9px] text-gray-600 border-l-2 border-orange-300">{c}</div>
        ))}
        <div className="bg-orange-50 rounded p-1.5 text-[9px] text-gray-400 border-l-2 border-orange-200 italic">Write a reply...</div>
      </div>
    </div>
  )
}

// ─── Feature definitions ──────────────────────────────────────────────────────
const LINKEDIN_STEPS = [
  {
    feature: 'Generate Post',
    icon: '✍️',
    tag: 'High-conversion',
    url: 'linkedin.com/feed',
    PageBg: LinkedInFeed,
    output: '🔥 "After losing my biggest client, I learned the one thing that changed everything about how I sell. Here\'s what nobody tells you..." ✨ Ready to post!',
  },
  {
    feature: 'Personalized DM',
    icon: '💬',
    tag: 'Personal',
    url: 'linkedin.com/in/sarah-miller',
    PageBg: LinkedInProfile,
    output: '"Hi Sarah! I noticed you\'re scaling growth at TechCorp — your post about PLG strategies really resonated. I\'d love to share how we helped similar B2B teams cut their sales cycle by 40%..."',
  },
  {
    feature: 'Deep Lead Search',
    icon: '🎯',
    tag: '🔥 Hot leads',
    url: 'linkedin.com/search/results/people',
    PageBg: LinkedInSearch,
    output: '✅ Found 3 Hot leads + 4 Warm leads. DMs written for all 7. Alex Chen: "Hi Alex, your work at [Startup] on enterprise sales..."',
  },
  {
    feature: 'Reply to Comment',
    icon: '🔁',
    tag: 'Engagement',
    url: 'linkedin.com/feed',
    PageBg: LinkedInPost,
    output: '"This is so true John! The best hire I ever made came 18 months in — when I finally knew exactly what \'good\' looked like. Patience is underrated in scaling."',
  },
  {
    feature: 'Improve Headline',
    icon: '📝',
    tag: 'Profile',
    url: 'linkedin.com/in/you/edit',
    PageBg: LinkedInHeadline,
    output: '✨ New headline: "Helping B2B founders close $1M+ deals | Sales strategist & advisor | Ex-Salesforce | DM me about your pipeline"',
  },
]

const REDDIT_STEPS = [
  {
    feature: 'Post Generator',
    icon: '📝',
    tag: '🛡️ Anti-ban',
    url: 'reddit.com/r/entrepreneur',
    PageBg: RedditPostPage,
    output: '✅ Anti-ban check passed! Draft: "6 months ago I had $0 and no network. Here\'s the exact cold outreach template that got me my first 50 B2B customers (steal it)..."',
  },
  {
    feature: 'Subreddit Finder',
    icon: '🔍',
    tag: 'Discovery',
    url: 'reddit.com',
    PageBg: RedditSubreddits,
    output: '🎯 Top match: r/entrepreneur (2.1M members). Your audience is most active here on Tues–Thurs 11am–2pm EST. Post there first!',
  },
  {
    feature: 'Comment Reply',
    icon: '💬',
    tag: '3 Personas',
    url: 'reddit.com/r/Entrepreneur',
    PageBg: RedditThread,
    output: '[Mentor tone] "Great question! The fastest validation method is the Concierge MVP — manually do the service for 3 customers before building anything. You\'ll learn more in a week than 6 months of coding."',
  },
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductDemo() {
  const [platform, setPlatform] = useState('linkedin')
  const [stepIdx, setStepIdx] = useState(0)
  const [phase, setPhase] = useState('idle') // idle | generating | done
  const steps = platform === 'linkedin' ? LINKEDIN_STEPS : REDDIT_STEPS
  const step = steps[stepIdx]
  const color = platform === 'linkedin' ? '#0a66c2' : '#ff4500'
  const bg = platform === 'linkedin' ? '#ebf5fb' : '#fff4f0'

  const outputText = useTypewriter(step.output, phase === 'generating' || phase === 'done', 18)

  // Auto-cycle: idle → generating → done → next step
  useEffect(() => {
    setPhase('idle')
    setStepIdx(0)
  }, [platform])

  useEffect(() => {
    setPhase('idle')
    const t1 = setTimeout(() => setPhase('generating'), 800)
    return () => clearTimeout(t1)
  }, [stepIdx])

  useEffect(() => {
    if (phase !== 'generating') return
    const charCount = step.output.length
    const duration = charCount * 18 + 600
    const t = setTimeout(() => {
      setPhase('done')
      const next = setTimeout(() => {
        setStepIdx((i) => (i + 1) % steps.length)
      }, 2000)
      return () => clearTimeout(next)
    }, duration)
    return () => clearTimeout(t)
  }, [phase, step.output, steps.length])


  const PageBg = step.PageBg

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Watch it work inside LinkedIn &amp; Reddit
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            No new tabs. No copy-pasting. ProPostly runs right inside your browser.
          </p>
        </motion.div>

        {/* Platform toggle */}
        <div className="flex justify-center mb-12">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {[
              { key: 'linkedin', label: '💼 LinkedIn', c: '#0a66c2' },
              { key: 'reddit', label: '🟠 Reddit', c: '#ff4500' },
            ].map(({ key, label, c }) => (
              <button
                key={key}
                onClick={() => setPlatform(key)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={platform === key ? { background: c, color: '#fff' } : { color: '#9ca3af' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature pill row */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <button
              key={s.feature}
              onClick={() => { setStepIdx(i); setPhase('idle') }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium transition-all"
              style={stepIdx === i
                ? { background: color, color: '#fff', boxShadow: `0 4px 14px ${color}40` }
                : { background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb' }
              }
            >
              {s.icon} {s.feature}
            </button>
          ))}
        </div>

        {/* 3D Browser mockup */}
        <div
          className="max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              transform: 'perspective(1200px) rotateX(4deg) rotateY(-8deg) scale(1.02)',
              borderRadius: '1rem',
              overflow: 'hidden',
              background: '#fff',
              border: `1px solid ${color}25`,
              boxShadow: `0 60px 140px rgba(0,0,0,0.2), 24px 24px 60px rgba(0,0,0,0.12), 0 0 0 1px ${color}15`,
            }}
          >
            <div>
                {/* Browser chrome */}
                <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step.url}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-gray-400 border border-gray-200 flex items-center gap-2"
                    >
                      <span className="text-gray-300">🔒</span>
                      {step.url}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Main content area */}
                <div className="grid grid-cols-5 min-h-[380px]">

                  {/* Left: Page background (3 cols) */}
                  <div className="col-span-3 border-r border-gray-100 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${platform}-${stepIdx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0"
                      >
                        {/* Platform header bar */}
                        <div
                          className="px-3 py-2 flex items-center gap-2 text-white text-xs font-semibold"
                          style={{ background: color }}
                        >
                          {platform === 'linkedin' ? (
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                          )}
                          {platform === 'linkedin' ? 'LinkedIn' : 'Reddit'}
                        </div>
                        <PageBg />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Right: ProPostly extension panel (2 cols) */}
                  <div className="col-span-2 flex flex-col" style={{ background: '#fafafa' }}>
                    {/* Panel header */}
                    <div className="px-3 py-2.5 flex items-center gap-2 border-b border-gray-100" style={{ background: bg }}>
                      <span className="text-sm">{platform === 'linkedin' ? '💼' : '🟠'}</span>
                      <span className="text-xs font-bold" style={{ color }}>ProPostly</span>
                      <span className="ml-auto text-[9px] text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">● Active</span>
                    </div>

                    {/* Feature list */}
                    <div className="flex-1 overflow-hidden">
                      {steps.map((s, i) => (
                        <motion.div
                          key={s.feature}
                          animate={stepIdx === i ? { backgroundColor: bg } : { backgroundColor: '#fafafa' }}
                          className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 cursor-pointer"
                          onClick={() => { setStepIdx(i); setPhase('idle') }}
                        >
                          <span className="text-xs">{s.icon}</span>
                          <span className="text-[10px] font-semibold text-gray-700 flex-1">{s.feature}</span>
                          {stepIdx === i && phase === 'generating' && (
                            <motion.span
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ repeat: Infinity, duration: 0.8 }}
                              className="text-[9px] font-bold"
                              style={{ color }}
                            >
                              ● Writing...
                            </motion.span>
                          )}
                          {stepIdx === i && phase === 'done' && (
                            <span className="text-[9px] font-bold text-green-600">✓ Done</span>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* Output area */}
                    <div className="p-3 border-t border-gray-100" style={{ minHeight: 110 }}>
                      <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        {phase === 'idle' ? 'Click a feature to start' : phase === 'generating' ? `Generating ${step.feature}...` : `✓ ${step.feature} ready`}
                      </div>
                      <AnimatePresence mode="wait">
                        {phase !== 'idle' && (
                          <motion.div
                            key={`output-${stepIdx}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] text-gray-700 leading-relaxed rounded-lg p-2"
                            style={{ background: bg, border: `1px solid ${color}20`, minHeight: 72 }}
                          >
                            {outputText}
                            {phase === 'generating' && (
                              <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                                className="inline-block w-0.5 h-3 ml-0.5 align-middle"
                                style={{ background: color }}
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* CTA */}
                    <div className="px-3 pb-3">
                      <button
                        className="w-full py-2 rounded-lg text-white text-xs font-bold transition-opacity hover:opacity-90"
                        style={{ background: color }}
                      >
                        Try it free →
                      </button>
                    </div>
                  </div>
                </div>
            </div>
          </motion.div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => { setStepIdx(i); setPhase('idle') }}
              className="rounded-full transition-all"
              style={{ width: stepIdx === i ? 28 : 8, height: 8, background: stepIdx === i ? color : '#e2e8f0' }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
