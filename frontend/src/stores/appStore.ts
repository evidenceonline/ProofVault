import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { NetworkInfo } from '@/types';

interface User {
  address: string;
  displayName?: string;
  apiKey?: string;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Network state
  networkInfo: NetworkInfo | null;
  isOnline: boolean;
  
  // UI state
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  
  // Settings
  autoRefresh: boolean;
  refreshInterval: number;
  maxFileSize: number;
  
  // Recent activity (for quick access)
  recentHashes: string[];
  recentUploads: Array<{
    filename: string;
    hash: string;
    timestamp: string;
    status: string;
  }>;
}

interface AppActions {
  // User actions
  setUser: (user: User | null) => void;
  login: (address: string, apiKey?: string, displayName?: string) => void;
  logout: () => void;
  
  // Network actions
  setNetworkInfo: (info: NetworkInfo) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  
  // UI actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Settings actions
  updateSettings: (settings: Partial<Pick<AppState, 'autoRefresh' | 'refreshInterval' | 'maxFileSize'>>) => void;
  
  // Activity actions
  addRecentHash: (hash: string) => void;
  addRecentUpload: (upload: AppState['recentUploads'][0]) => void;
  clearRecentActivity: () => void;
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  networkInfo: null,
  isOnline: true,
  theme: 'system',
  sidebarOpen: true,
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
  maxFileSize: 10 * 1024 * 1024, // 10MB
  recentHashes: [],
  recentUploads: [],
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // User actions
      setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
      
      login: (address, apiKey, displayName) => {
        const user = { address, apiKey, displayName };
        
        // Store API key and address in localStorage for API client
        if (apiKey) {
          localStorage.setItem('proofvault_api_key', apiKey);
        }
        localStorage.setItem('proofvault_user_address', address);
        
        set({ user, isAuthenticated: true });
      },
      
      logout: () => {
        // Clear localStorage
        localStorage.removeItem('proofvault_api_key');
        localStorage.removeItem('proofvault_user_address');
        
        set({ 
          user: null, 
          isAuthenticated: false,
          recentHashes: [],
          recentUploads: [],
        });
      },

      // Network actions
      setNetworkInfo: (networkInfo) => set({ networkInfo }),
      setOnlineStatus: (isOnline) => set({ isOnline }),

      // UI actions
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      // Settings actions
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),

      // Activity actions
      addRecentHash: (hash) => set((state) => ({
        recentHashes: [hash, ...state.recentHashes.filter(h => h !== hash)].slice(0, 10)
      })),
      
      addRecentUpload: (upload) => set((state) => ({
        recentUploads: [upload, ...state.recentUploads].slice(0, 5)
      })),
      
      clearRecentActivity: () => set({ recentHashes: [], recentUploads: [] }),
    }),
    {
      name: 'proofvault-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        maxFileSize: state.maxFileSize,
        recentHashes: state.recentHashes,
        recentUploads: state.recentUploads,
      }),
    }
  )
);

// Selectors for common patterns
export const useUser = () => useAppStore((state) => state.user);
export const useAuth = () => useAppStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  login: state.login,
  logout: state.logout,
}));

export const useNetworkStatus = () => useAppStore((state) => ({
  networkInfo: state.networkInfo,
  isOnline: state.isOnline,
  setNetworkInfo: state.setNetworkInfo,
  setOnlineStatus: state.setOnlineStatus,
}));

export const useUIState = () => useAppStore((state) => ({
  theme: state.theme,
  sidebarOpen: state.sidebarOpen,
  setTheme: state.setTheme,
  toggleSidebar: state.toggleSidebar,
  setSidebarOpen: state.setSidebarOpen,
}));

export const useSettings = () => useAppStore((state) => ({
  autoRefresh: state.autoRefresh,
  refreshInterval: state.refreshInterval,
  maxFileSize: state.maxFileSize,
  updateSettings: state.updateSettings,
}));

export const useRecentActivity = () => useAppStore((state) => ({
  recentHashes: state.recentHashes,
  recentUploads: state.recentUploads,
  addRecentHash: state.addRecentHash,
  addRecentUpload: state.addRecentUpload,
  clearRecentActivity: state.clearRecentActivity,
}));