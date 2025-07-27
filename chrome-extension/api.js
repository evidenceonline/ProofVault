/**
 * Custom API Error class for better error handling
 */
class ApiError extends Error {
  constructor(message, status = 500, data = {}, requestId = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      data: this.data,
      requestId: this.requestId,
      timestamp: this.timestamp
    };
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
    this.maxRetries = API_CONFIG.MAX_RETRIES;
    this.requestId = 0;
    this.activeRequests = new Map();
    this.rateLimitDelay = 1000; // Base delay for rate limiting
    this.lastRequestTime = 0;
    
    // Security headers
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-ProofVault-Extension': chrome.runtime.getManifest().version
    };
  }

  /**
   * Enhanced request method with comprehensive error handling and security
   */
  async makeRequest(url, options = {}, retryCount = 0) {
    const requestId = ++this.requestId;
    const startTime = performance.now();
    
    // Rate limiting
    await this.enforceRateLimit();
    
    // Setup request tracking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      this.activeRequests.delete(requestId);
    }, this.timeout);
    
    this.activeRequests.set(requestId, { controller, url, startTime });

    try {
      // Validate URL
      this.validateUrl(url);
      
      // Prepare secure headers
      const secureHeaders = this.prepareHeaders(options.headers);
      
      // Prepare request options
      const requestOptions = {
        ...options,
        headers: secureHeaders,
        signal: controller.signal,
        credentials: 'omit', // Security: don't send credentials
        referrerPolicy: 'no-referrer'
      };
      
      console.log(`[API] Request ${requestId}: ${options.method || 'GET'} ${url}`);
      
      const response = await window.fetch.call(window, url, requestOptions);
      
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      // Log response
      console.log(`[API] Response ${requestId}: ${response.status} (${duration}ms)`);
      
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        const error = new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData,
          requestId
        );
        throw error;
      }
      
      // Validate response
      await this.validateResponse(response);
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      console.warn(`[API] Request ${requestId} failed after ${duration}ms:`, error.message);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408, { timeout: this.timeout }, requestId);
      }
      
      if (error instanceof ApiError) {
        // Already an ApiError, check if retryable
        if (retryCount < this.maxRetries && this.isRetryableError(error)) {
          return this.retryRequest(url, options, retryCount, error);
        }
        throw error;
      }
      
      // Network or other errors
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        return this.retryRequest(url, options, retryCount, error);
      }
      
      throw new ApiError(
        `Network error: ${error.message}`,
        0,
        { originalError: error.name },
        requestId
      );
    }
  }

  /**
   * Enhanced retry logic with exponential backoff
   */
  async retryRequest(url, options, retryCount, lastError) {
    const nextRetry = retryCount + 1;
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    const totalDelay = backoffDelay + jitter;
    
    console.log(`[API] Retry ${nextRetry}/${this.maxRetries} after ${Math.round(totalDelay)}ms`);
    
    await this.delay(totalDelay);
    return this.makeRequest(url, options, nextRetry);
  }

  /**
   * Validate URL for security
   */
  validateUrl(url) {
    try {
      console.log('[API] Validating URL:', url);
      const urlObj = new URL(url);
      
      console.log('[API] URL parsed:', {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname
      });
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
      
      // Validate against allowed hosts
      const allowedHosts = [
        'proofvault.net',
        'proofvault.com',
        'api.proofvault.com',
        'localhost',
        '127.0.0.1'
      ];
      
      const isAllowed = allowedHosts.some(host => 
        urlObj.hostname === host
      );
      
      console.log('[API] Host validation:', {
        hostname: urlObj.hostname,
        allowedHosts,
        isAllowed
      });
      
      if (!isAllowed) {
        throw new Error(`Host not allowed: ${urlObj.hostname}`);
      }
      
      console.log('[API] URL validation passed');
      
    } catch (error) {
      console.error('[API] URL validation failed:', error);
      throw new ApiError(`Invalid URL: ${error.message}`, 400, { url });
    }
  }

  /**
   * Prepare secure headers
   */
  prepareHeaders(customHeaders = {}) {
    // Sanitize custom headers
    const sanitizedHeaders = {};
    for (const [key, value] of Object.entries(customHeaders)) {
      if (typeof key === 'string' && typeof value === 'string') {
        // Remove potential injection attempts
        const cleanKey = key.replace(/[^\w-]/g, '');
        const cleanValue = value.replace(/[\r\n]/g, '');
        if (cleanKey && cleanValue) {
          sanitizedHeaders[cleanKey] = cleanValue;
        }
      }
    }
    
    return {
      ...this.defaultHeaders,
      ...sanitizedHeaders
    };
  }

  /**
   * Parse error response safely
   */
  async parseErrorResponse(response) {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        // Validate response structure
        if (typeof data === 'object' && data !== null) {
          return data;
        }
      }
    } catch (parseError) {
      console.warn('Failed to parse error response:', parseError);
    }
    
    return { message: `HTTP ${response.status}: ${response.statusText}` };
  }

  /**
   * Validate response for security
   */
  async validateResponse(response) {
    // Check content type
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('application/pdf')) {
      console.warn('Unexpected content type:', contentType);
    }
    
    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
      throw new ApiError('Response too large', 413, { contentLength });
    }
  }

  /**
   * Rate limiting enforcement
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await this.delay(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (error instanceof ApiError) {
      // Retry on server errors and rate limits
      return error.status >= 500 || error.status === 429 || error.status === 408;
    }
    
    // Retry on network errors
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.name === 'TypeError';
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests() {
    for (const [requestId, { controller }] of this.activeRequests) {
      controller.abort();
      console.log(`[API] Cancelled request ${requestId}`);
    }
    this.activeRequests.clear();
  }

  /**
   * Get active request count
   */
  getActiveRequestCount() {
    return this.activeRequests.size;
  }

  /**
   * Upload PDF with validation and security checks
   */
  async uploadPdf(pdfBlob, metadata) {
    try {
      // Validate inputs
      if (!pdfBlob || !(pdfBlob instanceof Blob)) {
        throw new ApiError('Invalid PDF blob provided', 400);
      }
      
      if (!metadata || !metadata.id || !metadata.company || !metadata.user) {
        throw new ApiError('Missing required metadata', 400);
      }
      
      // Validate PDF size (max 25MB)
      if (pdfBlob.size > 25 * 1024 * 1024) {
        throw new ApiError('PDF file too large (max 25MB)', 413);
      }
      
      // Validate PDF type
      if (pdfBlob.type && !pdfBlob.type.includes('pdf')) {
        console.warn('Warning: Blob type is not PDF:', pdfBlob.type);
      }
      
      // Sanitize metadata
      const sanitizedMetadata = this.sanitizeMetadata(metadata);
      
      // Prepare form data
      const formData = new FormData();
      formData.append('pdf', pdfBlob, `ProofVault_${sanitizedMetadata.id}.pdf`);
      formData.append('company_name', sanitizedMetadata.company);
      formData.append('username', sanitizedMetadata.user);
      
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.UPLOAD_PDF}`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type for FormData
      });

      return response.json();
      
    } catch (error) {
      console.error('[API] PDF upload failed:', error);
      throw error instanceof ApiError ? error : new ApiError(`Upload failed: ${error.message}`, 500);
    }
  }

  /**
   * Sanitize metadata to prevent injection
   */
  sanitizeMetadata(metadata) {
    const sanitize = (str) => {
      if (typeof str !== 'string') return '';
      return str.replace(/[<>\"'&]/g, '').trim().substring(0, 255);
    };
    
    return {
      id: sanitize(metadata.id),
      company: sanitize(metadata.company),
      user: sanitize(metadata.user)
    };
  }

  /**
   * List PDFs with secure parameter handling
   */
  async listPdfs(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      // Sanitize and validate filters
      const sanitizedFilters = this.sanitizeFilters(filters);
      
      for (const [key, value] of Object.entries(sanitizedFilters)) {
        if (value !== null && value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      }

      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.LIST_PDFS}?${params}`;
      const response = await this.makeRequest(url);

      return response.json();
      
    } catch (error) {
      console.error('[API] List PDFs failed:', error);
      throw error instanceof ApiError ? error : new ApiError(`List failed: ${error.message}`, 500);
    }
  }

  /**
   * Get PDF with validation
   */
  async getPdf(id, download = false) {
    try {
      // Validate ID format
      if (!this.isValidId(id)) {
        throw new ApiError('Invalid PDF ID format', 400);
      }
      
      const params = download ? '?download=true' : '';
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.GET_PDF}/${encodeURIComponent(id)}${params}`;
      
      const response = await this.makeRequest(url);

      if (download) {
        return response.blob();
      }
      
      return response.json();
      
    } catch (error) {
      console.error('[API] Get PDF failed:', error);
      throw error instanceof ApiError ? error : new ApiError(`Get PDF failed: ${error.message}`, 500);
    }
  }

  /**
   * Delete PDF with validation
   */
  async deletePdf(id) {
    try {
      // Validate ID format
      if (!this.isValidId(id)) {
        throw new ApiError('Invalid PDF ID format', 400);
      }
      
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.DELETE_PDF}/${encodeURIComponent(id)}`;
      const response = await this.makeRequest(url, {
        method: 'DELETE'
      });

      return response.json();
      
    } catch (error) {
      console.error('[API] Delete PDF failed:', error);
      throw error instanceof ApiError ? error : new ApiError(`Delete failed: ${error.message}`, 500);
    }
  }

  /**
   * Health check with timeout handling
   */
  async checkHealth() {
    try {
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.HEALTH}`;
      console.log('[API] Health check starting, URL:', url);
      console.log('[API] Base URL:', this.baseUrl);
      console.log('[API] Health endpoint:', API_CONFIG.ENDPOINTS.HEALTH);
      
      const response = await this.makeRequest(url, {}, 0); // No retries for health check
      console.log('[API] Health check response received');
      
      return response.json();
      
    } catch (error) {
      console.error('[API] Health check failed:', error);
      throw error instanceof ApiError ? error : new ApiError(`Health check failed: ${error.message}`, 500);
    }
  }

  /**
   * Sanitize filter parameters
   */
  sanitizeFilters(filters) {
    const sanitized = {};
    const allowedKeys = ['company_name', 'username', 'limit', 'offset', 'page', 'search', 'date_from', 'date_to', 'sort_by', 'sort_order'];
    
    for (const key of allowedKeys) {
      if (filters.hasOwnProperty(key)) {
        const value = filters[key];
        
        if (key === 'limit' || key === 'offset' || key === 'page') {
          // Validate numeric parameters
          const num = parseInt(value);
          if (!isNaN(num) && num >= 0) {
            sanitized[key] = Math.min(num, key === 'limit' ? 100 : 10000); // Reasonable limits
          }
        } else if (typeof value === 'string') {
          // Sanitize string parameters
          const clean = value.replace(/[<>\"'&\x00-\x1f]/g, '').trim().substring(0, 100);
          if (clean) sanitized[key] = clean;
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Validate ID format (UUID or ProofVault format)
   */
  isValidId(id) {
    if (typeof id !== 'string') return false;
    
    // UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // ProofVault format (PV_timestamp_random)
    const pvRegex = /^PV_\d+_[a-z0-9]{9}$/i;
    
    return uuidRegex.test(id) || pvRegex.test(id);
  }

  /**
   * Test function to verify fetch is working correctly
   * This helps diagnose the "Illegal invocation" error
   */
  async testFetch() {
    try {
      console.log('[API] Testing fetch function...');
      
      // Test basic fetch call
      const testUrl = 'data:text/plain;base64,dGVzdA=='; // "test" in base64
      const response = await window.fetch.call(window, testUrl);
      
      if (response.ok) {
        const text = await response.text();
        console.log('[API] ✅ Basic fetch test passed:', text);
        return { success: true, message: 'Fetch is working correctly' };
      } else {
        throw new Error(`Response not ok: ${response.status}`);
      }
    } catch (error) {
      console.error('[API] ❌ Fetch test failed:', error);
      
      if (error.message.includes('Illegal invocation')) {
        return { 
          success: false, 
          message: 'Illegal invocation error still present',
          error: error.message 
        };
      } else {
        return { 
          success: false, 
          message: 'Different fetch error',
          error: error.message 
        };
      }
    }
  }
}

// Export classes for use in other modules
window.ApiClient = ApiClient;
window.ApiError = ApiError;