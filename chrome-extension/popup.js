/**
 * ProofVault Chrome Extension - Main Application Logic
 * 
 * Professional legal evidence capture system with comprehensive security,
 * validation, logging, and performance optimization.
 * 
 * @fileoverview Main popup application controller
 * @version 1.0.0
 * @author ProofVault Legal Technology
 * @since 2025-07-26
 * 
 * @requires ScreenshotCapture - Optimized screenshot capture utility
 * @requires PdfGenerator - Professional PDF generation with legal metadata
 * @requires InputValidator - Comprehensive input validation and sanitization
 * @requires ApiClient - Secure API communication with retry logic
 * @requires SecurityManager - Security monitoring and enforcement
 * @requires Logger - Comprehensive logging and performance tracking
 */

console.log('[POPUP] Script loading started');
alert('[DEBUG] PopupJS script is loading!');

document.addEventListener('DOMContentLoaded', function() {
    alert('[DEBUG] DOM content loaded!');
    console.log('[POPUP] DOM content loaded');
    // Element references
    const companyInput = document.getElementById('company');
    const userInput = document.getElementById('user');
    const vaultBtn = document.getElementById('vaultBtn');
    const evidenceForm = document.getElementById('evidenceForm');
    
    // Section references
    const captureSection = document.getElementById('captureSection');
    const statusSection = document.getElementById('statusSection');
    const resultSection = document.getElementById('resultSection');
    
    // Status elements
    const statusCard = document.getElementById('statusCard');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');
    const progressFill = document.getElementById('progressFill');
    
    // Result elements
    const generatedIdSpan = document.getElementById('generatedId');
    const captureTimestamp = document.getElementById('captureTimestamp');
    const downloadBtn = document.getElementById('downloadBtn');
    const viewOnlineBtn = document.getElementById('viewOnlineBtn');
    const captureAnotherBtn = document.getElementById('captureAnotherBtn');
    
    // Error handling elements
    const companyError = document.getElementById('company-error');
    const userError = document.getElementById('user-error');
    
    // Application state
    /** @type {Blob|null} Current PDF blob for download */
    let currentPdfBlob = null;
    
    /** @type {string|null} Current evidence ID */
    let currentId = null;
    
    /** @type {ApiClient} Secure API client instance */
    console.log('[POPUP] Creating API client');
    let apiClient = new ApiClient();
    console.log('[POPUP] API client created:', apiClient);
    
    /** @type {ScreenshotCapture} Optimized screenshot capture utility */
    let screenshotCapture = new ScreenshotCapture();
    
    /** @type {PdfGenerator} Professional PDF generation engine */
    let pdfGenerator = new PdfGenerator();
    
    /** @type {InputValidator} Comprehensive input validation system */
    let validator = new InputValidator();
    
    /** @type {boolean} Processing state flag */
    let isProcessing = false;

    // Initialize application
    loadSavedData();
    setupEventListeners();

    /**
     * Set up event listeners for UI interactions
     * Initializes form submission, button clicks, and input validation
     */
    function setupEventListeners() {
        evidenceForm.addEventListener('submit', handleFormSubmit);
        vaultBtn.addEventListener('click', handleVaultClick);
        downloadBtn.addEventListener('click', downloadPdf);
        viewOnlineBtn.addEventListener('click', viewOnline);
        captureAnotherBtn.addEventListener('click', resetToCapture);

        companyInput.addEventListener('input', handleInputChange);
        userInput.addEventListener('input', handleInputChange);
        companyInput.addEventListener('blur', validateField);
        userInput.addEventListener('blur', validateField);
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        if (!isProcessing) {
            handleVaultClick();
        }
    }

    function handleInputChange(e) {
        clearFieldError(e.target);
        saveData();
        updateButtonState();
    }

    /**
     * Validate form field with comprehensive security checks
     * 
     * @param {Event} e - Input field blur/change event
     * @returns {boolean} True if validation passes, false otherwise
     */
    function validateField(e) {
        const field = e.target;
        const value = field.value.trim();
        
        try {
            let validationResult;
            
            if (field.id === 'company') {
                validationResult = validator.validateOrganizationName(value);
            } else if (field.id === 'user') {
                validationResult = validator.validateUserName(value);
            } else {
                // Fallback validation
                validationResult = {
                    isValid: value.length >= 2,
                    errors: value.length < 2 ? ['Must be at least 2 characters'] : []
                };
            }
            
            if (!validationResult.isValid) {
                showFieldError(field, validationResult.errors[0] || 'Invalid input');
                return false;
            }
            
            clearFieldError(field);
            return true;
            
        } catch (error) {
            console.error('Field validation failed:', error);
            showFieldError(field, 'Validation error occurred');
            return false;
        }
    }

    function showFieldError(field, message) {
        const errorElement = document.getElementById(field.id + '-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
            field.style.borderColor = 'var(--color-error)';
        }
    }

    function clearFieldError(field) {
        const errorElement = document.getElementById(field.id + '-error');
        if (errorElement) {
            errorElement.classList.remove('show');
            field.style.borderColor = '';
        }
    }

    function updateButtonState() {
        const company = companyInput.value.trim();
        const user = userInput.value.trim();
        const isValid = company && user && company.length >= 2 && user.length >= 2;
        
        vaultBtn.disabled = !isValid || isProcessing;
        
        if (isValid && !isProcessing) {
            vaultBtn.classList.remove('loading');
        }
    }

    function loadSavedData() {
        chrome.storage.local.get(['company', 'user'], function(result) {
            if (result.company) {
                companyInput.value = result.company;
            }
            if (result.user) {
                userInput.value = result.user;
            }
            updateButtonState();
        });
    }

    function saveData() {
        chrome.storage.local.set({
            company: companyInput.value,
            user: userInput.value
        });
    }

    function generateUniqueId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `PV_${timestamp}_${random}`;
    }

    function showStatus(message, type = 'loading', progress = 0) {
        // Hide other sections
        captureSection.classList.add('hide');
        resultSection.classList.remove('show');
        
        // Update status content
        statusTitle.textContent = getStatusTitle(type);
        statusMessage.textContent = message;
        progressFill.style.width = `${progress}%`;
        
        // Update status icon and card style
        statusCard.className = `status-card ${type}`;
        updateStatusIcon(type);
        
        // Show status section
        statusSection.classList.add('show');
        
        // Add loading state to button
        if (type === 'loading') {
            vaultBtn.classList.add('loading');
            isProcessing = true;
        }
    }

    function getStatusTitle(type) {
        switch (type) {
            case 'loading': return 'Processing Evidence...';
            case 'error': return 'Capture Failed';
            case 'success': return 'Evidence Captured';
            default: return 'Processing...';
        }
    }

    function updateStatusIcon(type) {
        const icons = {
            loading: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3V6M12 18V21M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M3 12H6M18 12H21M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                     <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
                     <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
                   </svg>`,
            success: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                     </svg>`
        };
        
        statusIcon.innerHTML = icons[type] || icons.loading;
    }

    function showResult(id) {
        // Hide other sections
        statusSection.classList.remove('show');
        captureSection.classList.add('hide');
        
        // Update result content
        generatedIdSpan.textContent = id;
        captureTimestamp.textContent = new Date().toLocaleString();
        
        // Show result section
        resultSection.classList.add('show');
        
        // Reset processing state
        isProcessing = false;
        vaultBtn.classList.remove('loading');
        updateButtonState();
    }

    function showError(message) {
        showStatus(message, 'error', 0);
        
        // Reset processing state after a delay
        setTimeout(() => {
            resetToCapture();
        }, 3000);
    }

    function resetToCapture() {
        // Hide other sections
        statusSection.classList.remove('show');
        resultSection.classList.remove('show');
        
        // Show capture section
        captureSection.classList.remove('hide');
        
        // Reset state
        isProcessing = false;
        vaultBtn.classList.remove('loading');
        currentPdfBlob = null;
        currentId = null;
        
        // Update button state
        updateButtonState();
        
        // Focus first input
        companyInput.focus();
    }

    /**
     * Main evidence capture workflow handler
     * 
     * Orchestrates the complete legal evidence capture process including:
     * - Form validation and sanitization
     * - Screenshot capture with optimization
     * - PDF generation with legal metadata
     * - Secure upload to ProofVault servers
     * - Comprehensive error handling and logging
     * 
     * @async
     * @function handleVaultClick
     * @returns {Promise<void>}
     * @throws {Error} Various errors for different failure modes
     */
    async function handleVaultClick() {
        console.log('[POPUP] Vault click handler started');
        const company = companyInput.value.trim();
        const user = userInput.value.trim();
        
        console.log('[POPUP] Form values:', { company, user });
        
        // Start overall evidence capture timer
        const captureTimer = logger.startTimer('evidence_capture_complete');
        let sanitizedData = null; // Declare outside try block for error handling
        
        try {
            logger.info('Evidence Capture Started', {
                company: company.substring(0, 20) + '...',
                user: user.substring(0, 20) + '...',
                url: window.location.href
            });
            
            // Comprehensive validation
            const validationTimer = logger.startTimer('form_validation');
            const tab = await getCurrentTab();
            const formValidation = validator.validateEvidenceForm({
                organization: company,
                user: user,
                url: tab.url,
                title: tab.title
            });
            logger.endTimer(validationTimer, { isValid: formValidation.isValid });

            if (!formValidation.isValid) {
                logger.error('Form Validation Failed', {
                    errors: formValidation.errors,
                    warnings: formValidation.warnings
                });
                
                // Show first error
                const firstError = formValidation.errors[0];
                showError(`Validation failed: ${firstError}`);
                
                // Focus appropriate field
                if (formValidation.results.organization && !formValidation.results.organization.isValid) {
                    companyInput.focus();
                } else if (formValidation.results.user && !formValidation.results.user.isValid) {
                    userInput.focus();
                }
                
                logger.logEvidenceCapture('validation', { errors: formValidation.errors }, false);
                return;
            }

            logger.logEvidenceCapture('validation', { 
                sanitizedFields: Object.keys(formValidation.sanitized) 
            }, true);

            // Use sanitized values
            sanitizedData = formValidation.sanitized;
            
            isProcessing = true;
            updateButtonState();
            
            // Step 1: Check API health
            logger.logEvidenceCapture('api_health_check_start');
            showStatus('Connecting to ProofVault servers...', 'loading', 10);
            const healthTimer = logger.startTimer('api_health_check');
            await apiClient.checkHealth();
            logger.endTimer(healthTimer);
            logger.logEvidenceCapture('api_health_check_complete', {}, true);
            await delay(500); // UX delay for better feedback
            
            // Step 2: Generate ID and prepare
            showStatus('Preparing evidence capture...', 'loading', 25);
            const id = generateUniqueId();
            currentId = id;
            logger.logEvidenceCapture('id_generation', { evidenceId: id }, true);
            await delay(300);

            // Step 3: Capture screenshot
            logger.logEvidenceCapture('screenshot_capture_start');
            showStatus('Capturing webpage screenshot...', 'loading', 40);
            const screenshotTimer = logger.startTimer('screenshot_capture');
            const screenshotDataUrl = await captureScreenshot(tab);
            logger.endTimer(screenshotTimer, { 
                dataUrlSize: screenshotDataUrl.length,
                tabUrl: tab.url,
                tabTitle: tab.title
            });
            logger.logEvidenceCapture('screenshot_capture_complete', {
                screenshotSize: Math.round(screenshotDataUrl.length / 1024) + 'KB'
            }, true);
            await delay(500);
            
            // Step 4: Generate PDF with sanitized data
            logger.logEvidenceCapture('pdf_generation_start');
            showStatus('Generating authenticated PDF document...', 'loading', 65);
            const pdfTimer = logger.startTimer('pdf_generation');
            const pdfBlob = await generatePdf(
                sanitizedData.organization, 
                sanitizedData.user, 
                id, 
                screenshotDataUrl, 
                sanitizedData.url, 
                sanitizedData.title
            );
            logger.endTimer(pdfTimer, { 
                pdfSize: pdfBlob.size,
                pdfType: pdfBlob.type
            });
            
            // Validate generated PDF
            const pdfValidationTimer = logger.startTimer('pdf_validation');
            const pdfValidation = validator.validatePdfBlob(pdfBlob);
            logger.endTimer(pdfValidationTimer, { isValid: pdfValidation.isValid });
            
            if (!pdfValidation.isValid) {
                logger.error('PDF Validation Failed', {
                    errors: pdfValidation.errors,
                    pdfSize: pdfBlob.size,
                    pdfType: pdfBlob.type
                });
                throw new Error(`PDF validation failed: ${pdfValidation.errors[0]}`);
            }
            
            logger.logEvidenceCapture('pdf_generation_complete', {
                pdfSize: Math.round(pdfBlob.size / 1024) + 'KB',
                validationWarnings: pdfValidation.warnings
            }, true);
            
            currentPdfBlob = pdfBlob;
            await delay(500);

            // Step 5: Upload to server with sanitized metadata
            logger.logEvidenceCapture('upload_start');
            showStatus('Uploading to ProofVault secure storage...', 'loading', 85);
            const uploadTimer = logger.startTimer('api_upload');
            const uploadResponse = await apiClient.uploadPdf(pdfBlob, {
                id: id,
                company: sanitizedData.organization,
                user: sanitizedData.user
            });
            logger.endTimer(uploadTimer, {
                success: uploadResponse.success,
                responseId: uploadResponse.data?.id
            });

            if (uploadResponse.success) {
                logger.logEvidenceCapture('upload_complete', {
                    serverId: uploadResponse.data.id,
                    originalId: id
                }, true);
                
                showStatus('Evidence successfully captured and verified', 'loading', 100);
                await delay(800);
                showResult(uploadResponse.data.id);
                currentId = uploadResponse.data.id;
                
                // Log successful completion
                logger.endTimer(captureTimer, {
                    evidenceId: uploadResponse.data.id,
                    finalStep: 'complete'
                });
                logger.info('Evidence Capture Completed Successfully', {
                    evidenceId: uploadResponse.data.id,
                    totalTime: captureTimer.duration || 'unknown'
                });
            } else {
                throw new Error('Upload failed: ' + uploadResponse.message);
            }

        } catch (error) {
            // Log comprehensive error information
            logger.endTimer(captureTimer, {
                success: false,
                error: error.message,
                errorType: error.name || 'Unknown'
            });
            
            logger.error('Evidence Capture Failed', {
                error: error.message,
                stack: error.stack,
                step: 'evidence_capture',
                evidenceId: currentId,
                company: sanitizedData?.organization || company,
                user: sanitizedData?.user || user,
                errorType: categorizeError(error)
            });
            
            logger.logEvidenceCapture('capture_failed', {
                error: error.message,
                errorCategory: categorizeError(error)
            }, false);
            
            let errorMessage = 'An unexpected error occurred during evidence capture.';
            
            if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('timeout')) {
                errorMessage = 'Cannot connect to ProofVault servers. Please check your internet connection and try again.';
                logger.warn('Network Connectivity Issue', { originalError: error.message });
            } else if (error.message.includes('screenshot') || error.message.includes('captureVisibleTab')) {
                errorMessage = 'Unable to capture webpage screenshot. Please ensure the page is fully loaded and try again.';
                logger.warn('Screenshot Capture Issue', { 
                    originalError: error.message,
                    tabUrl: tab?.url,
                    tabStatus: tab?.status
                });
            } else if (error.message.includes('PDF') || error.message.includes('jsPDF')) {
                errorMessage = 'Failed to generate PDF document. Please try again.';
                logger.warn('PDF Generation Issue', { 
                    originalError: error.message,
                    pdfBlobExists: !!currentPdfBlob
                });
            } else if (error.message.includes('Upload failed')) {
                errorMessage = error.message;
                logger.warn('Upload Issue', { originalError: error.message });
            } else if (error.message.includes('validation')) {
                errorMessage = error.message;
                logger.warn('Validation Issue', { originalError: error.message });
            }
            
            showError(errorMessage);
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    function categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
            return 'network';
        } else if (message.includes('screenshot') || message.includes('capture')) {
            return 'screenshot';
        } else if (message.includes('pdf') || message.includes('generation')) {
            return 'pdf';
        } else if (message.includes('validation')) {
            return 'validation';
        } else if (message.includes('upload')) {
            return 'upload';
        } else if (message.includes('permission') || message.includes('access')) {
            return 'permission';
        } else {
            return 'unknown';
        }
    }

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    /**
     * Capture screenshot with browser-specific optimizations
     * 
     * @param {Object} tab - Chrome tab object
     * @returns {Promise<string>} Screenshot data URL
     */
    async function captureScreenshot(tab) {
        try {
            // Get browser-specific screenshot options
            const browserOptions = browserCompatibility.getScreenshotOptions();
            
            // Try full page capture first
            const result = await screenshotCapture.captureFullPage(tab, {
                ...browserOptions,
                maxWidth: 1920,
                maxHeight: 10800,
                format: 'png',
                quality: 95
            });
            
            console.log('Full page screenshot captured with metadata:', result.metadata);
            return result.dataUrl;
        } catch (error) {
            console.error('Full page capture failed, trying visible area:', error);
            
            try {
                // Fallback to visible area capture
                const result = await screenshotCapture.captureScreenshot(tab, {
                    ...browserOptions,
                    maxWidth: 1920,
                    maxHeight: 10800
                });
                
                console.log('Visible area screenshot captured with metadata:', result.metadata);
                return result.dataUrl;
            } catch (fallbackError) {
                console.error('Enhanced screenshot capture failed:', fallbackError);
                
                // Final fallback to basic capture
                return new Promise((resolve, reject) => {
                    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, function(dataUrl) {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(dataUrl);
                        }
                    });
                });
            }
        }
    }

    /**
     * Generate PDF with browser-specific optimizations
     * 
     * @param {string} company - Organization name
     * @param {string} user - User name  
     * @param {string} id - Evidence ID
     * @param {string} screenshotDataUrl - Screenshot data URL
     * @param {string} url - Page URL
     * @param {string} title - Page title
     * @returns {Promise<Blob>} Generated PDF blob
     */
    async function generatePdf(company, user, id, screenshotDataUrl, url, title) {
        try {
            console.log('Starting optimized PDF generation...');
            
            // Get browser-specific PDF options
            const browserOptions = browserCompatibility.getPdfOptions();
            
            const result = await pdfGenerator.generatePdf(
                company, 
                user, 
                id, 
                screenshotDataUrl, 
                url, 
                title,
                {
                    ...browserOptions,
                    maxImageWidth: 170, // mm
                    maxImageHeight: 240 // mm
                }
            );
            
            console.log('PDF generated with metadata:', result.metadata);
            return result.blob;
            
        } catch (error) {
            console.error('Optimized PDF generation failed:', error);
            
            // Fallback to basic PDF generation
            return new Promise((resolve, reject) => {
                try {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();

                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 20;

                    doc.setFontSize(20);
                    doc.text('ProofVault - Evidence Report', margin, 30);

                    doc.setFontSize(12);
                    let yPos = 50;

                    doc.text(`Company: ${company}`, margin, yPos);
                    yPos += 10;
                    doc.text(`User: ${user}`, margin, yPos);
                    yPos += 10;
                    doc.text(`ID: ${id}`, margin, yPos);
                    yPos += 10;
                    doc.text(`Date: ${new Date().toLocaleString()}`, margin, yPos);
                    yPos += 10;
                    doc.text(`URL: ${url}`, margin, yPos);
                    yPos += 10;
                    doc.text(`Page Title: ${title}`, margin, yPos);
                    yPos += 20;

                    doc.text('Screenshot:', margin, yPos);
                    yPos += 10;

                    const img = new Image();
                    img.onload = function() {
                        // Calculate image dimensions maintaining aspect ratio
                        const availableWidth = pageWidth - (margin * 2);
                        const availableHeight = doc.internal.pageSize.getHeight() - yPos - margin;
                        
                        // Calculate scale to fit within available space
                        const widthScale = availableWidth / img.width;
                        const heightScale = availableHeight / img.height;
                        const scale = Math.min(widthScale, heightScale);
                        
                        const imgWidth = img.width * scale;
                        const imgHeight = img.height * scale;

                        if (yPos + imgHeight > doc.internal.pageSize.getHeight() - margin) {
                            doc.addPage();
                            yPos = margin;
                        }

                        doc.addImage(screenshotDataUrl, 'PNG', margin, yPos, imgWidth, imgHeight);

                        const pdfOutput = doc.output('blob');
                        resolve(pdfOutput);
                    };
                    img.onerror = function() {
                        reject(new Error('Failed to load screenshot image'));
                    };
                    img.src = screenshotDataUrl;

                } catch (fallbackError) {
                    reject(fallbackError);
                }
            });
        }
    }

    async function downloadPdf() {
        if (!currentId) {
            showError('No evidence record available for download');
            return;
        }

        try {
            // Disable download button temporarily
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = `
                <svg class="button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3V6M12 18V21M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M3 12H6M18 12H21M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Downloading...
            `;

            const pdfBlob = await apiClient.getPdf(currentId, true);
            
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ProofVault_Evidence_${currentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Reset download button
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `
                <svg class="button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 10L12 15M12 15L17 10M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Download PDF
            `;
            
        } catch (error) {
            console.error('Download error:', error);
            
            // Reset download button
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `
                <svg class="button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 10L12 15M12 15L17 10M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Download PDF
            `;
            
            showError('Failed to download evidence PDF: ' + error.message);
        }
    }

    function viewOnline() {
        if (currentId) {
            const viewUrl = `http://proofvault.net:3002/?search=${currentId}`;
            chrome.tabs.create({ url: viewUrl });
        } else {
            showError('No evidence record available to view online');
        }
    }
});