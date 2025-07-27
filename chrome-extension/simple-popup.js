// ProofVault Extension - Full Functionality
console.log('[PROOFVAULT] Extension loading...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('[PROOFVAULT] DOM loaded');
    
    // Get UI elements
    const vaultBtn = document.getElementById('vaultBtn');
    const companyInput = document.getElementById('company');
    const userInput = document.getElementById('user');
    const captureSection = document.getElementById('captureSection');
    const statusSection = document.getElementById('statusSection');
    const resultSection = document.getElementById('resultSection');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');
    const progressFill = document.getElementById('progressFill');
    const generatedIdSpan = document.getElementById('generatedId');
    const captureTimestamp = document.getElementById('captureTimestamp');
    const downloadBtn = document.getElementById('downloadBtn');
    const viewOnlineBtn = document.getElementById('viewOnlineBtn');
    const captureAnotherBtn = document.getElementById('captureAnotherBtn');
    
    let currentPdfBlob = null;
    let currentId = null;
    
    // Set up event listeners
    if (vaultBtn) {
        vaultBtn.addEventListener('click', handleCaptureClick);
    }
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }
    if (viewOnlineBtn) {
        viewOnlineBtn.addEventListener('click', handleViewOnline);
    }
    if (captureAnotherBtn) {
        captureAnotherBtn.addEventListener('click', handleCaptureAnother);
    }
    
    async function handleCaptureClick(e) {
        e.preventDefault();
        
        const company = companyInput.value.trim();
        const user = userInput.value.trim();
        
        // Clear previous errors
        clearFieldErrors();
        
        // Validate inputs
        const validation = validateInputs(company, user);
        if (!validation.isValid) {
            showFieldErrors(validation.errors);
            return;
        }
        
        // Disable button and show loading state
        setButtonLoading(true);
        
        console.log('[PROOFVAULT] Starting capture process', { company, user });
        
        try {
            // Show status
            showStatus('Starting evidence capture...', 10);
            
            // Step 1: Check API health
            showStatus('Connecting to ProofVault servers...', 20);
            const healthUrl = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.HEALTH;
            console.log('[PROOFVAULT] Testing API health at:', healthUrl);
            const healthResponse = await fetchWithTimeout(healthUrl, {}, 10000);
            console.log('[PROOFVAULT] Health response:', healthResponse.status, healthResponse.statusText);
            if (!healthResponse.ok) {
                throw new Error('Cannot connect to ProofVault servers');
            }
            
            // Step 2: Capture screenshot
            showStatus('Capturing webpage screenshot...', 40);
            console.log('[PROOFVAULT] Starting screenshot capture...');
            const screenshotDataUrl = await captureScreenshot();
            console.log('[PROOFVAULT] Screenshot captured, data URL length:', screenshotDataUrl ? screenshotDataUrl.length : 'null');
            
            // Step 3: Generate PDF
            showStatus('Generating PDF evidence document...', 60);
            console.log('[PROOFVAULT] Starting PDF generation...');
            const pdfBlob = await generatePdf(company, user, screenshotDataUrl);
            console.log('[PROOFVAULT] PDF generated, blob size:', pdfBlob ? pdfBlob.size : 'null');
            currentPdfBlob = pdfBlob;
            
            // Step 4: Upload to server
            showStatus('Uploading to secure storage...', 80);
            console.log('[PROOFVAULT] Starting PDF upload...');
            const uploadResult = await uploadPdf(pdfBlob, company, user);
            console.log('[PROOFVAULT] Upload result:', uploadResult);
            currentId = uploadResult.data.id;
            
            // Step 5: Save to local storage and show success
            showStatus('Saving capture history...', 90);
            await saveCaptureToHistory(uploadResult.data, company, user);
            
            showStatus('Evidence successfully captured!', 100);
            setTimeout(() => {
                showResult(uploadResult.data);
            }, 1000);
            
        } catch (error) {
            console.error('[PROOFVAULT] Capture failed:', error);
            console.error('[PROOFVAULT] Error type:', typeof error);
            console.error('[PROOFVAULT] Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                error: error.error,
                statusText: error.statusText
            });
            
            
            const errorMessage = getDetailedErrorMessage(error);
            console.error('[PROOFVAULT] Processed error message:', errorMessage);
            showError(errorMessage);
        } finally {
            setButtonLoading(false);
        }
    }
    
    async function captureScreenshot() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (chrome.runtime.lastError) {
                    reject(new Error('Failed to get active tab'));
                    return;
                }
                
                chrome.tabs.captureVisibleTab(null, { format: 'png' }, function(dataUrl) {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Failed to capture screenshot: ' + chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(dataUrl);
                });
            });
        });
    }
    
    async function generatePdf(company, user, screenshotDataUrl) {
        try {
            if (!window.jspdf) {
                throw new Error('PDF library not loaded');
            }
            
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                throw new Error('jsPDF not available');
            }
            
            const doc = new jsPDF();
            
            // Sanitize inputs for PDF
            const sanitizedCompany = sanitizeForPdf(company);
            const sanitizedUser = sanitizeForPdf(user);
            const currentUrl = await getCurrentUrl();
            const timestamp = new Date().toISOString();
            
            // Add title
            doc.setFontSize(16);
            doc.text('ProofVault Evidence Report', 20, 20);
            
            // Add metadata with enhanced details
            doc.setFontSize(12);
            doc.text(`Company: ${sanitizedCompany}`, 20, 35);
            doc.text(`User: ${sanitizedUser}`, 20, 45);
            doc.text(`Timestamp: ${timestamp}`, 20, 55);
            doc.text(`URL: ${currentUrl}`, 20, 65);
            
            // Add additional metadata
            const pageTitle = await getCurrentPageTitle();
            const userAgent = navigator.userAgent;
            const windowSize = await getWindowSize();
            
            doc.text(`Page Title: ${pageTitle}`, 20, 75);
            doc.text(`Browser: ${getBrowserInfo(userAgent)}`, 20, 85);
            doc.text(`Window Size: ${windowSize.width}x${windowSize.height}`, 20, 95);
            doc.text(`IP Hash: ${await getIpHash()}`, 20, 105);
            
            // Add screenshot with error handling (adjust position for more metadata)
            if (screenshotDataUrl && screenshotDataUrl.startsWith('data:image/')) {
                try {
                    doc.addImage(screenshotDataUrl, 'PNG', 20, 120, 170, 100);
                } catch (imageError) {
                    console.warn('[PROOFVAULT] Failed to add image to PDF:', imageError);
                    doc.text('Screenshot could not be embedded', 20, 130);
                }
            } else {
                doc.text('No screenshot available', 20, 130);
            }
            
            // Add footer with verification info
            doc.setFontSize(10);
            doc.text('Generated by ProofVault Legal Evidence System', 20, 280);
            doc.text(`Evidence ID will be assigned upon upload`, 20, 290);
            
            const blob = doc.output('blob');
            
            // Validate blob size
            if (blob.size > 10 * 1024 * 1024) { // 10MB limit
                throw new Error('Generated PDF is too large');
            }
            
            return blob;
        } catch (error) {
            console.error('[PROOFVAULT] PDF generation failed:', error);
            throw new Error(`Failed to generate PDF: ${error.message}`);
        }
    }
    
    function sanitizeForPdf(text) {
        if (!text) return '';
        // Remove control characters and ensure safe text for PDF
        return text.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 100);
    }
    
    async function getCurrentUrl() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                resolve(tabs[0]?.url || 'Unknown');
            });
        });
    }
    
    async function getCurrentPageTitle() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                resolve(tabs[0]?.title || 'Unknown');
            });
        });
    }
    
    async function getWindowSize() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        return { width: window.innerWidth, height: window.innerHeight };
                    }
                });
                return results[0]?.result || { width: 'Unknown', height: 'Unknown' };
            }
        } catch (error) {
            console.warn('[PROOFVAULT] Failed to get window size:', error);
        }
        return { width: 'Unknown', height: 'Unknown' };
    }
    
    function getBrowserInfo(userAgent) {
        if (userAgent.includes('Chrome')) {
            const version = userAgent.match(/Chrome\/(\d+)/);
            return `Chrome ${version ? version[1] : 'Unknown'}`;
        } else if (userAgent.includes('Firefox')) {
            const version = userAgent.match(/Firefox\/(\d+)/);
            return `Firefox ${version ? version[1] : 'Unknown'}`;
        } else if (userAgent.includes('Safari')) {
            const version = userAgent.match(/Version\/(\d+)/);
            return `Safari ${version ? version[1] : 'Unknown'}`;
        } else if (userAgent.includes('Edge')) {
            const version = userAgent.match(/Edge\/(\d+)/);
            return `Edge ${version ? version[1] : 'Unknown'}`;
        }
        return 'Unknown Browser';
    }
    
    async function getIpHash() {
        try {
            // Get a simple hash of timestamp + user agent for privacy-preserving identification
            const data = new Date().toISOString() + navigator.userAgent;
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex.substring(0, 16); // Return first 16 characters for brevity
        } catch (error) {
            console.warn('[PROOFVAULT] Failed to generate hash:', error);
            return 'Not available';
        }
    }
    
    async function uploadPdf(pdfBlob, company, user) {
        try {
            
            // Validate inputs
            if (!pdfBlob || pdfBlob.size === 0) {
                throw new Error('Invalid PDF data');
            }
            
            if (pdfBlob.size > 10 * 1024 * 1024) { // 10MB limit
                throw new Error('PDF file is too large (max 10MB)');
            }
            
            const formData = new FormData();
            formData.append('pdf', pdfBlob, `ProofVault_${Date.now()}.pdf`);
            formData.append('company_name', sanitizeForPdf(company));
            formData.append('username', sanitizeForPdf(user));
            
            const uploadUrl = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.UPLOAD_PDF;
            console.log('[PROOFVAULT] Uploading to:', uploadUrl);
            
            const response = await fetchWithRetry(uploadUrl, {
                method: 'POST',
                body: formData
            }, 3);
            
        
        if (!response.ok) {
            let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
            
            try {
                const responseText = await response.text();
                
                // Try to parse as JSON
                const errorData = JSON.parse(responseText);
                if (errorData.error) {
                    errorMessage = errorData.error;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                // If can't parse as JSON, use the raw text
                // errorMessage already set to default above
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Validate response
        if (!result || !result.data || !result.data.id) {
            throw new Error('Invalid response from server');
        }
        
        return result;
        } catch (error) {
            throw error;
        }
    }
    
    function showStatus(message, progress) {
        captureSection.style.display = 'none';
        resultSection.style.display = 'none';
        statusSection.style.display = 'block';
        
        statusTitle.textContent = 'Processing Evidence...';
        statusMessage.textContent = message;
        progressFill.style.width = progress + '%';
    }
    
    function showError(message) {
        captureSection.style.display = 'block';
        statusSection.style.display = 'none';
        resultSection.style.display = 'none';
        
        // Show error with better UI instead of alert
        showErrorMessage(message);
    }
    
    function showErrorMessage(message) {
        // Create or update error notification
        let errorDiv = document.getElementById('errorNotification');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'errorNotification';
            errorDiv.className = 'error-notification';
            document.querySelector('.app-container').appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <div class="error-content">
                <svg class="error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="error-text">
                    <h4>Capture Failed</h4>
                    <p>${message}</p>
                </div>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        errorDiv.style.display = 'block';
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 8000);
    }
    
    function setButtonLoading(loading) {
        const button = vaultBtn;
        const buttonText = button.querySelector('.button-text');
        const buttonSpinner = button.querySelector('.button-spinner');
        
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            buttonText.textContent = 'Processing...';
            if (buttonSpinner) {
                buttonSpinner.style.display = 'block';
            }
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            buttonText.textContent = 'Capture Evidence';
            if (buttonSpinner) {
                buttonSpinner.style.display = 'none';
            }
        }
    }
    
    function showResult(data) {
        captureSection.style.display = 'none';
        statusSection.style.display = 'none';
        resultSection.style.display = 'block';
        
        generatedIdSpan.textContent = data.id;
        captureTimestamp.textContent = new Date().toLocaleString();
    }
    
    function handleDownload() {
        if (currentPdfBlob) {
            const url = URL.createObjectURL(currentPdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ProofVault_${currentId || Date.now()}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    
    function handleViewOnline() {
        if (currentId) {
            const frontendUrl = `http://proofvault.net:3002`;
            chrome.tabs.create({ url: frontendUrl });
        }
    }
    
    function handleCaptureAnother() {
        captureSection.style.display = 'block';
        statusSection.style.display = 'none';
        resultSection.style.display = 'none';
        
        companyInput.value = '';
        userInput.value = '';
        currentPdfBlob = null;
        currentId = null;
        clearFieldErrors();
    }
    
    // Validation functions
    function validateInputs(company, user) {
        const errors = [];
        
        if (!company) {
            errors.push({ field: 'company', message: 'Organization name is required' });
        } else if (company.length < 2) {
            errors.push({ field: 'company', message: 'Organization name must be at least 2 characters' });
        } else if (company.length > 100) {
            errors.push({ field: 'company', message: 'Organization name must be less than 100 characters' });
        } else if (!/^[a-zA-Z0-9\s\-_&.]+$/.test(company)) {
            errors.push({ field: 'company', message: 'Organization name contains invalid characters' });
        }
        
        if (!user) {
            errors.push({ field: 'user', message: 'User name is required' });
        } else if (user.length < 2) {
            errors.push({ field: 'user', message: 'User name must be at least 2 characters' });
        } else if (user.length > 50) {
            errors.push({ field: 'user', message: 'User name must be less than 50 characters' });
        } else if (!/^[a-zA-Z0-9\s\-_.@]+$/.test(user)) {
            errors.push({ field: 'user', message: 'User name contains invalid characters' });
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    function clearFieldErrors() {
        const companyError = document.getElementById('company-error');
        const userError = document.getElementById('user-error');
        
        if (companyError) {
            companyError.textContent = '';
            companyError.style.display = 'none';
        }
        if (userError) {
            userError.textContent = '';
            userError.style.display = 'none';
        }
        
        // Remove error styling
        companyInput.classList.remove('error');
        userInput.classList.remove('error');
    }
    
    function showFieldErrors(errors) {
        errors.forEach(error => {
            const errorElement = document.getElementById(`${error.field}-error`);
            const inputElement = document.getElementById(error.field);
            
            if (errorElement) {
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
            }
            if (inputElement) {
                inputElement.classList.add('error');
            }
        });
    }
    
    function getDetailedErrorMessage(error) {
        if (!error) return 'An unknown error occurred';
        
        // Handle different types of error objects
        let message = '';
        
        if (typeof error === 'string') {
            message = error;
        } else if (error.message) {
            message = error.message;
        } else if (error.error) {
            message = error.error;
        } else if (error.statusText) {
            message = error.statusText;
        } else if (error.toString && typeof error.toString === 'function') {
            message = error.toString();
        } else {
            // Last resort: try to extract meaningful info from object
            try {
                message = JSON.stringify(error);
            } catch (e) {
                message = 'Unknown error occurred';
            }
        }
        
        // If we still have [object Object], try to get more details
        if (message === '[object Object]' || message.includes('[object Object]')) {
            if (error.name) {
                message = `${error.name}: ${error.message || 'Unknown error'}`;
            } else {
                message = 'Unknown error occurred - please check browser console for details';
            }
        }
        
        // Network errors
        if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            return 'Unable to connect to ProofVault servers. Please check your internet connection and try again.';
        }
        
        // Screenshot errors
        if (message.includes('Failed to capture screenshot')) {
            return 'Failed to capture screenshot. Please ensure the tab is active and try again.';
        }
        
        if (message.includes('Failed to get active tab')) {
            return 'Unable to access the current tab. Please refresh the page and try again.';
        }
        
        // Upload errors
        if (message.includes('Upload failed: 413')) {
            return 'The generated PDF is too large to upload. Please try capturing a smaller area.';
        }
        
        if (message.includes('Upload failed: 400')) {
            return 'Invalid data provided. Please check your inputs and try again.';
        }
        
        if (message.includes('Upload failed: 500')) {
            return 'Server error occurred. Please try again in a few moments.';
        }
        
        // PDF generation errors
        if (message.includes('jsPDF') || message.includes('PDF')) {
            return 'Failed to generate PDF document. Please try again.';
        }
        
        // API health errors
        if (message.includes('Cannot connect to ProofVault servers')) {
            return 'ProofVault servers are currently unavailable. Please try again later.';
        }
        
        // Permission errors
        if (message.includes('permission') || message.includes('Permission')) {
            return 'Missing required permissions. Please reload the extension and try again.';
        }
        
        // Default error message
        return `Error: ${message}`;
    }
    
    // Utility functions for network operations
    async function fetchWithTimeout(url, options = {}, timeout = 30000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await window.fetch.call(window, url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - please try again');
            }
            throw error;
        }
    }
    
    async function fetchWithRetry(url, options = {}, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[PROOFVAULT] API attempt ${attempt}/${maxRetries}`);
                
                const response = await fetchWithTimeout(url, options, 30000);
                return response;
            } catch (error) {
                lastError = error;
                console.warn(`[PROOFVAULT] Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.log(`[PROOFVAULT] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        
        throw lastError || new Error('All retry attempts failed');
    }
    
    // Storage and history functions
    async function saveCaptureToHistory(uploadData, company, user) {
        try {
            const historyEntry = {
                id: uploadData.id,
                company: company,
                user: user,
                timestamp: new Date().toISOString(),
                url: await getCurrentUrl(),
                pageTitle: await getCurrentPageTitle(),
                fileSize: uploadData.file_size || 'Unknown',
                fileName: uploadData.filename || 'Unknown'
            };
            
            // Get existing history
            const result = await chrome.storage.local.get(['captureHistory']);
            const history = result.captureHistory || [];
            
            // Add new entry (keep last 50 entries)
            history.unshift(historyEntry);
            if (history.length > 50) {
                history.splice(50);
            }
            
            // Save back to storage
            await chrome.storage.local.set({ captureHistory: history });
            console.log('[PROOFVAULT] Saved capture to history:', historyEntry);
        } catch (error) {
            console.warn('[PROOFVAULT] Failed to save to history:', error);
            // Don't throw error - this is not critical for the main workflow
        }
    }
    
    async function getCaptureHistory() {
        try {
            const result = await chrome.storage.local.get(['captureHistory']);
            return result.captureHistory || [];
        } catch (error) {
            console.warn('[PROOFVAULT] Failed to get capture history:', error);
            return [];
        }
    }
    
    async function clearCaptureHistory() {
        try {
            await chrome.storage.local.remove(['captureHistory']);
            console.log('[PROOFVAULT] Cleared capture history');
        } catch (error) {
            console.warn('[PROOFVAULT] Failed to clear history:', error);
        }
    }
});