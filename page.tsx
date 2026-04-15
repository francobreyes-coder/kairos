import { Header } from '@/components/landing/header'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { ProductPreview } from '@/components/landing/product-preview'
import { WhyKairos } from '@/components/landing/why-kairos'
import { CTA } from '@/components/landing/cta'
import { Footer } from '@/components/landing/footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <HowItWorks />
      <ProductPreview />
      <WhyKairos />
      <CTA />
      <Footer />
    </main>
  )
}
