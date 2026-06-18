import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(10,15,30,0.95)' : 'rgba(10,15,30,0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#" className="flex items-center gap-2 text-xl font-bold text-white">
            <span>🟠</span>
            <span>ProPostly</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:block">
            <a
              href={CHROME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{ background: '#22d3ee', color: '#0a0f1e' }}
            >
              Install Free →
            </a>
          </div>

          <button
            className="md:hidden p-2 rounded-md text-slate-400 hover:text-white transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t py-4 space-y-3"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {links.map((l) => (
              <a key={l.label} href={l.href} className="block text-sm font-medium text-slate-400 hover:text-white py-1 transition-colors" onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
            <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: '#22d3ee', color: '#0a0f1e' }}>
              Install Free →
            </a>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}
