// PDF Generation utility for ProofVault
import jsPDF from 'jspdf';

export async function generatePDFFromTab(screenshotDataUrl, metadata) {
  return new Promise((resolve, reject) => {
    try {
      // Create new PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Load screenshot as image
      const img = new Image();
      img.onload = function() {
        // Calculate dimensions to fit A4
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = pageHeight - (2 * margin) - 40; // Leave space for header
        
        // Calculate scaling
        const imgWidth = img.width;
        const imgHeight = img.height;
        const widthRatio = maxWidth / imgWidth;
        const heightRatio = maxHeight / imgHeight;
        const scale = Math.min(widthRatio, heightRatio, 1); // Don't upscale
        
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        
        // Add header with metadata
        pdf.setFontSize(16);
        pdf.setTextColor(33, 33, 33);
        pdf.text('ProofVault Evidence Certificate', pageWidth / 2, 15, { align: 'center' });
        
        pdf.setFontSize(10);
        pdf.setTextColor(66, 66, 66);
        pdf.text(`URL: ${truncateText(metadata.url, 80)}`, margin, 25);
        pdf.text(`Title: ${truncateText(metadata.title, 80)}`, margin, 30);
        pdf.text(`Captured: ${new Date(metadata.timestamp).toLocaleString()}`, margin, 35);
        
        // Add separator line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, 38, pageWidth - margin, 38);
        
        // Add screenshot
        const xPos = (pageWidth - scaledWidth) / 2;
        const yPos = 45;
        pdf.addImage(screenshotDataUrl, 'PNG', xPos, yPos, scaledWidth, scaledHeight);
        
        // Add footer with additional info
        const footerY = pageHeight - 15;
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text('This PDF is prepared for blockchain registration', pageWidth / 2, footerY, { align: 'center' });
        pdf.text(`ProofVault Extension v${chrome.runtime.getManifest().version}`, pageWidth / 2, footerY + 3, { align: 'center' });
        
        // Add metadata to PDF
        pdf.setProperties({
          title: metadata.title,
          subject: 'ProofVault Evidence Certificate',
          author: 'ProofVault Chrome Extension',
          keywords: 'evidence, blockchain, proofvault',
          creator: 'ProofVault'
        });
        
        // Add custom metadata as PDF annotations
        const pdfMetadata = {
          proofvault_version: chrome.runtime.getManifest().version,
          original_url: metadata.url,
          capture_timestamp: metadata.timestamp,
          user_agent: navigator.userAgent
        };
        
        // Convert to blob
        const pdfBlob = pdf.output('blob');
        
        resolve({
          pdfBlob,
          pdfMetadata,
          pageCount: pdf.internal.getNumberOfPages()
        });
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

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Alternative method using html2pdf for complex pages
export async function generatePDFFromHTML(htmlContent, metadata) {
  // This would be used for more complex captures
  // Currently not implemented but structure is here for future enhancement
  throw new Error('HTML to PDF conversion not yet implemented');
}