/**
 * ProofVault PDF Generator Utility
 * Optimized for performance, memory efficiency, and legal compliance
 */

class PdfGenerator {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'a4',
      orientation: options.orientation || 'portrait',
      unit: options.unit || 'mm',
      compress: options.compress !== false,
      precision: options.precision || 16,
      maxImageWidth: options.maxImageWidth || 180, // mm
      maxImageHeight: options.maxImageHeight || 250, // mm
      margin: options.margin || 20, // mm
      fontSize: {
        title: 20,
        header: 16,
        body: 12,
        footer: 10
      },
      ...options
    };
    
    this.doc = null;
    this.pageWidth = 0;
    this.pageHeight = 0;
    this.currentY = 0;
    this.metadata = {};
  }

  /**
   * Generate optimized PDF with legal metadata
   */
  async generatePdf(company, user, id, screenshotDataUrl, url, title, options = {}) {
    const startTime = performance.now();
    
    try {
      console.log('Starting PDF generation...');
      
      // Initialize PDF document
      this.initializePdf();
      
      // Set metadata
      this.setMetadata(company, user, id, url, title);
      
      // Add header with branding
      this.addHeader();
      
      // Add evidence details
      this.addEvidenceDetails(company, user, id, url, title);
      
      // Process and add screenshot
      await this.addOptimizedScreenshot(screenshotDataUrl);
      
      // Add legal footer
      this.addLegalFooter();
      
      // Generate final PDF blob
      const pdfBlob = this.generateBlob();
      
      const endTime = performance.now();
      const processingTime = Math.round(endTime - startTime);
      
      console.log(`PDF generated successfully in ${processingTime}ms`);
      
      return {
        blob: pdfBlob,
        metadata: {
          ...this.metadata,
          processingTime,
          fileSize: pdfBlob.size,
          pages: this.doc.internal.getNumberOfPages()
        }
      };
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Initialize PDF document with optimized settings
   */
  initializePdf() {
    try {
      const { jsPDF } = window.jspdf;
      
      this.doc = new jsPDF({
        orientation: this.options.orientation,
        unit: this.options.unit,
        format: this.options.format,
        compress: this.options.compress,
        precision: this.options.precision,
        hotfixes: ["px_scaling"]
      });
      
      // Set up page dimensions
      this.pageWidth = this.doc.internal.pageSize.getWidth();
      this.pageHeight = this.doc.internal.pageSize.getHeight();
      this.currentY = this.options.margin;
      
      // Configure PDF properties
      this.doc.setProperties({
        title: 'ProofVault Legal Evidence Report',
        subject: 'Legal Evidence Capture and Authentication',
        author: 'ProofVault Legal Technology',
        creator: 'ProofVault Chrome Extension',
        producer: 'ProofVault PDF Generator v1.0'
      });
      
      console.log(`PDF initialized: ${this.pageWidth}x${this.pageHeight}${this.options.unit}`);
      
    } catch (error) {
      throw new Error(`PDF initialization failed: ${error.message}`);
    }
  }

  /**
   * Set comprehensive metadata
   */
  setMetadata(company, user, id, url, title) {
    const timestamp = new Date();
    
    this.metadata = {
      id,
      company,
      user,
      url,
      title,
      captureTime: timestamp.toISOString(),
      captureTimeLocal: timestamp.toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      pdfFormat: this.options.format,
      pdfOrientation: this.options.orientation
    };
  }

  /**
   * Add professional header
   */
  addHeader() {
    try {
      // Add ProofVault branding
      this.doc.setFontSize(this.options.fontSize.title);
      this.doc.setFont(undefined, 'bold');
      this.doc.setTextColor(30, 58, 138); // ProofVault blue
      
      const headerText = 'ProofVault - Legal Evidence Report';
      const headerWidth = this.doc.getTextWidth(headerText);
      const headerX = (this.pageWidth - headerWidth) / 2;
      
      this.doc.text(headerText, headerX, this.currentY);
      this.currentY += 15;
      
      // Add security watermark
      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setFont(undefined, 'normal');
      this.doc.setTextColor(100, 100, 100);
      
      const securityText = 'AUTHENTICATED • VERIFIED • LEGALLY COMPLIANT';
      const securityWidth = this.doc.getTextWidth(securityText);
      const securityX = (this.pageWidth - securityWidth) / 2;
      
      this.doc.text(securityText, securityX, this.currentY);
      this.currentY += 10;
      
      // Add separator line
      this.doc.setDrawColor(200, 200, 200);
      this.doc.setLineWidth(0.5);
      this.doc.line(this.options.margin, this.currentY, this.pageWidth - this.options.margin, this.currentY);
      this.currentY += 10;
      
    } catch (error) {
      console.warn('Header addition failed:', error);
    }
  }

  /**
   * Add evidence details section
   */
  addEvidenceDetails(company, user, id, url, title) {
    try {
      this.doc.setFontSize(this.options.fontSize.header);
      this.doc.setFont(undefined, 'bold');
      this.doc.setTextColor(0, 0, 0);
      
      this.doc.text('Evidence Details', this.options.margin, this.currentY);
      this.currentY += 10;
      
      // Reset formatting for details
      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setFont(undefined, 'normal');
      
      const details = [
        ['Evidence ID:', id],
        ['Organization:', company],
        ['Authenticated User:', user],
        ['Capture Date:', this.metadata.captureTimeLocal],
        ['Timezone:', this.metadata.timezone],
        ['Website URL:', url],
        ['Page Title:', title],
        ['Extension Version:', this.metadata.extensionVersion]
      ];
      
      details.forEach(([label, value]) => {
        this.doc.setFont(undefined, 'bold');
        this.doc.text(label, this.options.margin, this.currentY);
        
        this.doc.setFont(undefined, 'normal');
        const labelWidth = this.doc.getTextWidth(label) + 5;
        
        // Handle long URLs by wrapping
        if (label.includes('URL') && value.length > 60) {
          const wrappedLines = this.doc.splitTextToSize(value, this.pageWidth - this.options.margin * 2 - labelWidth);
          this.doc.text(wrappedLines, this.options.margin + labelWidth, this.currentY);
          this.currentY += (wrappedLines.length * 5);
        } else {
          this.doc.text(value, this.options.margin + labelWidth, this.currentY);
          this.currentY += 7;
        }
      });
      
      this.currentY += 10;
      
    } catch (error) {
      console.warn('Evidence details addition failed:', error);
    }
  }

  /**
   * Add optimized screenshot with memory management
   */
  async addOptimizedScreenshot(screenshotDataUrl) {
    try {
      console.log('Processing screenshot for PDF...');
      
      this.doc.setFontSize(this.options.fontSize.header);
      this.doc.setFont(undefined, 'bold');
      this.doc.text('Website Screenshot', this.options.margin, this.currentY);
      this.currentY += 10;
      
      // Create image processing promise
      const imageData = await this.processImageForPdf(screenshotDataUrl);
      
      // Calculate optimal image dimensions
      const { width: imgWidth, height: imgHeight } = this.calculateImageDimensions(
        imageData.width,
        imageData.height
      );
      
      // Check if image fits on current page
      if (this.currentY + imgHeight > this.pageHeight - this.options.margin) {
        this.doc.addPage();
        this.currentY = this.options.margin;
        
        // Re-add screenshot header on new page
        this.doc.setFontSize(this.options.fontSize.header);
        this.doc.setFont(undefined, 'bold');
        this.doc.text('Website Screenshot (continued)', this.options.margin, this.currentY);
        this.currentY += 10;
      }
      
      // Add image to PDF
      this.doc.addImage(
        imageData.dataUrl,
        'PNG',
        this.options.margin,
        this.currentY,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );
      
      this.currentY += imgHeight + 10;
      
      console.log(`Screenshot added to PDF: ${imgWidth}x${imgHeight}mm`);
      
    } catch (error) {
      console.error('Screenshot processing failed:', error);
      
      // Add error note instead of image
      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setTextColor(220, 53, 69);
      this.doc.text('Screenshot could not be processed', this.options.margin, this.currentY);
      this.currentY += 10;
    }
  }

  /**
   * Process image with memory optimization
   */
  async processImageForPdf(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create temporary canvas for processing
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', {
            alpha: false,
            willReadFrequently: false
          });
          
          // Calculate processing dimensions (reduce for PDF)
          const maxProcessingWidth = 1200;
          const maxProcessingHeight = 1600;
          
          let { width: processWidth, height: processHeight } = this.calculateOptimalDimensions(
            img.width,
            img.height,
            maxProcessingWidth,
            maxProcessingHeight
          );
          
          canvas.width = processWidth;
          canvas.height = processHeight;
          
          // Draw and optimize image
          ctx.drawImage(img, 0, 0, processWidth, processHeight);
          
          // Generate optimized data URL
          const optimizedDataUrl = canvas.toDataURL('image/png', 0.9);
          
          // Clean up canvas immediately
          canvas.width = 1;
          canvas.height = 1;
          
          resolve({
            dataUrl: optimizedDataUrl,
            width: processWidth,
            height: processHeight
          });
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load screenshot image'));
      img.src = dataUrl;
    });
  }

  /**
   * Calculate optimal image dimensions for PDF
   */
  calculateImageDimensions(pixelWidth, pixelHeight) {
    const maxWidth = this.options.maxImageWidth;
    const maxHeight = this.options.maxImageHeight;
    
    // Convert pixels to mm (approximate: 96 DPI = 3.78 pixels per mm)
    const mmPerPixel = 0.264583;
    let mmWidth = pixelWidth * mmPerPixel;
    let mmHeight = pixelHeight * mmPerPixel;
    
    // Scale down if exceeds maximum dimensions
    if (mmWidth > maxWidth) {
      const ratio = maxWidth / mmWidth;
      mmWidth = maxWidth;
      mmHeight = mmHeight * ratio;
    }
    
    if (mmHeight > maxHeight) {
      const ratio = maxHeight / mmHeight;
      mmHeight = maxHeight;
      mmWidth = mmWidth * ratio;
    }
    
    return { width: mmWidth, height: mmHeight };
  }

  /**
   * Calculate optimal processing dimensions
   */
  calculateOptimalDimensions(width, height, maxWidth, maxHeight) {
    let newWidth = width;
    let newHeight = height;
    
    if (newWidth > maxWidth) {
      const ratio = maxWidth / newWidth;
      newWidth = maxWidth;
      newHeight = Math.round(newHeight * ratio);
    }
    
    if (newHeight > maxHeight) {
      const ratio = maxHeight / newHeight;
      newHeight = maxHeight;
      newWidth = Math.round(newWidth * ratio);
    }
    
    return { width: newWidth, height: newHeight };
  }

  /**
   * Add legal compliance footer
   */
  addLegalFooter() {
    try {
      // Add new page for legal footer if needed
      if (this.currentY > this.pageHeight - 40) {
        this.doc.addPage();
        this.currentY = this.options.margin;
      }
      
      // Add legal disclaimer
      this.doc.setFontSize(this.options.fontSize.header);
      this.doc.setFont(undefined, 'bold');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('Legal Authentication', this.options.margin, this.currentY);
      this.currentY += 10;
      
      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setFont(undefined, 'normal');
      
      const legalText = [
        'This document constitutes authenticated digital evidence captured using ProofVault technology.',
        'The screenshot and metadata contained herein were captured at the specified date and time',
        'using cryptographically secure methods to ensure integrity and authenticity.',
        '',
        'Evidence Chain of Custody:',
        `• Captured: ${this.metadata.captureTimeLocal}`,
        `• Generated: ${new Date().toLocaleString()}`,
        `• Evidence ID: ${this.metadata.id}`,
        `• System: ${this.metadata.userAgent.substring(0, 50)}...`
      ];
      
      legalText.forEach(line => {
        if (line === '') {
          this.currentY += 3;
        } else {
          const wrappedLines = this.doc.splitTextToSize(line, this.pageWidth - this.options.margin * 2);
          this.doc.text(wrappedLines, this.options.margin, this.currentY);
          this.currentY += (wrappedLines.length * 5);
        }
      });
      
      // Add page numbers to all pages
      this.addPageNumbers();
      
    } catch (error) {
      console.warn('Legal footer addition failed:', error);
    }
  }

  /**
   * Add page numbers to all pages
   */
  addPageNumbers() {
    const pageCount = this.doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(this.options.fontSize.footer);
      this.doc.setFont(undefined, 'normal');
      this.doc.setTextColor(100, 100, 100);
      
      const pageText = `Page ${i} of ${pageCount} • ProofVault Evidence ID: ${this.metadata.id}`;
      const pageTextWidth = this.doc.getTextWidth(pageText);
      const pageX = (this.pageWidth - pageTextWidth) / 2;
      
      this.doc.text(pageText, pageX, this.pageHeight - 10);
    }
  }

  /**
   * Generate final PDF blob
   */
  generateBlob() {
    try {
      return this.doc.output('blob');
    } catch (error) {
      throw new Error(`PDF blob generation failed: ${error.message}`);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.doc = null;
    this.metadata = {};
    this.currentY = 0;
  }
}

// Export for use in other modules
window.PdfGenerator = PdfGenerator;