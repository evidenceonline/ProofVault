import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ProofVault - Secure Evidence Management Platform',
  description: 'Capture, verify, and store evidence with blockchain-backed authenticity. Trusted by professionals worldwide.',
  keywords: ['evidence management', 'document management', 'blockchain verification', 'professional investigations', 'evidence capture', 'compliance auditing', 'corporate investigations'],
  authors: [{ name: 'ProofVault Team' }],
  openGraph: {
    title: 'ProofVault - Secure Evidence Management Platform',
    description: 'Capture, verify, and store evidence with blockchain-backed authenticity.',
    url: 'https://proofvault.net',
    siteName: 'ProofVault',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ProofVault - Secure Evidence Management Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProofVault - Secure Evidence Management Platform',
    description: 'Capture, verify, and store evidence with blockchain-backed authenticity.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased bg-subtle-noise text-gray-900`}>
        {children}
      </body>
    </html>
  )
}