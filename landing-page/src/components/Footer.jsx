export default function Footer() {
  return (
    <footer className="py-10 px-4 sm:px-6 lg:px-8" style={{ background: '#080c18', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <span>🟠</span>
            <span>ProPostly</span>
          </div>
          <p className="text-xs text-slate-600">AI-powered content for LinkedIn &amp; Reddit</p>
        </div>

        <nav className="flex flex-wrap justify-center gap-5 text-sm text-slate-500">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="/privacy.html" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms.html" className="hover:text-white transition-colors">Terms</a>
        </nav>

        <p className="text-xs text-slate-600 text-center sm:text-right">
          Made for LinkedIn &amp; Reddit creators
        </p>
      </div>
    </footer>
  )
}
