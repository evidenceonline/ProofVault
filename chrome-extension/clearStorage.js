/**
 * Storage cleanup utility for ProofVault Chrome Extension
 * Run this in extension console to clear storage quota issues
 */

function clearExtensionStorage() {
  return new Promise((resolve, reject) => {
    try {
      // Clear all chrome storage
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('✅ Chrome extension storage cleared successfully');
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function clearSpecificKeys() {
  return new Promise((resolve, reject) => {
    try {
      const keysToRemove = [
        'proofvault_logs',
        'performance_metrics',
        'network_requests',
        'debug_logs'
      ];
      
      chrome.storage.local.remove(keysToRemove, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('✅ Specific storage keys cleared:', keysToRemove);
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function checkStorageUsage() {
  try {
    const usage = await chrome.storage.local.getBytesInUse();
    console.log(`Current storage usage: ${usage} bytes (${Math.round(usage / 1024)} KB)`);
    
    const all = await chrome.storage.local.get();
    console.log('Stored keys:', Object.keys(all));
    
    for (const [key, value] of Object.entries(all)) {
      const size = JSON.stringify(value).length;
      console.log(`- ${key}: ${size} bytes`);
    }
  } catch (error) {
    console.error('Failed to check storage usage:', error);
  }
}

// Auto-run on script load
console.log('ProofVault Storage Cleanup Utility Loaded');
console.log('Available functions:');
console.log('- clearExtensionStorage(): Clear all storage');
console.log('- clearSpecificKeys(): Clear logging-related keys only');
console.log('- checkStorageUsage(): Show current usage');

// Automatically check current usage
checkStorageUsage();