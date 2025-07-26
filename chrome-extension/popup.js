document.addEventListener('DOMContentLoaded', function() {
    const companyInput = document.getElementById('company');
    const userInput = document.getElementById('user');
    const vaultBtn = document.getElementById('vaultBtn');
    const statusDiv = document.getElementById('status');
    const resultDiv = document.getElementById('result');
    const generatedIdSpan = document.getElementById('generatedId');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentPdfBlob = null;
    let currentId = null;

    loadSavedData();

    vaultBtn.addEventListener('click', handleVaultClick);
    downloadBtn.addEventListener('click', downloadPdf);

    companyInput.addEventListener('input', saveData);
    userInput.addEventListener('input', saveData);

    function loadSavedData() {
        chrome.storage.local.get(['company', 'user'], function(result) {
            if (result.company) companyInput.value = result.company;
            if (result.user) userInput.value = result.user;
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

    function showStatus(message, type = '') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.classList.remove('hidden');
        resultDiv.classList.add('hidden');
    }

    function showResult(id) {
        statusDiv.classList.add('hidden');
        generatedIdSpan.textContent = id;
        resultDiv.classList.remove('hidden');
    }

    function showError(message) {
        showStatus(message, 'error');
    }

    async function handleVaultClick() {
        const company = companyInput.value.trim();
        const user = userInput.value.trim();

        if (!company || !user) {
            showError('Please fill in both Company and User fields');
            return;
        }

        try {
            vaultBtn.disabled = true;
            showStatus('Taking screenshot...', 'loading');

            const id = generateUniqueId();
            currentId = id;

            const tab = await getCurrentTab();
            const screenshotDataUrl = await captureScreenshot(tab);
            
            showStatus('Generating PDF...', 'loading');
            
            const pdfBlob = await generatePdf(company, user, id, screenshotDataUrl, tab.url, tab.title);
            currentPdfBlob = pdfBlob;

            showResult(id);

        } catch (error) {
            console.error('Error:', error);
            showError('Failed to create PDF: ' + error.message);
        } finally {
            vaultBtn.disabled = false;
        }
    }

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    async function captureScreenshot(tab) {
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

    async function generatePdf(company, user, id, screenshotDataUrl, url, title) {
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
                    const imgWidth = pageWidth - (margin * 2);
                    const imgHeight = (img.height * imgWidth) / img.width;

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

            } catch (error) {
                reject(error);
            }
        });
    }

    function downloadPdf() {
        if (currentPdfBlob && currentId) {
            const url = URL.createObjectURL(currentPdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ProofVault_${currentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
});