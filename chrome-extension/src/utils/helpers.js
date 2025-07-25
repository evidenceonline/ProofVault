// Helper utilities for ProofVault Chrome Extension

// Format bytes to human readable format
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Format date to human readable format
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Truncate hash for display
export function truncateHash(hash, startChars = 8, endChars = 8) {
  if (hash.length <= startChars + endChars + 3) return hash;
  return `${hash.substring(0, startChars)}...${hash.substring(hash.length - endChars)}`;
}

// Validate URL format
export function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Generate random ID
export function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Debounce function
export function debounce(func, wait, immediate) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

// Throttle function
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Deep clone object
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

// Sanitize filename for download
export function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

// Parse URL components
export function parseURL(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      port: urlObj.port
    };
  } catch (error) {
    return null;
  }
}

// Get domain from URL
export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return url;
  }
}

// Format error message
export function formatError(error) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error.message) return error.message;
  return 'An unknown error occurred';
}

// Check if running in extension context
export function isExtensionContext() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

// Convert blob to data URL
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert data URL to blob
export function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Color utilities
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Local storage helpers
export function setLocalItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error setting localStorage item:', error);
    return false;
  }
}

export function getLocalItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error getting localStorage item:', error);
    return defaultValue;
  }
}

// Animation helpers
export function fadeIn(element, duration = 300) {
  element.style.opacity = '0';
  element.style.display = 'block';
  
  const start = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    
    element.style.opacity = progress;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}

export function fadeOut(element, duration = 300) {
  const start = performance.now();
  const initialOpacity = parseFloat(element.style.opacity) || 1;
  
  function animate(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    
    element.style.opacity = initialOpacity * (1 - progress);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.style.display = 'none';
    }
  }
  
  requestAnimationFrame(animate);
}