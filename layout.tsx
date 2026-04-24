import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })
const shrikhand = localFont({
  src: '../public/fonts/Shrikhand-Regular.ttf',
  variable: '--font-shrikhand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'kairos — the right guidance, at the right time.',
  description:
    'Kairos connects high school students with current undergraduates at top universities. Get personalized help with essays, test prep, and activities—from those who know what it takes.',
  metadataBase: new URL('https://kairos.app'),
  openGraph: {
    title: 'kairos — the right guidance, at the right time.',
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
    <html lang="en" className={`${montserrat.variable} ${shrikhand.variable}`}>
      <body className="font-sans antialiased bg-surface text-ink">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
