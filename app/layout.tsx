import type { Metadata } from 'next'
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['italic'], weight: ['700', '900'] })

export const metadata: Metadata = {
  title: 'Kairos | Learn from Students Who Just Did It',
  description:
    'Kairos connects high school students with current undergraduates at top universities. Get personalized help with essays, test prep, and activities—from those who know what it takes.',
  metadataBase: new URL('https://kairos.app'),
  openGraph: {
    title: 'Kairos | Learn from Students Who Just Did It',
    description:
      'Kairos connects high school students with current undergraduates at top universities.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${playfair.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
