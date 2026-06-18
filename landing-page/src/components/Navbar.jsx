import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CHROME_URL = 'https://chromewebstore.google.com/detail/hggehcjcbnfpdglbildpaiidhigfcnbb'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoIdx, setLogoIdx] = useState(0)
  const logos = ['💼', '🟠']

  useEffect(() => {
    const t = setInterval(() => setLogoIdx((i) => (i + 1) % logos.length), 2000)
    return () => clearInterval(t)
  }, [])

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
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? 'shadow-md' : 'border-b border-gray-100'}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#" className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <span className="relative inline-block w-6 h-6 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={logoIdx}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {logos[logoIdx]}
                </motion.span>
              </AnimatePresence>
            </span>
            <span>ProPostly</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:block">
            <a
              href={CHROME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-[#0a66c2] hover:bg-[#004182] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Install Free →
            </a>
          </div>

          <button className="md:hidden p-2 rounded-md text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden border-t border-gray-100 py-4 space-y-3">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMenuOpen(false)}>{l.label}</a>
            ))}
            <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-[#0a66c2] text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Install Free →
            </a>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}
