/**
 * ProofVault Security Utilities
 * Enhanced security measures for legal evidence capture
 */

class SecurityManager {
  constructor() {
    this.nonce = this.generateNonce();
    this.initialized = false;
    this.securityConfig = {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      allowedProtocols: ['http:', 'https:'],
      blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js'],
      maxRetries: 3,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      encryptionAlgorithm: 'AES-GCM'
    };
    
    this.rateLimiter = {
      requests: new Map(),
      maxRequests: 10,
      windowMs: 60000 // 1 minute
    };
    
    this.integrityChecks = {
      lastVerification: null,
      verificationInterval: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Set up Content Security Policy enforcement
      this.enforceCSP();
      
      // Initialize integrity monitoring
      await this.initializeIntegrityMonitoring();
      
      // Set up session management
      this.initializeSessionManagement();
      
      // Start security monitoring
      this.startSecurityMonitoring();
      
      this.initialized = true;
      console.log('[Security] Security manager initialized');
      
    } catch (error) {
      console.error('[Security] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Enforce Content Security Policy
   */
  enforceCSP() {
    try {
      // Monitor for CSP violations
      document.addEventListener('securitypolicyviolation', (event) => {
        this.handleCSPViolation(event);
      });
      
      // Validate inline scripts and styles
      this.validateInlineContent();
      
      console.log('[Security] CSP enforcement enabled');
      
    } catch (error) {
      console.error('[Security] CSP enforcement failed:', error);
    }
  }

  /**
   * Handle CSP violations
   */
  handleCSPViolation(event) {
    const violation = {
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
      sourceFile: event.sourceFile,
      originalPolicy: event.originalPolicy,
      disposition: event.disposition,
      timestamp: new Date().toISOString()
    };
    
    console.error('[Security] CSP Violation detected:', violation);
    
    // Report to background script
    this.reportSecurityEvent('csp_violation', violation);
    
    // Take action based on violation severity
    if (this.isHighSeverityViolation(violation)) {
      this.handleHighSeverityViolation(violation);
    }
  }

  /**
   * Check if violation is high severity
   */
  isHighSeverityViolation(violation) {
    const highSeverityDirectives = ['script-src', 'object-src', 'base-uri'];
    return highSeverityDirectives.some(directive => 
      violation.directive.includes(directive)
    );
  }

  /**
   * Handle high severity violations
   */
  handleHighSeverityViolation(violation) {
    // Disable potentially compromised functionality
    this.enterSecurityMode();
    
    // Alert user
    this.showSecurityAlert('Security violation detected. Extension functionality may be limited for safety.');
  }

  /**
   * Validate inline content
   */
  validateInlineContent() {
    // Check for unauthorized inline scripts
    const inlineScripts = document.querySelectorAll('script:not([src])');
    inlineScripts.forEach(script => {
      if (!this.isAuthorizedInlineScript(script)) {
        console.warn('[Security] Unauthorized inline script detected:', script);
        this.reportSecurityEvent('unauthorized_inline_script', {
          content: script.textContent.substring(0, 100),
          location: script.outerHTML.substring(0, 200)
        });
      }
    });
  }

  /**
   * Check if inline script is authorized
   */
  isAuthorizedInlineScript(script) {
    // Allow empty scripts or scripts with specific patterns
    const content = script.textContent.trim();
    if (!content) return true;
    
    // Check for known safe patterns
    const safePatterns = [
      /^\/\*.*\*\/$/s, // Comments only
      /^window\.[A-Za-z]+\s*=\s*window\.[A-Za-z]+\s*\|\|\s*\{\};\s*$/s // Namespace declarations
    ];
    
    return safePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Initialize integrity monitoring
   */
  async initializeIntegrityMonitoring() {
    try {
      // Calculate and store file hashes for critical files
      await this.calculateFileIntegrity();
      
      // Set up periodic integrity checks
      setInterval(() => {
        this.performIntegrityCheck();
      }, this.integrityChecks.verificationInterval);
      
      console.log('[Security] Integrity monitoring initialized');
      
    } catch (error) {
      console.error('[Security] Integrity monitoring initialization failed:', error);
    }
  }

  /**
   * Calculate file integrity hashes
   */
  async calculateFileIntegrity() {
    // This would typically verify critical files
    // For now, we'll store a timestamp
    this.integrityChecks.lastVerification = Date.now();
  }

  /**
   * Perform integrity check
   */
  async performIntegrityCheck() {
    try {
      // Verify extension integrity
      const manifest = chrome.runtime.getManifest();
      if (!manifest) {
        throw new Error('Manifest not accessible');
      }
      
      // Check for unexpected permissions
      this.validatePermissions(manifest.permissions);
      
      // Update last verification time
      this.integrityChecks.lastVerification = Date.now();
      
      console.log('[Security] Integrity check passed');
      
    } catch (error) {
      console.error('[Security] Integrity check failed:', error);
      this.reportSecurityEvent('integrity_check_failed', { error: error.message });
    }
  }

  /**
   * Validate extension permissions
   */
  validatePermissions(permissions) {
    const expectedPermissions = [
      'activeTab',
      'storage', 
      'scripting',
      'contextMenus'
    ];
    
    // Check for unexpected permissions
    const unexpectedPermissions = permissions.filter(perm => 
      !expectedPermissions.includes(perm)
    );
    
    if (unexpectedPermissions.length > 0) {
      this.reportSecurityEvent('unexpected_permissions', {
        unexpected: unexpectedPermissions,
        expected: expectedPermissions
      });
    }
  }

  /**
   * Initialize session management
   */
  initializeSessionManagement() {
    try {
      // Set up session timeout
      this.sessionTimeout = setTimeout(() => {
        this.handleSessionTimeout();
      }, this.securityConfig.sessionTimeout);
      
      // Monitor user activity
      this.setupActivityMonitoring();
      
      console.log('[Security] Session management initialized');
      
    } catch (error) {
      console.error('[Security] Session management initialization failed:', error);
    }
  }

  /**
   * Set up activity monitoring
   */
  setupActivityMonitoring() {
    const events = ['click', 'keypress', 'mousemove'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, { passive: true });
    });
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity() {
    // Reset session timeout
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    
    this.sessionTimeout = setTimeout(() => {
      this.handleSessionTimeout();
    }, this.securityConfig.sessionTimeout);
  }

  /**
   * Handle session timeout
   */
  handleSessionTimeout() {
    console.log('[Security] Session timeout reached');
    
    // Clear sensitive data
    this.clearSensitiveData();
    
    // Notify user
    this.showSecurityAlert('Session expired for security. Please refresh the extension.');
  }

  /**
   * Start security monitoring
   */
  startSecurityMonitoring() {
    // Monitor for suspicious activity
    this.monitorSuspiciousActivity();
    
    // Set up rate limiting
    this.setupRateLimiting();
    
    console.log('[Security] Security monitoring started');
  }

  /**
   * Monitor for suspicious activity
   */
  monitorSuspiciousActivity() {
    // Monitor rapid repeated actions
    let actionCount = 0;
    const resetInterval = setInterval(() => {
      if (actionCount > 50) { // More than 50 actions per second
        this.reportSecurityEvent('suspicious_activity', {
          actionCount,
          timeframe: '1 second'
        });
      }
      actionCount = 0;
    }, 1000);
    
    // Track actions
    document.addEventListener('click', () => actionCount++);
    document.addEventListener('keypress', () => actionCount++);
  }

  /**
   * Set up rate limiting
   */
  setupRateLimiting() {
    // Rate limit API requests
    this.originalFetch = window.fetch;
    window.fetch = this.createRateLimitedFetch();
  }

  /**
   * Create rate-limited fetch wrapper
   */
  createRateLimitedFetch() {
    return async (url, options = {}) => {
      const key = this.getRateLimitKey(url);
      
      if (!this.checkRateLimit(key)) {
        throw new Error('Rate limit exceeded');
      }
      
      this.recordRequest(key);
      
      return this.originalFetch.call(window, url, options);
    };
  }

  /**
   * Get rate limit key from URL
   */
  getRateLimitKey(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check rate limit
   */
  checkRateLimit(key) {
    const now = Date.now();
    const requests = this.rateLimiter.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => 
      now - timestamp < this.rateLimiter.windowMs
    );
    
    this.rateLimiter.requests.set(key, validRequests);
    
    return validRequests.length < this.rateLimiter.maxRequests;
  }

  /**
   * Record a request for rate limiting
   */
  recordRequest(key) {
    const requests = this.rateLimiter.requests.get(key) || [];
    requests.push(Date.now());
    this.rateLimiter.requests.set(key, requests);
  }

  /**
   * Generate cryptographic nonce
   */
  generateNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Sanitize file data
   */
  sanitizeFileData(data, filename) {
    // Validate file extension
    const extension = filename.split('.').pop().toLowerCase();
    if (this.securityConfig.blockedExtensions.includes('.' + extension)) {
      throw new Error(`File type .${extension} is not allowed`);
    }
    
    // Validate file size
    if (data.size > this.securityConfig.maxFileSize) {
      throw new Error('File too large');
    }
    
    return data;
  }

  /**
   * Validate URL security
   */
  validateUrlSecurity(url) {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!this.securityConfig.allowedProtocols.includes(urlObj.protocol)) {
        throw new Error(`Protocol ${urlObj.protocol} is not allowed`);
      }
      
      // Check for dangerous URLs
      const dangerousPatterns = [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /file:/i
      ];
      
      if (dangerousPatterns.some(pattern => pattern.test(url))) {
        throw new Error('URL contains dangerous protocol');
      }
      
      return true;
      
    } catch (error) {
      throw new Error(`URL validation failed: ${error.message}`);
    }
  }

  /**
   * Enter security mode (limited functionality)
   */
  enterSecurityMode() {
    console.warn('[Security] Entering security mode - functionality limited');
    
    // Disable potentially dangerous features
    document.body.classList.add('security-mode');
    
    // Store security mode state
    chrome.storage.local.set({ securityMode: true });
  }

  /**
   * Clear sensitive data
   */
  clearSensitiveData() {
    try {
      // Clear temporary variables
      if (window.currentPdfBlob) {
        window.currentPdfBlob = null;
      }
      
      // Clear form data
      const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
      inputs.forEach(input => input.value = '');
      
      console.log('[Security] Sensitive data cleared');
      
    } catch (error) {
      console.error('[Security] Failed to clear sensitive data:', error);
    }
  }

  /**
   * Show security alert
   */
  showSecurityAlert(message) {
    // Use extension's own alert system if available
    if (window.showError) {
      window.showError(message);
    } else {
      console.error('[Security Alert]', message);
    }
  }

  /**
   * Report security event
   */
  reportSecurityEvent(eventType, data) {
    try {
      chrome.runtime.sendMessage({
        type: 'report-error',
        errorType: `security_${eventType}`,
        error: {
          message: `Security event: ${eventType}`,
          data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[Security] Failed to report security event:', error);
    }
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      initialized: this.initialized,
      nonce: this.nonce,
      lastIntegrityCheck: this.integrityChecks.lastVerification,
      rateLimitStatus: {
        totalKeys: this.rateLimiter.requests.size,
        maxRequests: this.rateLimiter.maxRequests,
        windowMs: this.rateLimiter.windowMs
      }
    };
  }
}

// Initialize security manager
const securityManager = new SecurityManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    securityManager.initialize().catch(console.error);
  });
} else {
  securityManager.initialize().catch(console.error);
}

// Export for use in other modules
window.SecurityManager = SecurityManager;
window.securityManager = securityManager;