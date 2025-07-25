// Content script for ProofVault Chrome Extension
// This script runs in the context of web pages to provide enhanced functionality

class ProofVaultContent {
  constructor() {
    this.isInitialized = false;
    this.captureOverlay = null;
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      // Listen for messages from background script
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open
      });
      
      // Add visual indicators when extension is active
      this.addPageIndicators();
      
      this.isInitialized = true;
      console.log('ProofVault content script initialized');
    } catch (error) {
      console.error('ProofVault content script initialization failed:', error);
    }
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'highlightPage':
        this.highlightPage();
        sendResponse({ success: true });
        break;
        
      case 'removeHighlight':
        this.removeHighlight();
        sendResponse({ success: true });
        break;
        
      case 'getPageInfo':
        sendResponse({
          success: true,
          data: this.getEnhancedPageInfo()
        });
        break;
        
      case 'showCaptureOverlay':
        this.showCaptureOverlay();
        sendResponse({ success: true });
        break;
        
      case 'hideCaptureOverlay':
        this.hideCaptureOverlay();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  // Add visual indicators that ProofVault is available
  addPageIndicators() {
    // Only add indicators if not already present
    if (document.querySelector('.proofvault-indicator')) return;
    
    // Create floating indicator
    const indicator = document.createElement('div');
    indicator.className = 'proofvault-indicator';
    indicator.innerHTML = `
      <div class="proofvault-indicator-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </div>
      <div class="proofvault-indicator-text">ProofVault Ready</div>
    `;
    
    // Add styles
    this.addIndicatorStyles();
    
    // Add to page
    document.body.appendChild(indicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      indicator.classList.add('fade-out');
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 500);
    }, 3000);
  }

  addIndicatorStyles() {
    if (document.getElementById('proofvault-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'proofvault-styles';
    styles.textContent = `
      .proofvault-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(102, 126, 234, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
        animation: slideInRight 0.3s ease;
      }
      
      .proofvault-indicator.fade-out {
        opacity: 0;
        transform: translateX(100%);
      }
      
      .proofvault-indicator-icon svg {
        width: 18px;
        height: 18px;
      }
      
      .proofvault-capture-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(102, 126, 234, 0.1);
        z-index: 9999;
        pointer-events: none;
        animation: pulseOverlay 2s infinite;
      }
      
      .proofvault-highlight {
        animation: highlightPulse 2s infinite;
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes pulseOverlay {
        0%, 100% { opacity: 0.1; }
        50% { opacity: 0.2; }
      }
      
      @keyframes highlightPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
        50% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.4); }
      }
    `;
    
    document.head.appendChild(styles);
  }

  // Get enhanced page information
  getEnhancedPageInfo() {
    const info = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      domain: window.location.hostname,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      documentReady: document.readyState,
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY
      }
    };
    
    // Add page-specific metadata
    const metaTags = {};
    document.querySelectorAll('meta').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metaTags[name] = content;
      }
    });
    info.metaTags = metaTags;
    
    // Add canonical URL if available
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      info.canonicalUrl = canonical.href;
    }
    
    // Add Open Graph data
    const ogData = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
      const property = meta.getAttribute('property').replace('og:', '');
      ogData[property] = meta.getAttribute('content');
    });
    if (Object.keys(ogData).length > 0) {
      info.openGraph = ogData;
    }
    
    // Add Twitter Card data
    const twitterData = {};
    document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
      const name = meta.getAttribute('name').replace('twitter:', '');
      twitterData[name] = meta.getAttribute('content');
    });
    if (Object.keys(twitterData).length > 0) {
      info.twitterCard = twitterData;
    }
    
    return info;
  }

  // Highlight the entire page to indicate capture
  highlightPage() {
    document.body.classList.add('proofvault-highlight');
  }

  // Remove page highlight
  removeHighlight() {
    document.body.classList.remove('proofvault-highlight');
  }

  // Show capture overlay
  showCaptureOverlay() {
    this.hideCaptureOverlay(); // Remove existing overlay
    
    this.captureOverlay = document.createElement('div');
    this.captureOverlay.className = 'proofvault-capture-overlay';
    document.body.appendChild(this.captureOverlay);
  }

  // Hide capture overlay
  hideCaptureOverlay() {
    if (this.captureOverlay && this.captureOverlay.parentNode) {
      this.captureOverlay.parentNode.removeChild(this.captureOverlay);
      this.captureOverlay = null;
    }
  }

  // Scroll to top of page for better capture
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Check if page is ready for capture
  isPageReadyForCapture() {
    return {
      ready: document.readyState === 'complete',
      imagesLoaded: this.areImagesLoaded(),
      scriptsLoaded: this.areScriptsLoaded(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  // Check if all images are loaded
  areImagesLoaded() {
    const images = document.querySelectorAll('img');
    for (let img of images) {
      if (!img.complete) {
        return false;
      }
    }
    return true;
  }

  // Check if all scripts are loaded
  areScriptsLoaded() {
    // This is a simplified check - in reality, we'd need more sophisticated detection
    return document.readyState === 'complete';
  }

  // Wait for page to be fully ready
  async waitForPageReady(timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        const status = this.isPageReadyForCapture();
        
        if (status.ready && status.imagesLoaded) {
          resolve(status);
        } else if (Date.now() - startTime > timeout) {
          resolve(status); // Timeout - proceed anyway
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  // Clean up when extension is disabled or page unloads
  cleanup() {
    this.removeHighlight();
    this.hideCaptureOverlay();
    
    const indicator = document.querySelector('.proofvault-indicator');
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    
    const styles = document.getElementById('proofvault-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }
  }
}

// Initialize content script
let proofVaultContent;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    proofVaultContent = new ProofVaultContent();
  });
} else {
  proofVaultContent = new ProofVaultContent();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (proofVaultContent) {
    proofVaultContent.cleanup();
  }
});

// Export for potential use by other scripts
window.proofVaultContent = proofVaultContent;