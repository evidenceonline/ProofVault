/**
 * ProofVault Browser Compatibility Layer
 * Ensures extension works across Chrome, Edge, and Firefox WebExtensions
 */

class BrowserCompatibility {
  constructor() {
    this.browserInfo = this.detectBrowser();
    this.initialized = false;
    this.polyfills = new Map();
    
    this.supportedBrowsers = {
      chrome: { minVersion: 102, apis: ['tabs', 'storage', 'scripting', 'contextMenus'] },
      edge: { minVersion: 102, apis: ['tabs', 'storage', 'scripting', 'contextMenus'] },
      firefox: { minVersion: 109, apis: ['tabs', 'storage', 'scripting'] } // contextMenus has different API
    };
  }

  /**
   * Detect current browser and version
   */
  detectBrowser() {
    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    let version = 0;
    
    // Detect Chrome
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? parseInt(match[1]) : 0;
    }
    // Detect Edge (Chromium)
    else if (userAgent.includes('Edg')) {
      browser = 'edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      version = match ? parseInt(match[1]) : 0;
    }
    // Detect Firefox
    else if (userAgent.includes('Firefox')) {
      browser = 'firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? parseInt(match[1]) : 0;
    }
    
    return { browser, version, userAgent };
  }

  /**
   * Initialize browser compatibility layer
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('[Compatibility] Browser detected:', this.browserInfo);
      
      // Check browser support
      this.checkBrowserSupport();
      
      // Set up polyfills
      this.setupPolyfills();
      
      // Initialize browser-specific features
      await this.initializeBrowserFeatures();
      
      this.initialized = true;
      console.log('[Compatibility] Browser compatibility layer initialized');
      
    } catch (error) {
      console.error('[Compatibility] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if current browser is supported
   */
  checkBrowserSupport() {
    const { browser, version } = this.browserInfo;
    const support = this.supportedBrowsers[browser];
    
    if (!support) {
      throw new Error(`Browser ${browser} is not supported`);
    }
    
    if (version < support.minVersion) {
      throw new Error(`Browser version ${version} is too old. Minimum required: ${support.minVersion}`);
    }
    
    // Check API availability
    const missingApis = support.apis.filter(api => !this.isApiAvailable(api));
    if (missingApis.length > 0) {
      console.warn('[Compatibility] Missing APIs:', missingApis);
    }
    
    console.log('[Compatibility] Browser support check passed');
  }

  /**
   * Check if specific API is available
   */
  isApiAvailable(apiName) {
    if (!chrome) return false;
    
    switch (apiName) {
      case 'tabs':
        return !!(chrome.tabs && chrome.tabs.query);
      case 'storage':
        return !!(chrome.storage && chrome.storage.local);
      case 'scripting':
        return !!(chrome.scripting);
      case 'contextMenus':
        return !!(chrome.contextMenus);
      case 'runtime':
        return !!(chrome.runtime);
      default:
        return false;
    }
  }

  /**
   * Set up polyfills for missing features
   */
  setupPolyfills() {
    // Firefox namespace polyfill
    if (this.browserInfo.browser === 'firefox' && typeof browser !== 'undefined') {
      this.setupFirefoxPolyfills();
    }
    
    // Performance API polyfill
    if (!window.performance || !window.performance.now) {
      this.setupPerformancePolyfill();
    }
    
    // URL API polyfill for older browsers
    if (!window.URL || !window.URL.createObjectURL) {
      this.setupUrlPolyfill();
    }
    
    // Promise polyfill for very old browsers
    if (!window.Promise) {
      console.warn('[Compatibility] Promise not available - extension may not work properly');
    }
    
    // Fetch API polyfill
    if (!window.fetch) {
      this.setupFetchPolyfill();
    }
  }

  /**
   * Set up Firefox-specific polyfills
   */
  setupFirefoxPolyfills() {
    if (typeof browser !== 'undefined' && !window.chrome) {
      // Map Firefox browser API to chrome namespace
      window.chrome = browser;
      
      // Fix Promise-based APIs to callback-based for compatibility
      if (browser.tabs && browser.tabs.query) {
        const originalQuery = browser.tabs.query;
        browser.tabs.query = function(queryInfo, callback) {
          if (callback) {
            originalQuery(queryInfo).then(callback).catch(console.error);
          } else {
            return originalQuery(queryInfo);
          }
        };
      }
      
      if (browser.storage && browser.storage.local) {
        const originalGet = browser.storage.local.get;
        const originalSet = browser.storage.local.set;
        
        browser.storage.local.get = function(keys, callback) {
          if (callback) {
            originalGet(keys).then(callback).catch(console.error);
          } else {
            return originalGet(keys);
          }
        };
        
        browser.storage.local.set = function(items, callback) {
          if (callback) {
            originalSet(items).then(callback).catch(console.error);
          } else {
            return originalSet(items);
          }
        };
      }
      
      console.log('[Compatibility] Firefox polyfills applied');
    }
  }

  /**
   * Set up performance API polyfill
   */
  setupPerformancePolyfill() {
    if (!window.performance) {
      window.performance = {};
    }
    
    if (!window.performance.now) {
      window.performance.now = function() {
        return Date.now();
      };
    }
    
    if (!window.performance.timing) {
      window.performance.timing = {
        navigationStart: Date.now()
      };
    }
    
    console.log('[Compatibility] Performance API polyfill applied');
  }

  /**
   * Set up URL API polyfill
   */
  setupUrlPolyfill() {
    if (!window.URL) {
      // Basic URL polyfill
      window.URL = function(url, base) {
        const a = document.createElement('a');
        a.href = base ? new window.URL(base).href.replace(/\/[^\/]*$/, '/') + url : url;
        
        return {
          href: a.href,
          protocol: a.protocol,
          hostname: a.hostname,
          pathname: a.pathname,
          search: a.search,
          hash: a.hash,
          toString: function() { return a.href; }
        };
      };
      
      window.URL.createObjectURL = function(blob) {
        // Fallback for older browsers
        if (window.webkitURL) {
          return window.webkitURL.createObjectURL(blob);
        }
        throw new Error('URL.createObjectURL not supported');
      };
      
      window.URL.revokeObjectURL = function(url) {
        if (window.webkitURL) {
          window.webkitURL.revokeObjectURL(url);
        }
      };
      
      console.log('[Compatibility] URL API polyfill applied');
    }
  }

  /**
   * Set up fetch API polyfill
   */
  setupFetchPolyfill() {
    // Basic fetch polyfill using XMLHttpRequest
    window.fetch = function(url, options = {}) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const method = options.method || 'GET';
        
        xhr.open(method, url);
        
        // Set headers
        if (options.headers) {
          for (const [key, value] of Object.entries(options.headers)) {
            xhr.setRequestHeader(key, value);
          }
        }
        
        xhr.onload = function() {
          const response = {
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: {
              get: function(name) {
                return xhr.getResponseHeader(name);
              }
            },
            json: function() {
              return Promise.resolve(JSON.parse(xhr.responseText));
            },
            blob: function() {
              return Promise.resolve(new Blob([xhr.response]));
            },
            text: function() {
              return Promise.resolve(xhr.responseText);
            }
          };
          
          resolve(response);
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error'));
        };
        
        xhr.send(options.body);
      });
    };
    
    console.log('[Compatibility] Fetch API polyfill applied');
  }

  /**
   * Initialize browser-specific features
   */
  async initializeBrowserFeatures() {
    const { browser } = this.browserInfo;
    
    switch (browser) {
      case 'chrome':
        await this.initializeChromeFeatures();
        break;
      case 'edge':
        await this.initializeEdgeFeatures();
        break;
      case 'firefox':
        await this.initializeFirefoxFeatures();
        break;
    }
  }

  /**
   * Initialize Chrome-specific features
   */
  async initializeChromeFeatures() {
    // Chrome-specific optimizations
    if (chrome.offscreen) {
      console.log('[Compatibility] Chrome Offscreen API available');
    }
    
    if (chrome.sidePanel) {
      console.log('[Compatibility] Chrome Side Panel API available');
    }
  }

  /**
   * Initialize Edge-specific features
   */
  async initializeEdgeFeatures() {
    // Edge inherits most Chrome features
    console.log('[Compatibility] Edge (Chromium) features initialized');
  }

  /**
   * Initialize Firefox-specific features
   */
  async initializeFirefoxFeatures() {
    // Firefox-specific adaptations
    
    // Context menus work differently in Firefox
    if (!this.isApiAvailable('contextMenus') && browser.menus) {
      // Map Firefox menus API to contextMenus
      chrome.contextMenus = {
        create: browser.menus.create.bind(browser.menus),
        removeAll: browser.menus.removeAll.bind(browser.menus),
        onClicked: browser.menus.onClicked
      };
      console.log('[Compatibility] Firefox menus API mapped to contextMenus');
    }
    
    // Handle Firefox-specific screenshot limitations
    if (browser.tabs && browser.tabs.captureVisibleTab) {
      const originalCapture = browser.tabs.captureVisibleTab;
      browser.tabs.captureVisibleTab = function(windowId, options, callback) {
        // Firefox doesn't support windowId parameter the same way
        const args = typeof windowId === 'object' ? [windowId, options] : [options];
        return originalCapture.apply(this, args).then(callback).catch(console.error);
      };
    }
  }

  /**
   * Get browser-specific screenshot options
   */
  getScreenshotOptions() {
    const { browser } = this.browserInfo;
    
    const baseOptions = {
      format: 'png'
    };
    
    switch (browser) {
      case 'chrome':
      case 'edge':
        return {
          ...baseOptions,
          quality: 95 // Chrome/Edge support quality parameter
        };
      case 'firefox':
        return baseOptions; // Firefox doesn't support quality parameter
      default:
        return baseOptions;
    }
  }

  /**
   * Get browser-specific PDF options
   */
  getPdfOptions() {
    const { browser } = this.browserInfo;
    
    const baseOptions = {
      format: 'a4',
      orientation: 'portrait'
    };
    
    switch (browser) {
      case 'chrome':
      case 'edge':
        return {
          ...baseOptions,
          compress: true,
          precision: 16
        };
      case 'firefox':
        return {
          ...baseOptions,
          compress: false, // Firefox may have issues with compression
          precision: 8
        };
      default:
        return baseOptions;
    }
  }

  /**
   * Check for specific feature support
   */
  supportsFeature(feature) {
    const { browser, version } = this.browserInfo;
    
    const featureSupport = {
      'service-workers': {
        chrome: 40,
        edge: 17,
        firefox: 44
      },
      'offscreen-api': {
        chrome: 109,
        edge: 109,
        firefox: false
      },
      'declarative-net-request': {
        chrome: 84,
        edge: 84,
        firefox: false
      },
      'side-panel': {
        chrome: 114,
        edge: 114,
        firefox: false
      }
    };
    
    const support = featureSupport[feature];
    if (!support) return false;
    
    const minVersion = support[browser];
    if (minVersion === false) return false;
    if (typeof minVersion === 'number') return version >= minVersion;
    
    return false;
  }

  /**
   * Get compatibility report
   */
  getCompatibilityReport() {
    const { browser, version } = this.browserInfo;
    
    return {
      browser,
      version,
      supported: this.isSupported(),
      features: {
        serviceWorkers: this.supportsFeature('service-workers'),
        offscreenApi: this.supportsFeature('offscreen-api'),
        declarativeNetRequest: this.supportsFeature('declarative-net-request'),
        sidePanel: this.supportsFeature('side-panel')
      },
      apis: {
        tabs: this.isApiAvailable('tabs'),
        storage: this.isApiAvailable('storage'),
        scripting: this.isApiAvailable('scripting'),
        contextMenus: this.isApiAvailable('contextMenus'),
        runtime: this.isApiAvailable('runtime')
      },
      polyfills: Array.from(this.polyfills.keys())
    };
  }

  /**
   * Check if current browser is fully supported
   */
  isSupported() {
    const { browser, version } = this.browserInfo;
    const support = this.supportedBrowsers[browser];
    
    return support && version >= support.minVersion;
  }
}

// Initialize browser compatibility
const browserCompatibility = new BrowserCompatibility();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    browserCompatibility.initialize().catch(console.error);
  });
} else {
  browserCompatibility.initialize().catch(console.error);
}

// Export for use in other modules
window.BrowserCompatibility = BrowserCompatibility;
window.browserCompatibility = browserCompatibility;