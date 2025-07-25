// Storage utilities for ProofVault Chrome Extension

// Save data to Chrome storage
export async function saveToStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Get data from Chrome storage
export async function getFromStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        if (typeof keys === 'string') {
          resolve(result[keys]);
        } else {
          resolve(result);
        }
      }
    });
  });
}

// Save settings to sync storage
export async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Get settings from sync storage
export async function getSettings(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

// Clear all storage
export async function clearStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Storage quota management
export async function getStorageInfo() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Chrome local storage quota is 5MB
        const quota = 5 * 1024 * 1024;
        resolve({
          bytesInUse,
          quota,
          percentUsed: (bytesInUse / quota) * 100,
          bytesRemaining: quota - bytesInUse
        });
      }
    });
  });
}

// Export data for backup
export async function exportData() {
  try {
    const allData = await getFromStorage(null);
    const settings = await getSettings(null);
    
    return {
      version: chrome.runtime.getManifest().version,
      exportDate: new Date().toISOString(),
      localStorage: allData,
      syncStorage: settings
    };
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Import data from backup
export async function importData(backupData) {
  try {
    // Validate backup format
    if (!backupData.version || !backupData.localStorage) {
      throw new Error('Invalid backup format');
    }
    
    // Clear existing data
    await clearStorage();
    
    // Restore local storage
    if (backupData.localStorage) {
      await saveToStorage(backupData.localStorage);
    }
    
    // Restore sync storage
    if (backupData.syncStorage) {
      await saveSettings(backupData.syncStorage);
    }
    
    return true;
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

// Cache management
const CACHE_PREFIX = 'cache_';
const CACHE_EXPIRY = 3600000; // 1 hour

export async function getCachedData(key) {
  const cacheKey = CACHE_PREFIX + key;
  const cached = await getFromStorage(cacheKey);
  
  if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    return cached.data;
  }
  
  return null;
}

export async function setCachedData(key, data) {
  const cacheKey = CACHE_PREFIX + key;
  await saveToStorage({
    [cacheKey]: {
      data,
      timestamp: Date.now()
    }
  });
}

export async function clearCache() {
  const allData = await getFromStorage(null);
  const cacheKeys = Object.keys(allData).filter(key => key.startsWith(CACHE_PREFIX));
  
  if (cacheKeys.length > 0) {
    await new Promise((resolve, reject) => {
      chrome.storage.local.remove(cacheKeys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}