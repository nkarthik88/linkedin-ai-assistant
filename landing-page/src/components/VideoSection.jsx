import { motion } from 'framer-motion'

const LOOM_EMBED_URL = 'https://www.loom.com/embed/66c84013e4b24c4c9d93c2d7f79bbb97'

export default function VideoSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#0a0f1e' }}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            See ProPostly in Action
          </h2>
          <p className="text-slate-400 text-lg">
            Watch how it works — directly inside LinkedIn and Reddit.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            aspectRatio: '16/9',
            border: '1px solid rgba(34,211,238,0.15)',
            boxShadow: '0 0 60px rgba(34,211,238,0.08)',
          }}
        >
          <iframe
            src={LOOM_EMBED_URL}
            frameBorder="0"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            title="ProPostly demo"
          />
        </motion.div>
      </div>
    </section>
  )
}
