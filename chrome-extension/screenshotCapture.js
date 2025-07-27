/**
 * ProofVault Screenshot Capture Utility
 * Optimized for performance, quality, and reliability
 */

class ScreenshotCapture {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'png',
      quality: options.quality || 95,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 10800, // Support very long pages
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      timeout: options.timeout || 30000,
      compressionLevel: options.compressionLevel || 6,
      ...options
    };
    
    this.canvas = null;
    this.context = null;
    this.initialized = false;
  }

  /**
   * Initialize the canvas for image processing
   */
  initializeCanvas() {
    if (this.initialized) return;
    
    try {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });
      
      // Optimize canvas for better performance
      this.context.imageSmoothingEnabled = true;
      this.context.imageSmoothingQuality = 'high';
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize canvas:', error);
      throw new Error('Canvas initialization failed');
    }
  }

  /**
   * Capture screenshot with optimizations and retry logic
   */
  async captureScreenshot(tab, options = {}) {
    const startTime = performance.now();
    const captureOptions = { ...this.options, ...options };
    
    try {
      // Validate tab
      if (!tab || !tab.id) {
        throw new Error('Invalid tab provided for screenshot capture');
      }

      // Check if tab is capturable
      await this.validateTabCapture(tab);

      // Attempt capture with retry logic
      let lastError = null;
      for (let attempt = 1; attempt <= captureOptions.retryAttempts; attempt++) {
        try {
          console.log(`Screenshot capture attempt ${attempt}/${captureOptions.retryAttempts}`);
          
          const dataUrl = await this.performCapture(tab, captureOptions);
          const optimizedDataUrl = await this.optimizeImage(dataUrl, captureOptions);
          
          const endTime = performance.now();
          console.log(`Screenshot captured successfully in ${Math.round(endTime - startTime)}ms`);
          
          return {
            dataUrl: optimizedDataUrl,
            metadata: {
              captureTime: new Date().toISOString(),
              processingTime: Math.round(endTime - startTime),
              format: captureOptions.format,
              quality: captureOptions.quality,
              attempt: attempt,
              tabInfo: {
                id: tab.id,
                url: tab.url,
                title: tab.title,
                windowId: tab.windowId
              }
            }
          };
          
        } catch (error) {
          lastError = error;
          console.warn(`Screenshot attempt ${attempt} failed:`, error.message);
          
          if (attempt < captureOptions.retryAttempts) {
            await this.delay(captureOptions.retryDelay * attempt);
            
            // Try to refresh tab state before retry
            if (attempt > 1) {
              try {
                const updatedTab = await chrome.tabs.get(tab.id);
                if (updatedTab.status === 'complete') {
                  tab = updatedTab;
                }
              } catch (refreshError) {
                console.warn('Could not refresh tab state:', refreshError);
              }
            }
          }
        }
      }
      
      throw lastError || new Error('Screenshot capture failed after all retry attempts');
      
    } catch (error) {
      const endTime = performance.now();
      console.error(`Screenshot capture failed after ${Math.round(endTime - startTime)}ms:`, error);
      
      // Provide detailed error information
      const enhancedError = new Error(`Screenshot capture failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.tabInfo = tab;
      enhancedError.processingTime = Math.round(endTime - startTime);
      
      throw enhancedError;
    }
  }

  /**
   * Validate if tab can be captured
   */
  async validateTabCapture(tab) {
    // Check if tab is accessible
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension://')) {
      throw new Error('Cannot capture screenshots of browser internal pages');
    }

    // Check if tab is fully loaded
    if (tab.status !== 'complete') {
      console.warn('Tab is still loading, attempting capture anyway');
    }

    // Verify we have necessary permissions
    try {
      await chrome.tabs.get(tab.id);
    } catch (error) {
      throw new Error('Insufficient permissions to access tab');
    }
  }

  /**
   * Perform the actual screenshot capture
   */
  async performCapture(tab, options) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Screenshot capture timeout after ${options.timeout}ms`));
      }, options.timeout);

      try {
        chrome.tabs.captureVisibleTab(tab.windowId, {
          format: options.format,
          quality: options.format === 'jpeg' ? options.quality : undefined
        }, (dataUrl) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(`Chrome API error: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!dataUrl) {
            reject(new Error('Screenshot capture returned empty result'));
            return;
          }
          
          resolve(dataUrl);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Optimize captured image for better performance and quality
   */
  async optimizeImage(dataUrl, options) {
    try {
      this.initializeCanvas();
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            const { width: newWidth, height: newHeight } = this.calculateOptimalDimensions(
              img.width, 
              img.height, 
              options.maxWidth, 
              options.maxHeight
            );
            
            // Set canvas dimensions
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            
            // Clear canvas
            this.context.clearRect(0, 0, newWidth, newHeight);
            
            // Draw and scale image
            this.context.drawImage(img, 0, 0, newWidth, newHeight);
            
            // Generate optimized data URL
            const optimizedDataUrl = this.canvas.toDataURL(
              `image/${options.format}`, 
              options.format === 'jpeg' ? options.quality / 100 : undefined
            );
            
            // Log optimization results
            const originalSize = this.getDataUrlSize(dataUrl);
            const optimizedSize = this.getDataUrlSize(optimizedDataUrl);
            const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
            
            console.log(`Image optimized: ${img.width}x${img.height} → ${newWidth}x${newHeight}, ` +
                       `${originalSize}KB → ${optimizedSize}KB (${compressionRatio}% reduction)`);
            
            resolve(optimizedDataUrl);
            
          } catch (error) {
            reject(new Error(`Image optimization failed: ${error.message}`));
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load captured image for optimization'));
        };
        
        img.src = dataUrl;
      });
      
    } catch (error) {
      console.warn('Image optimization failed, returning original:', error);
      return dataUrl;
    }
  }

  /**
   * Calculate optimal dimensions for image resizing
   */
  calculateOptimalDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    let newWidth = originalWidth;
    let newHeight = originalHeight;
    
    // Scale down if image exceeds maximum dimensions
    if (newWidth > maxWidth) {
      const ratio = maxWidth / newWidth;
      newWidth = maxWidth;
      newHeight = Math.round(newHeight * ratio);
    }
    
    if (newHeight > maxHeight) {
      const ratio = maxHeight / newHeight;
      newHeight = maxHeight;
      newWidth = Math.round(newWidth * ratio);
    }
    
    return { width: newWidth, height: newHeight };
  }

  /**
   * Get approximate size of data URL in KB
   */
  getDataUrlSize(dataUrl) {
    // Remove data URL prefix and calculate base64 size
    const base64Data = dataUrl.split(',')[1] || '';
    const sizeInBytes = (base64Data.length * 3) / 4;
    return Math.round(sizeInBytes / 1024);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Capture full page screenshot (experimental)
   */
  async captureFullPage(tab, options = {}) {
    // This would require content script injection for full page capture
    // For now, return regular visible tab capture
    console.warn('Full page capture not yet implemented, using visible tab capture');
    return this.captureScreenshot(tab, options);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.canvas) {
      this.canvas.width = 1;
      this.canvas.height = 1;
      this.canvas = null;
    }
    this.context = null;
    this.initialized = false;
  }
}

// Export for use in other modules
window.ScreenshotCapture = ScreenshotCapture;