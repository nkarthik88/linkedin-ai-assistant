import { useState } from 'react'
import { motion } from 'framer-motion'

// Replace this with your Loom embed URL when available
// e.g. 'https://www.loom.com/embed/YOUR_VIDEO_ID'
const LOOM_EMBED_URL = null

export default function VideoSection() {
  const [playing, setPlaying] = useState(false)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            See ProPostly in Action
          </h2>
          <p className="text-gray-500 text-lg">
            Watch how it works — directly inside LinkedIn and Reddit.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-gray-50"
          style={{ aspectRatio: '16/9' }}
        >
          {LOOM_EMBED_URL ? (
            <iframe
              src={LOOM_EMBED_URL}
              frameBorder="0"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              title="ProPostly demo"
            />
          ) : (
            /* Placeholder until Loom URL is added */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white">
              <button
                onClick={() => setPlaying(true)}
                className="flex items-center justify-center w-20 h-20 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white shadow-xl transition-colors mb-4"
                aria-label="Play demo"
              >
                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <p className="text-sm text-gray-400">Demo video coming soon</p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
