// Background service worker for ProofVault Chrome Extension
import { generatePDFFromTab } from './utils/pdfGenerator.js';
import { generateSHA256Hash } from './utils/cryptoUtils.js';
import { submitToBlockchain } from './utils/api.js';
import { saveToStorage, getFromStorage } from './utils/storage.js';

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('ProofVault Extension installed');
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Capture Page as PDF Evidence',
    contexts: ['page']
  });
  
  // Initialize default settings
  chrome.storage.sync.set({
    apiEndpoint: 'http://localhost:3001',
    autoSave: true,
    includeMetadata: true
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture-page') {
    capturePage(tab);
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capturePage') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        capturePage(tabs[0])
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getHistory') {
    getFromStorage('pdfHistory')
      .then(history => sendResponse({ success: true, data: history || [] }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'verifyPDF') {
    verifyPDF(request.hash)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Main function to capture and process page
async function capturePage(tab) {
  try {
    // Update badge to show processing
    chrome.action.setBadgeText({ text: '...', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
    
    // Capture visible tab
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 95
    });
    
    // Generate PDF from screenshot
    const pdfResult = await generatePDFFromTab(screenshot, {
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString()
    });
    
    // Generate SHA-256 hash
    const hash = await generateSHA256Hash(pdfResult.pdfBlob);
    
    // Prepare metadata
    const metadata = {
      originalUrl: tab.url,
      title: tab.title,
      captureTimestamp: new Date().toISOString(),
      contentType: 'application/pdf',
      fileSize: pdfResult.pdfBlob.size,
      hash: hash,
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language
      }
    };
    
    // Get settings
    const settings = await getFromStorage(['apiEndpoint', 'autoSave', 'privateKey']);
    
    // Submit to blockchain if configured
    let blockchainResult = null;
    if (settings.apiEndpoint && settings.privateKey) {
      try {
        blockchainResult = await submitToBlockchain({
          hash,
          metadata,
          signature: await signData(hash, settings.privateKey),
          pdfData: await blobToBase64(pdfResult.pdfBlob)
        }, settings.apiEndpoint);
      } catch (error) {
        console.error('Blockchain submission failed:', error);
        // Continue even if blockchain submission fails
      }
    }
    
    // Save to local storage
    const historyEntry = {
      id: generateUUID(),
      hash,
      metadata,
      blockchainTx: blockchainResult?.transactionHash,
      status: blockchainResult ? 'registered' : 'local',
      createdAt: new Date().toISOString()
    };
    
    await saveToHistory(historyEntry);
    
    // Auto-save PDF if enabled
    if (settings.autoSave) {
      const filename = `proofvault_${hash.substring(0, 8)}_${Date.now()}.pdf`;
      await savePDFLocally(pdfResult.pdfBlob, filename);
    }
    
    // Update badge to show success
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
    
    return {
      hash,
      metadata,
      blockchainTx: blockchainResult?.transactionHash,
      status: historyEntry.status,
      pdfSize: pdfResult.pdfBlob.size
    };
    
  } catch (error) {
    console.error('Error capturing page:', error);
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
    throw error;
  }
}

// Verify PDF hash against blockchain
async function verifyPDF(hash) {
  const settings = await getFromStorage(['apiEndpoint']);
  if (!settings.apiEndpoint) {
    throw new Error('API endpoint not configured');
  }
  
  const response = await fetch(`${settings.apiEndpoint}/api/pdf/verify/${hash}`);
  if (!response.ok) {
    throw new Error('Verification failed');
  }
  
  return await response.json();
}

// Helper function to save history
async function saveToHistory(entry) {
  const history = await getFromStorage('pdfHistory') || [];
  history.unshift(entry); // Add to beginning
  
  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(100);
  }
  
  await saveToStorage({ pdfHistory: history });
}

// Helper function to save PDF locally
async function savePDFLocally(blob, filename) {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename,
    saveAs: false
  });
  setTimeout(() => URL.revokeObjectURL(url), 60000); // Clean up after 1 minute
}

// Helper function to sign data
async function signData(data, privateKey) {
  // This is a placeholder - implement actual signing logic
  // In production, use Web Crypto API or appropriate signing method
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // For now, return a mock signature
  return btoa(data + privateKey).substring(0, 64);
}

// Helper function to convert blob to base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}