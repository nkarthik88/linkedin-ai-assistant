import { motion } from 'framer-motion'

export default function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-50">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Start growing today — it&apos;s free
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            No credit card. No setup. Just install and start.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] text-white font-bold text-base px-8 py-4 rounded-xl transition-colors shadow-md"
          >
            Install Free on Chrome →
          </a>
          <p className="mt-4 text-sm text-gray-400">
            Works on Chrome · Brave · Opera · Vivaldi
          </p>
        </motion.div>
      </div>
    </section>
  )
}
