export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Left — logo + tagline */}
        <div className="flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span>🟠</span>
            <span>ProPostly</span>
          </div>
          <p className="text-xs text-gray-400">AI-powered content for LinkedIn &amp; Reddit</p>
        </div>

        {/* Center — links */}
        <nav className="flex flex-wrap justify-center gap-5 text-sm text-gray-500">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          <a href="/privacy.html" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
          <a href="/terms.html" className="hover:text-gray-900 transition-colors">Terms</a>
        </nav>

        {/* Right */}
        <p className="text-xs text-gray-400 text-center sm:text-right">
          Made for LinkedIn &amp; Reddit creators
        </p>
      </div>
    </footer>
  )
}
