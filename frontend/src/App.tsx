import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { VerificationPage } from '@/pages/VerificationPage';
import { DocumentBrowserPage } from '@/pages/DocumentBrowserPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { useAppStore, useNetworkStatus } from '@/stores/appStore';
import { apiClient } from '@/services/apiClient';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 404s
        if (error?.response?.status === 404) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  const { setNetworkInfo, setOnlineStatus } = useNetworkStatus();
  const autoRefresh = useAppStore(state => state.autoRefresh);
  const refreshInterval = useAppStore(state => state.refreshInterval);

  // Initialize network status and health check
  useEffect(() => {
    const checkNetworkHealth = async () => {
      try {
        const [isHealthy, networkInfo] = await Promise.all([
          apiClient.checkHealth(),
          apiClient.getNetworkInfo().catch(() => null),
        ]);

        setOnlineStatus(isHealthy);
        
        if (networkInfo) {
          setNetworkInfo(networkInfo);
        }
      } catch (error) {
        console.error('Failed to check network health:', error);
        setOnlineStatus(false);
      }
    };

    // Initial check
    checkNetworkHealth();

    // Set up periodic health checks if auto-refresh is enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(checkNetworkHealth, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [setNetworkInfo, setOnlineStatus, autoRefresh, refreshInterval]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/verify" replace />} />
              <Route path="/verify" element={<VerificationPage />} />
              <Route path="/documents" element={<DocumentBrowserPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="*" element={<Navigate to="/verify" replace />} />
            </Routes>
          </Layout>
          
          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </Router>
      
      {/* React Query DevTools */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;