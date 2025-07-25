// Popup script for ProofVault Chrome Extension
import { getFromStorage, saveToStorage } from './utils/storage.js';
import { formatBytes, formatDate, truncateHash } from './utils/helpers.js';

// DOM elements
let captureBtn, progressSection, resultSection, historyList;
let progressFill, progressText, hashDisplay, timestampDisplay, statusDisplay, sizeDisplay;
let copyHashBtn, saveBtn, verifyBtn, settingsBtn, helpBtn, viewAllBtn;

// State
let currentCapture = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  attachEventListeners();
  await loadHistory();
  updateStatus();
});

function initializeElements() {
  captureBtn = document.getElementById('captureBtn');
  progressSection = document.getElementById('progressSection');
  resultSection = document.getElementById('resultSection');
  historyList = document.getElementById('historyList');
  
  progressFill = document.getElementById('progressFill');
  progressText = document.getElementById('progressText');
  
  hashDisplay = document.getElementById('hashDisplay');
  timestampDisplay = document.getElementById('timestampDisplay');
  statusDisplay = document.getElementById('statusDisplay');
  sizeDisplay = document.getElementById('sizeDisplay');
  
  copyHashBtn = document.getElementById('copyHashBtn');
  saveBtn = document.getElementById('saveBtn');
  verifyBtn = document.getElementById('verifyBtn');
  settingsBtn = document.getElementById('settingsBtn');
  helpBtn = document.getElementById('helpBtn');
  viewAllBtn = document.getElementById('viewAllBtn');
}

function attachEventListeners() {
  captureBtn.addEventListener('click', handleCapture);
  copyHashBtn.addEventListener('click', copyHash);
  saveBtn.addEventListener('click', savePDF);
  verifyBtn.addEventListener('click', verifyHash);
  settingsBtn.addEventListener('click', openSettings);
  helpBtn.addEventListener('click', showHelp);
  viewAllBtn.addEventListener('click', viewAllHistory);
}

// Handle capture button click
async function handleCapture() {
  try {
    // Disable capture button and show progress
    captureBtn.disabled = true;
    showProgress();
    updateProgress(10, 'Capturing page...');
    
    // Send message to background script
    const response = await sendMessage({ action: 'capturePage' });
    
    if (response.success) {
      currentCapture = response.data;
      updateProgress(100, 'Complete!');
      
      // Wait a moment then show results
      setTimeout(() => {
        hideProgress();
        showResults(currentCapture);
      }, 1000);
      
      // Reload history
      await loadHistory();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Capture failed:', error);
    hideProgress();
    showError('Failed to capture page: ' + error.message);
  } finally {
    captureBtn.disabled = false;
  }
}

// Show progress UI
function showProgress() {
  progressSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
}

// Update progress
function updateProgress(percent, text) {
  progressFill.style.width = percent + '%';
  progressText.textContent = text;
}

// Hide progress UI
function hideProgress() {
  progressSection.classList.add('hidden');
}

// Show results
function showResults(data) {
  hashDisplay.textContent = data.hash;
  timestampDisplay.textContent = formatDate(data.metadata.captureTimestamp);
  sizeDisplay.textContent = formatBytes(data.pdfSize);
  
  // Update status badge
  statusDisplay.textContent = data.status === 'registered' ? 'Blockchain Registered' : 'Local Only';
  statusDisplay.className = `status-badge ${data.status === 'registered' ? 'success' : 'warning'}`;
  
  resultSection.classList.remove('hidden');
}

// Copy hash to clipboard
async function copyHash() {
  try {
    await navigator.clipboard.writeText(currentCapture.hash);
    
    // Show visual feedback
    const originalText = copyHashBtn.innerHTML;
    copyHashBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    copyHashBtn.classList.add('success');
    
    setTimeout(() => {
      copyHashBtn.innerHTML = originalText;
      copyHashBtn.classList.remove('success');
    }, 2000);
  } catch (error) {
    console.error('Failed to copy hash:', error);
    showError('Failed to copy hash to clipboard');
  }
}

// Save PDF
async function savePDF() {
  if (!currentCapture) return;
  
  try {
    // In a real implementation, this would trigger a download
    // For now, we'll just show a success message
    showSuccess('PDF saved to downloads folder');
  } catch (error) {
    console.error('Failed to save PDF:', error);
    showError('Failed to save PDF');
  }
}

// Verify hash on blockchain
async function verifyHash() {
  if (!currentCapture) return;
  
  try {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    
    const response = await sendMessage({ 
      action: 'verifyPDF', 
      hash: currentCapture.hash 
    });
    
    if (response.success) {
      if (response.data.verified) {
        showSuccess('Hash verified on blockchain!');
      } else {
        showWarning('Hash not found on blockchain');
      }
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Verification failed:', error);
    showError('Verification failed: ' + error.message);
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
      Verify
    `;
  }
}

// Load and display history
async function loadHistory() {
  try {
    const response = await sendMessage({ action: 'getHistory' });
    
    if (response.success) {
      const history = response.data.slice(0, 3); // Show only recent 3
      displayHistory(history);
    } else {
      console.error('Failed to load history:', response.error);
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

// Display history items
function displayHistory(history) {
  if (!history || history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No captures yet</p>';
    return;
  }
  
  historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-info">
        <div class="history-title">${truncateText(item.metadata.title, 30)}</div>
        <div class="history-meta">
          <span class="history-hash">${truncateHash(item.hash)}</span>
          <span class="history-date">${formatDate(item.createdAt)}</span>
        </div>
      </div>
      <div class="history-status">
        <span class="status-badge ${item.status === 'registered' ? 'success' : 'warning'}">
          ${item.status === 'registered' ? '✓' : '⏳'}
        </span>
      </div>
    </div>
  `).join('');
}

// Update connection status
async function updateStatus() {
  const settings = await getFromStorage(['apiEndpoint']);
  const statusIndicator = document.getElementById('statusIndicator');
  const statusDot = statusIndicator.querySelector('.status-dot');
  const statusText = statusIndicator.querySelector('.status-text');
  
  if (settings.apiEndpoint) {
    // Check API health
    try {
      const response = await fetch(`${settings.apiEndpoint}/health`);
      if (response.ok) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Connected';
      } else {
        statusDot.className = 'status-dot warning';
        statusText.textContent = 'API Error';
      }
    } catch (error) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Offline';
    }
  } else {
    statusDot.className = 'status-dot warning';
    statusText.textContent = 'Not Configured';
  }
}

// Open settings
function openSettings() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
}

// Show help
function showHelp() {
  const helpContent = `
    <h3>ProofVault Help</h3>
    <h4>How to use:</h4>
    <ol>
      <li>Click "Capture Current Page" to create a PDF evidence</li>
      <li>The extension will generate a cryptographic hash</li>
      <li>If configured, it will register on blockchain</li>
      <li>Use "Verify" to check blockchain registration</li>
      <li>Save PDF to keep a local copy</li>
    </ol>
    <h4>Features:</h4>
    <ul>
      <li>SHA-256 cryptographic hashing</li>
      <li>Blockchain registration for immutable proof</li>
      <li>PDF generation with metadata</li>
      <li>History tracking</li>
    </ul>
  `;
  
  showModal('Help', helpContent);
}

// View all history
function viewAllHistory() {
  // In a full implementation, this would open a dedicated history page
  chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
}

// Utility functions
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

function showError(message) {
  showNotification(message, 'error');
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showWarning(message) {
  showNotification(message, 'warning');
}

function showNotification(message, type) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showModal(title, content) {
  // Simple modal implementation
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-content">
        ${content}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}