import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  FileText, 
  BarChart3, 
  Menu, 
  X, 
  Settings, 
  User,
  LogOut,
  Wifi,
  WifiOff,
  Globe
} from 'lucide-react';
import { useAuth, useNetworkStatus, useUIState } from '@/stores/appStore';
import { cn } from '@/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { networkInfo, isOnline } = useNetworkStatus();
  const { sidebarOpen, setSidebarOpen } = useUIState();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigation = [
    {
      name: 'Verification',
      href: '/verify',
      icon: Shield,
      description: 'Verify PDF documents',
    },
    {
      name: 'Documents',
      href: '/documents',
      icon: FileText,
      description: 'Browse document registry',
    },
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      description: 'Analytics and insights',
    },
  ];

  const isActivePath = (path: string) => {
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : -280,
          transition: { type: 'spring', stiffness: 300, damping: 30 }
        }}
        className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 lg:static lg:translate-x-0"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">ProofVault</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = isActivePath(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon 
                    className={cn(
                      'w-5 h-5 mr-3',
                      isActive ? 'text-primary-600' : 'text-gray-500'
                    )} 
                  />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Network Status */}
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900">
                  {isOnline ? 'Connected' : 'Offline'}
                </div>
                {networkInfo && (
                  <div className="text-xs text-gray-500 truncate">
                    {networkInfo.networkName}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Menu */}
          {isAuthenticated && user && (
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <User className="w-5 h-5 mr-3 text-gray-500" />
                  <div className="flex-1 text-left">
                    <div>{user.displayName || 'User'}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {user.address.substring(0, 8)}...
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2"
                    >
                      <button
                        onClick={() => {
                          // Handle settings
                          setShowUserMenu(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <nav className="hidden sm:block">
              <ol className="flex items-center space-x-2 text-sm">
                <li>
                  <Link to="/" className="text-gray-500 hover:text-gray-700">
                    Home
                  </Link>
                </li>
                <li className="text-gray-400">/</li>
                <li className="text-gray-900 font-medium">
                  {navigation.find(item => isActivePath(item.href))?.name || 'Dashboard'}
                </li>
              </ol>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Network indicator */}
            {networkInfo && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">{networkInfo.networkName}</span>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  networkInfo.status === 'healthy' ? 'bg-green-500' :
                  networkInfo.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                )} />
              </div>
            )}

            {/* Sign in button for unauthenticated users */}
            {!isAuthenticated && (
              <button
                onClick={() => {
                  // Handle authentication - this would typically open a wallet connection dialog
                  console.log('Authentication not implemented yet');
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}