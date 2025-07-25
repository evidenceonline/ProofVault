// Options page script for ProofVault Chrome Extension
import { getSettings, saveSettings, getFromStorage, saveToStorage, clearStorage, exportData, importData, getStorageInfo } from './utils/storage.js';
import { checkAPIHealth } from './utils/api.js';
import { generateKeyPair } from './utils/cryptoUtils.js';
import { formatBytes } from './utils/helpers.js';

// DOM elements
let form = {};

// Default settings
const DEFAULT_SETTINGS = {
  apiEndpoint: 'http://localhost:3001',
  apiKey: '',
  autoSave: true,
  includeMetadata: true,
  pdfQuality: 'medium',
  filenamingPattern: 'timestamp',
  autoSubmit: false,
  privateKey: '',
  clearHistoryOnClose: false,
  historyRetention: 30,
  enableLogging: false
};

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  attachEventListeners();
  await loadSettings();
  await updateStorageInfo();
});

function initializeElements() {
  form = {
    apiEndpoint: document.getElementById('apiEndpoint'),
    apiKey: document.getElementById('apiKey'),
    autoSave: document.getElementById('autoSave'),
    includeMetadata: document.getElementById('includeMetadata'),
    pdfQuality: document.getElementById('pdfQuality'),
    filenamingPattern: document.getElementById('filenamingPattern'),
    autoSubmit: document.getElementById('autoSubmit'),
    privateKey: document.getElementById('privateKey'),
    clearHistoryOnClose: document.getElementById('clearHistoryOnClose'),
    historyRetention: document.getElementById('historyRetention'),
    enableLogging: document.getElementById('enableLogging')
  };
}

function attachEventListeners() {
  // Test connection button
  document.getElementById('testConnectionBtn').addEventListener('click', testConnection);
  
  // Generate key pair button
  document.getElementById('generateKeyPairBtn').addEventListener('click', generateKeys);
  
  // Copy key buttons
  document.querySelectorAll('.copy-key-btn').forEach(btn => {
    btn.addEventListener('click', copyKey);
  });
  
  // Data management buttons
  document.getElementById('exportDataBtn').addEventListener('click', exportAllData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importAllData);
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
  
  // Save and reset buttons
  document.getElementById('saveBtn').addEventListener('click', saveAllSettings);
  document.getElementById('resetBtn').addEventListener('click', resetToDefaults);
  
  // Auto-save on input change
  Object.values(form).forEach(element => {
    if (element.type === 'checkbox') {
      element.addEventListener('change', autoSave);
    } else {
      element.addEventListener('input', debounce(autoSave, 1000));
    }
  });
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await getSettings(Object.keys(DEFAULT_SETTINGS));
    
    // Merge with defaults
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    // Populate form
    Object.keys(form).forEach(key => {
      const element = form[key];
      const value = mergedSettings[key];
      
      if (element.type === 'checkbox') {
        element.checked = value;
      } else {
        element.value = value || '';
      }
    });
    
    showNotification('Settings loaded successfully', 'success');
  } catch (error) {
    console.error('Failed to load settings:', error);
    showNotification('Failed to load settings', 'error');
  }
}

// Save all settings
async function saveAllSettings() {
  try {
    const settings = {};
    
    // Collect form data
    Object.keys(form).forEach(key => {
      const element = form[key];
      if (element.type === 'checkbox') {
        settings[key] = element.checked;
      } else {
        settings[key] = element.value.trim();
      }
    });
    
    // Validate settings
    if (settings.apiEndpoint && !isValidURL(settings.apiEndpoint)) {
      throw new Error('Invalid API endpoint URL');
    }
    
    if (settings.historyRetention < 1 || settings.historyRetention > 365) {
      throw new Error('History retention must be between 1 and 365 days');
    }
    
    // Save to storage
    await saveSettings(settings);
    
    showNotification('Settings saved successfully', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showNotification('Failed to save settings: ' + error.message, 'error');
  }
}

// Auto-save settings with debounce
const autoSave = debounce(async () => {
  try {
    await saveAllSettings();
  } catch (error) {
    // Silent fail for auto-save
    console.error('Auto-save failed:', error);
  }
}, 2000);

// Reset to default settings
async function resetToDefaults() {
  if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    try {
      await saveSettings(DEFAULT_SETTINGS);
      await loadSettings();
      showNotification('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      showNotification('Failed to reset settings', 'error');
    }
  }
}

// Test API connection
async function testConnection() {
  const testBtn = document.getElementById('testConnectionBtn');
  const statusDiv = document.getElementById('connectionStatus');
  const apiEndpoint = form.apiEndpoint.value.trim();
  
  if (!apiEndpoint) {
    showConnectionStatus('Please enter an API endpoint', 'error');
    return;
  }
  
  if (!isValidURL(apiEndpoint)) {
    showConnectionStatus('Invalid URL format', 'error');
    return;
  }
  
  try {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    const isHealthy = await checkAPIHealth(apiEndpoint);
    
    if (isHealthy) {
      showConnectionStatus('Connection successful!', 'success');
    } else {
      showConnectionStatus('Connection failed - API not responding', 'error');
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    showConnectionStatus('Connection failed: ' + error.message, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"></path>
      </svg>
      Test Connection
    `;
  }
}

// Show connection status
function showConnectionStatus(message, type) {
  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  statusDiv.classList.remove('hidden');
  
  // Hide after 5 seconds
  setTimeout(() => {
    statusDiv.classList.add('hidden');
  }, 5000);
}

// Generate cryptographic key pair
async function generateKeys() {
  const generateBtn = document.getElementById('generateKeyPairBtn');
  const keyPairDisplay = document.getElementById('keyPairDisplay');
  
  try {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    const keyPair = await generateKeyPair();
    
    // Display generated keys
    document.getElementById('publicKeyDisplay').value = keyPair.publicKey;
    document.getElementById('privateKeyDisplay').value = keyPair.privateKey;
    
    // Auto-fill private key in settings
    form.privateKey.value = keyPair.privateKey;
    
    keyPairDisplay.classList.remove('hidden');
    
    showNotification('Key pair generated successfully', 'success');
  } catch (error) {
    console.error('Key generation failed:', error);
    showNotification('Failed to generate keys: ' + error.message, 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <circle cx="12" cy="16" r="1"></circle>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      Generate New Key Pair
    `;
  }
}

// Copy key to clipboard
async function copyKey(event) {
  const keyType = event.target.dataset.key;
  const textarea = document.getElementById(`${keyType}KeyDisplay`);
  
  try {
    await navigator.clipboard.writeText(textarea.value);
    
    // Visual feedback
    const originalText = event.target.textContent;
    event.target.textContent = 'Copied!';
    event.target.classList.add('success');
    
    setTimeout(() => {
      event.target.textContent = originalText;
      event.target.classList.remove('success');
    }, 2000);
    
    showNotification(`${keyType} key copied to clipboard`, 'success');
  } catch (error) {
    console.error('Failed to copy key:', error);
    showNotification('Failed to copy key', 'error');
  }
}

// Export all data
async function exportAllData() {
  try {
    const data = await exportData();
    
    // Create download link
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proofvault-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showNotification('Failed to export data: ' + error.message, 'error');
  }
}

// Import data from file
async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (confirm('This will replace all current data. Are you sure you want to continue?')) {
      await importData(data);
      await loadSettings();
      await updateStorageInfo();
      
      showNotification('Data imported successfully', 'success');
    }
  } catch (error) {
    console.error('Import failed:', error);
    showNotification('Failed to import data: ' + error.message, 'error');
  } finally {
    // Reset file input
    event.target.value = '';
  }
}

// Clear all data
async function clearAllData() {
  if (confirm('This will permanently delete all stored data including history, settings, and keys. This cannot be undone. Are you sure?')) {
    if (confirm('Final confirmation: Delete ALL ProofVault data?')) {
      try {
        await clearStorage();
        await chrome.storage.sync.clear();
        
        // Reset form to defaults
        await loadSettings();
        await updateStorageInfo();
        
        showNotification('All data cleared successfully', 'success');
      } catch (error) {
        console.error('Clear data failed:', error);
        showNotification('Failed to clear data: ' + error.message, 'error');
      }
    }
  }
}

// Update storage usage information
async function updateStorageInfo() {
  try {
    const storageInfo = await getStorageInfo();
    
    document.getElementById('storageUsed').textContent = formatBytes(storageInfo.bytesInUse);
    document.getElementById('storageTotal').textContent = formatBytes(storageInfo.quota);
    
    const storageFill = document.getElementById('storageFill');
    storageFill.style.width = Math.min(storageInfo.percentUsed, 100) + '%';
    
    // Color coding based on usage
    if (storageInfo.percentUsed > 90) {
      storageFill.className = 'storage-fill danger';
    } else if (storageInfo.percentUsed > 70) {
      storageFill.className = 'storage-fill warning';
    } else {
      storageFill.className = 'storage-fill';
    }
  } catch (error) {
    console.error('Failed to update storage info:', error);
  }
}

// Utility functions
function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showNotification(message, type = 'info') {
  const notifications = document.getElementById('notifications');
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notifications.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
  
  // Remove on click
  notification.addEventListener('click', () => {
    notification.remove();
  });
}