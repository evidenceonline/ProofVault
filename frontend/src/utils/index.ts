import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistance, isValid } from 'date-fns';

// Utility for merging Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format file size in human readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Format date with fallback
export function formatDate(date: string | Date, formatStr = 'PPpp'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  
  return format(dateObj, formatStr);
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  
  return formatDistance(dateObj, new Date(), { addSuffix: true });
}

// Truncate string with ellipsis
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

// Truncate hash for display
export function truncateHash(hash: string, startLength = 6, endLength = 4): string {
  if (hash.length <= startLength + endLength) return hash;
  return `${hash.slice(0, startLength)}...${hash.slice(-endLength)}`;
}

// Validate Constellation Network address format
export function isValidAddress(address: string): boolean {
  // Basic validation - adjust based on actual Constellation address format
  return /^[A-Fa-f0-9]{40,64}$/.test(address);
}

// Validate PDF file
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

// Get status color classes
export function getStatusColor(status: string): string {
  const colors = {
    pending: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    processing: 'text-blue-700 bg-blue-50 border-blue-200',
    confirmed: 'text-green-700 bg-green-50 border-green-200',
    failed: 'text-red-700 bg-red-50 border-red-200',
    rejected: 'text-red-700 bg-red-50 border-red-200',
    valid: 'text-green-700 bg-green-50 border-green-200',
    invalid: 'text-red-700 bg-red-50 border-red-200',
    not_found: 'text-gray-700 bg-gray-50 border-gray-200',
    expired: 'text-orange-700 bg-orange-50 border-orange-200',
  };
  
  return colors[status as keyof typeof colors] || 'text-gray-700 bg-gray-50 border-gray-200';
}

// Get status icon
export function getStatusIcon(status: string): string {
  const icons = {
    pending: '⏳',
    processing: '🔄',
    confirmed: '✅',
    failed: '❌',
    rejected: '⛔',
    valid: '✅',
    invalid: '❌',
    not_found: '❓',
    expired: '⏰',
  };
  
  return icons[status as keyof typeof icons] || '❓';
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

// Generate blockchain explorer URL
export function getExplorerUrl(txHash: string, network = 'integrationnet'): string {
  // Adjust based on actual Constellation Network explorer URLs
  const explorers = {
    mainnet: 'https://explorer.constellationnetwork.io',
    testnet: 'https://testnet-explorer.constellationnetwork.io',
    integrationnet: 'https://integrationnet-explorer.constellationnetwork.io',
  };
  
  const baseUrl = explorers[network as keyof typeof explorers] || explorers.integrationnet;
  return `${baseUrl}/transactions/${txHash}`;
}

// Generate QR code data URL (placeholder - would need QR library)
export function generateQRCode(data: string): string {
  // This would use a QR code library like qrcode
  // For now, return a placeholder
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
}

// Parse error message
export function parseError(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.data?.message) return error.data.message;
  if (error?.response?.data?.message) return error.response.data.message;
  return 'An unknown error occurred';
}

// Format network status
export function formatNetworkStatus(status: string): { text: string; color: string } {
  const statusMap = {
    healthy: { text: 'Healthy', color: 'text-green-600' },
    degraded: { text: 'Degraded', color: 'text-yellow-600' },
    offline: { text: 'Offline', color: 'text-red-600' },
  };
  
  return statusMap[status as keyof typeof statusMap] || { text: 'Unknown', color: 'text-gray-600' };
}

// Calculate verification confidence score
export function calculateConfidenceScore(
  confirmations: number,
  age: number,
  maxConfirmations = 6,
  maxAge = 24 * 60 * 60 * 1000 // 24 hours in ms
): number {
  const confirmationScore = Math.min(confirmations / maxConfirmations, 1) * 0.7;
  const ageScore = Math.min(age / maxAge, 1) * 0.3;
  
  return Math.round((confirmationScore + ageScore) * 100);
}

// Export utility functions for file operations
export const fileUtils = {
  isPDF: isPDFFile,
  formatSize: formatFileSize,
  validateSize: (file: File, maxSize: number) => file.size <= maxSize,
  readAsDataURL: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  readAsArrayBuffer: (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },
};

// Export crypto utilities
export const cryptoUtils = {
  generateHash: async (data: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
  
  generateHashFromFile: async (file: File): Promise<string> => {
    const buffer = await fileUtils.readAsArrayBuffer(file);
    return cryptoUtils.generateHash(buffer);
  },
};