import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ProofVault - Legal Evidence Management System',
  description: 'Secure blockchain-verified evidence management platform for legal professionals. Search, view, and download PDF evidence records with cryptographic verification.',
  keywords: 'legal evidence, document management, blockchain verification, compliance, forensic evidence, legal technology',
  authors: [{ name: 'ProofVault', url: 'https://proofvault.com' }],
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e40af',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="h-full antialiased bg-gray-50">
        <div id="root" className="min-h-full">
          {children}
        </div>
        <div id="modal-root"></div>
      </body>
    </html>
  );
}