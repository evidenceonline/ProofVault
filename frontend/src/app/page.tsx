'use client';

import dynamic from 'next/dynamic';

// Dynamically import the HomePage component with SSR disabled
const HomePageComponent = dynamic(() => import('../components/HomePage'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        border: '3px solid #e5e7eb', 
        borderTop: '3px solid #3b82f6', 
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <p>Loading ProofVault...</p>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});

export default function Page() {
  return <HomePageComponent />;
}