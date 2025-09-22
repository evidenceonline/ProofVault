import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import BlockchainDemo from '@/components/BlockchainDemo'
import CaseStudies from '@/components/CaseStudies'
import TestimonialsAwards from '@/components/TestimonialsAwards'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <BlockchainDemo />
        <Features />
        <CaseStudies />
        <TestimonialsAwards />
      </main>
      <Footer />
    </>
  )
}