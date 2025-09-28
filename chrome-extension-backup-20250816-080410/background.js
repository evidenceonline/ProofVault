/**
 * ProofVault Background Service Worker
 * Optimized for Manifest V3 and performance
 */

// Service worker lifecycle management
let isInitialized = false;
let healthCheckInterval = null;
let performanceMetrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  lastActivity: Date.now()
};

/**
 * Service worker installation and setup
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log('ProofVault extension installed/updated:', details.reason);
    
    // Initialize extension
    await initializeExtension(details);
    
    // Log installation metrics
    logInstallationEvent(details);
    
  } catch (error) {
    console.error('Extension installation failed:', error);
    reportError('installation_failed', error);
  }
});

/**
 * Service worker startup
 */
chrome.runtime.onStartup.addListener(async () => {
  try {
    console.log('ProofVault service worker starting...');
    await initializeExtension({ reason: 'startup' });
  } catch (error) {
    console.error('Service worker startup failed:', error);
    reportError('startup_failed', error);
  }
});

/**
 * Initialize extension functionality
 */
async function initializeExtension(details) {
  if (isInitialized && details.reason !== 'install') {
    return;
  }
  
  try {
    // Set up default storage values
    await setupDefaultStorage();
    
    // Initialize performance monitoring
    initializePerformanceMonitoring();
    
    // Set up context menus if needed
    await setupContextMenus();
    
    // Start health monitoring
    startHealthMonitoring();
    
    isInitialized = true;
    console.log('ProofVault extension initialized successfully');
    
  } catch (error) {
    console.error('Extension initialization failed:', error);
    throw error;
  }
}

/**
 * Set up default storage values
 */
async function setupDefaultStorage() {
  try {
    const defaultSettings = {
      captureQuality: 95,
      pdfFormat: 'a4',
      pdfOrientation: 'portrait',
      compressionEnabled: true,
      debugMode: false,
      lastHealthCheck: null,
      installDate: new Date().toISOString()
    };
    
    // Only set defaults if not already set
    const existing = await chrome.storage.local.get(Object.keys(defaultSettings));
    const toSet = {};
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!(key in existing)) {
        toSet[key] = value;
      }
    }
    
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
      console.log('Default settings initialized:', Object.keys(toSet));
    }
    
  } catch (error) {
    console.error('Failed to setup default storage:', error);
    throw error;
  }
}

/**
 * Initialize performance monitoring
 */
function initializePerformanceMonitoring() {
  performanceMetrics = {
    startTime: Date.now(),
    requestCount: 0,
    errorCount: 0,
    lastActivity: Date.now(),
    memoryUsage: performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize
    } : null
  };
}

/**
 * Set up context menus for quick access
 */
async function setupContextMenus() {
  try {
    // Remove existing menus
    chrome.contextMenus.removeAll();
    
    // Add ProofVault context menu
    chrome.contextMenus.create({
      id: 'capture-evidence',
      title: 'Capture Evidence with ProofVault',
      contexts: ['page', 'selection', 'image'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
    
    console.log('Context menus created');
    
  } catch (error) {
    console.warn('Context menu setup failed:', error);
    // Non-critical error, continue
  }
}

/**
 * Start health monitoring
 */
function startHealthMonitoring() {
  // Clear existing interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Check health every 5 minutes
  healthCheckInterval = setInterval(async () => {
    try {
      await performHealthCheck();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }, 5 * 60 * 1000);
  
  // Initial health check
  setTimeout(performHealthCheck, 5000);
}

/**
 * Perform health check
 */
async function performHealthCheck() {
  try {
    performanceMetrics.lastActivity = Date.now();
    
    // Check storage quota
    const quota = await navigator.storage.estimate();
    const storageUsage = {
      quota: quota.quota,
      usage: quota.usage,
      percentage: quota.usage / quota.quota * 100
    };
    
    // Log memory usage if available
    if (performance.memory) {
      const memoryDelta = {
        used: performance.memory.usedJSHeapSize - (performanceMetrics.memoryUsage?.usedJSHeapSize || 0),
        total: performance.memory.totalJSHeapSize - (performanceMetrics.memoryUsage?.totalJSHeapSize || 0)
      };
      
      performanceMetrics.memoryUsage = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        delta: memoryDelta
      };
    }
    
    // Update last health check time
    await chrome.storage.local.set({
      lastHealthCheck: new Date().toISOString(),
      storageUsage,
      performanceMetrics
    });
    
    console.log('Health check completed:', {
      uptime: Date.now() - performanceMetrics.startTime,
      storage: storageUsage,
      requests: performanceMetrics.requestCount,
      errors: performanceMetrics.errorCount
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    performanceMetrics.errorCount++;
  }
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'capture-evidence') {
      // Open popup for evidence capture
      await chrome.action.openPopup();
      
      // Track usage
      performanceMetrics.requestCount++;
      await trackUsage('context_menu_capture', { tabUrl: tab.url });
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
    reportError('context_menu_failed', error);
  }
});

/**
 * Handle extension icon clicks
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.action.openPopup();
    
    // Track usage
    performanceMetrics.requestCount++;
    await trackUsage('icon_click', { tabUrl: tab.url });
    
  } catch (error) {
    console.error('Action click failed:', error);
    reportError('action_click_failed', error);
  }
});

/**
 * Handle runtime messages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    performanceMetrics.lastActivity = Date.now();
    
    switch (message.type) {
      case 'health-check':
        performHealthCheck().then(() => sendResponse({ success: true }));
        return true; // Keep message channel open for async response
        
      case 'get-metrics':
        sendResponse({
          success: true,
          data: performanceMetrics
        });
        break;
        
      case 'clear-cache':
        clearExtensionCache().then(() => sendResponse({ success: true }));
        return true;
        
      case 'report-error':
        reportError(message.errorType, message.error);
        sendResponse({ success: true });
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
  } catch (error) {
    console.error('Message handling failed:', error);
    sendResponse({ success: false, error: error.message });
  }
});

/**
 * Track usage analytics
 */
async function trackUsage(action, data = {}) {
  try {
    const usage = await chrome.storage.local.get(['usageStats']) || {};
    const stats = usage.usageStats || {};
    
    if (!stats[action]) {
      stats[action] = { count: 0, lastUsed: null };
    }
    
    stats[action].count++;
    stats[action].lastUsed = new Date().toISOString();
    stats[action].data = data;
    
    await chrome.storage.local.set({ usageStats: stats });
    
  } catch (error) {
    console.error('Usage tracking failed:', error);
  }
}

/**
 * Report errors for monitoring
 */
async function reportError(errorType, error) {
  try {
    performanceMetrics.errorCount++;
    
    const errorReport = {
      type: errorType,
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version
    };
    
    // Store error in local storage for later analysis
    const errors = await chrome.storage.local.get(['errorLog']) || {};
    const errorLog = errors.errorLog || [];
    
    errorLog.push(errorReport);
    
    // Keep only last 50 errors
    if (errorLog.length > 50) {
      errorLog.splice(0, errorLog.length - 50);
    }
    
    await chrome.storage.local.set({ errorLog });
    
    console.error('Error reported:', errorReport);
    
  } catch (reportingError) {
    console.error('Error reporting failed:', reportingError);
  }
}

/**
 * Clear extension cache and temporary data
 */
async function clearExtensionCache() {
  try {
    // Clear temporary data but keep user preferences
    const toKeep = ['company', 'user', 'captureQuality', 'pdfFormat', 'pdfOrientation'];
    const current = await chrome.storage.local.get();
    const toRemove = Object.keys(current).filter(key => !toKeep.includes(key));
    
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
      console.log('Cache cleared:', toRemove.length, 'items removed');
    }
    
  } catch (error) {
    console.error('Cache clearing failed:', error);
    throw error;
  }
}

/**
 * Log installation events
 */
function logInstallationEvent(details) {
  try {
    const eventData = {
      reason: details.reason,
      timestamp: new Date().toISOString(),
      extensionVersion: chrome.runtime.getManifest().version,
      previousVersion: details.previousVersion
    };
    
    console.log('Installation event:', eventData);
    
    // Track installation
    trackUsage('installation', eventData);
    
  } catch (error) {
    console.error('Installation logging failed:', error);
  }
}

/**
 * Handle extension unload for cleanup
 */
self.addEventListener('beforeunload', () => {
  try {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
    
    console.log('ProofVault service worker unloading');
    
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
});

// Initialize immediately if service worker is already running
if (self.registration) {
  initializeExtension({ reason: 'startup' }).catch(console.error);
}