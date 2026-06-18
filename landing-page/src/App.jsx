import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturesShowcase from './components/FeaturesShowcase'
import VideoSection from './components/VideoSection'
import HowItWorks from './components/HowItWorks'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import CTASection from './components/CTASection'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="bg-white text-gray-900 font-sans">
      <Navbar />
      <Hero />
      <FeaturesShowcase />
      <VideoSection />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTASection />
      <Footer />
    </div>
  )
}
