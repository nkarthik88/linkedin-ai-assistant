import { motion } from 'framer-motion'

const logos = [
  {
    label: 'LinkedIn',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#0a66c2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    label: 'Reddit',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#ff4500">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <div className="flex items-center gap-1">
              {logos.map((logo, i) => (
                <motion.div
                  key={logo.label}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
                  title={logo.label}
                >
                  {logo.svg}
                </motion.div>
              ))}
            </div>
            <span>ProPostly</span>
          </div>
          <p className="text-xs text-gray-400">AI-powered content for LinkedIn &amp; Reddit</p>
        </div>
        <nav className="flex flex-wrap justify-center gap-5 text-sm text-gray-500">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          <a href="/privacy.html" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
          <a href="/terms.html" className="hover:text-gray-900 transition-colors">Terms</a>
          <a href="mailto:support@propostly.com" className="hover:text-gray-900 transition-colors">support@propostly.com</a>
          <a href="https://x.com/Karthik23n" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">Twitter/X</a>
        </nav>
        <p className="text-xs text-gray-400 text-center sm:text-right">Made for LinkedIn &amp; Reddit creators</p>
      </div>
    </footer>
  )
}
