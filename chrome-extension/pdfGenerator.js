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
    
    // CRITICAL: Concurrency protection
    this.isGenerating = false;
    this.generationId = null;
  }

  /**
   * Generate optimized PDF with legal metadata
   */
  async generatePdf(company, user, id, screenshotData, url, title, options = {}) {
    const startTime = performance.now();
    
    // CRITICAL: Prevent concurrent PDF generation
    if (this.isGenerating) {
      throw new Error('PDF generation already in progress - concurrent generation prevented');
    }
    
    // Generate unique ID for this generation process
    const generationId = `pdf_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.generationId = generationId;
    this.isGenerating = true;
    
    try {
      console.log(`Starting PDF generation with ID: ${generationId}`);
      
      // Initialize PDF document
      this.initializePdf();
      
      // Verify initialization was successful and generation ID hasn't been corrupted
      if (!this.doc) {
        throw new Error('PDF initialization failed - document is null after initialization');
      }
      if (this.generationId !== generationId) {
        throw new Error('PDF generation corrupted - generation ID mismatch detected');
      }
      console.log(`PDF document initialized successfully for generation: ${generationId}`);
      
      // Set metadata
      this.setMetadata(company, user, id, url, title);
      
      // Add header with branding
      this.addHeader();
      
      // Add evidence details
      this.addEvidenceDetails(company, user, id, url, title);
      
      // Validate generation state before processing screenshots
      if (this.generationId !== generationId || !this.doc) {
        throw new Error('PDF generation state corrupted before screenshot processing');
      }
      
      // Check if we have multiple screenshots or a single one
      if (screenshotData && screenshotData.isMultipleScreenshots && screenshotData.screenshots) {
        await this.addMultipleScreenshots(screenshotData.screenshots, screenshotData.metadata, generationId);
      } else {
        // Handle single screenshot (backward compatibility)
        const dataUrl = typeof screenshotData === 'string' ? screenshotData : screenshotData.dataUrl;
        await this.addOptimizedScreenshot(dataUrl, generationId);
      }
      
      // Final validation before footer and blob generation
      if (this.generationId !== generationId || !this.doc) {
        throw new Error('PDF generation state corrupted before finalizing');
      }
      
      // Add legal footer
      this.addLegalFooter();
      
      // Generate final PDF blob with validation
      const pdfBlob = this.generateBlob();
      
      const endTime = performance.now();
      const processingTime = Math.round(endTime - startTime);
      
      console.log(`PDF generated successfully in ${processingTime}ms with ID: ${generationId}`);
      
      return {
        blob: pdfBlob,
        metadata: {
          ...this.metadata,
          processingTime,
          fileSize: pdfBlob.size,
          pages: this.doc.internal.getNumberOfPages(),
          generationId
        }
      };
      
    } catch (error) {
      console.error(`PDF generation failed for ID ${generationId}:`, error);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      // CRITICAL: Always reset generation state
      this.isGenerating = false;
      this.generationId = null;
      this.cleanup();
    }
  }

  /**
   * Initialize PDF document with optimized settings
   */
  initializePdf() {
    try {
      // Ensure jsPDF is available
      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF library not loaded');
      }
      
      const { jsPDF } = window.jspdf;
      
      // Create PDF with error handling
      this.doc = new jsPDF({
        orientation: this.options.orientation,
        unit: this.options.unit,
        format: this.options.format,
        compress: this.options.compress,
        precision: this.options.precision,
        hotfixes: ["px_scaling"]
      });
      
      // Critical validation: Ensure document was created
      if (!this.doc) {
        throw new Error('PDF document creation failed - jsPDF returned null/undefined');
      }
      
      // Validate essential methods exist
      const requiredMethods = ['setFontSize', 'text', 'addImage', 'addPage', 'output'];
      for (const method of requiredMethods) {
        if (typeof this.doc[method] !== 'function') {
          throw new Error(`PDF document missing required method: ${method}`);
        }
      }
      
      // Set up page dimensions
      this.pageWidth = this.doc.internal.pageSize.getWidth();
      this.pageHeight = this.doc.internal.pageSize.getHeight();
      this.currentY = this.options.margin;
      
      // Validate dimensions
      if (!this.pageWidth || !this.pageHeight || this.pageWidth <= 0 || this.pageHeight <= 0) {
        throw new Error('Invalid PDF page dimensions');
      }
      
      // Configure PDF properties
      this.doc.setProperties({
        title: 'ProofVault Legal Evidence Report',
        subject: 'Legal Evidence Capture and Authentication',
        author: 'ProofVault Legal Technology',
        creator: 'ProofVault Chrome Extension',
        producer: 'ProofVault PDF Generator v1.0'
      });
      
      console.log(`PDF initialized successfully: ${this.pageWidth}x${this.pageHeight}${this.options.unit}`);
      
    } catch (error) {
      this.doc = null; // Ensure we don't have a partially initialized document
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
  async addOptimizedScreenshot(screenshotDataUrl, generationId = null) {
    try {
      console.log('Processing screenshot for PDF...');
      
      // Validate document state if generation ID is provided
      if (generationId && (this.generationId !== generationId || !this.doc)) {
        throw new Error(`PDF document state corrupted during screenshot processing for generation ${generationId}`);
      }
      
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
   * Add multiple screenshots to PDF with section headers
   */
  async addMultipleScreenshots(screenshots, captureMetadata, generationId = null) {
    try {
      console.log(`Adding ${screenshots.length} screenshots to PDF...`);
      
      // Validate PDF document is available before starting
      if (!this.doc) {
        throw new Error('PDF document is null before processing screenshots');
      }
      
      // Validate generation ID if provided
      if (generationId && this.generationId !== generationId) {
        throw new Error(`PDF generation ID mismatch at start of multiple screenshots processing: expected ${generationId}, got ${this.generationId}`);
      }
      
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        
        // Critical: Re-verify PDF document is still valid at each iteration
        if (!this.doc) {
          throw new Error(`PDF document became null at screenshot ${i + 1}/${screenshots.length}`);
        }
        
        // Critical: Re-verify generation ID hasn't been corrupted
        if (generationId && this.generationId !== generationId) {
          throw new Error(`PDF generation ID mismatch at screenshot ${i + 1}/${screenshots.length}: expected ${generationId}, got ${this.generationId}`);
        }
        
        // Defensive check: Ensure PDF document has required methods
        if (typeof this.doc.setFontSize !== 'function' || typeof this.doc.addImage !== 'function') {
          throw new Error(`PDF document is corrupted at screenshot ${i + 1}/${screenshots.length}`);
        }
        
        try {
          this.doc.setFontSize(this.options.fontSize.header);
          this.doc.setFont(undefined, 'bold');
          
          let sectionTitle;
          if (screenshots.length === 1) {
            sectionTitle = 'Website Screenshot';
          } else {
            sectionTitle = `Website Screenshot - Section ${screenshot.sectionIndex} of ${screenshot.totalSections}`;
          }
          
          // Validate Y position and page dimensions
          if (this.currentY > this.doc.internal.pageSize.height - 100) {
            this.doc.addPage();
            this.currentY = this.options.margin;
          }
          
          this.doc.text(sectionTitle, this.options.margin, this.currentY);
          this.currentY += 10;
          
          // Add position information for context (simplified to avoid corruption)
          if (screenshots.length > 1) {
            try {
              this.doc.setFontSize(this.options.fontSize.small || 10);
              this.doc.setFont(undefined, 'normal');
              this.doc.setTextColor(100);
              
              const positionText = `Section ${screenshot.sectionIndex || i + 1} - Position: X=${screenshot.position?.x || 0}px, Y=${screenshot.position?.y || 0}px`;
              
              // Ensure currentY is valid
              if (!this.currentY || this.currentY < this.options.margin) {
                this.currentY = this.options.margin + 10;
              }
              
              this.doc.text(positionText, this.options.margin, this.currentY);
              this.currentY += 8;
              
              // Reset text color
              this.doc.setTextColor(0);
            } catch (textError) {
              console.warn('Failed to add position text:', textError);
              // Continue without position text - don't fail the whole process
            }
          }
          
          // Process and add the screenshot with error handling
          const imageData = await this.processImageForPdf(screenshot.dataUrl);
          
          // Calculate optimal image dimensions for PDF
          const maxWidth = this.options.maxImageWidth || 170; // mm
          const maxHeight = this.options.maxImageHeight || 240; // mm
          
          const imgDimensions = this.calculateOptimalDimensions(
            imageData.width,
            imageData.height,
            maxWidth,
            maxHeight
          );
          
          // Final check before adding image
          if (!this.doc) {
            throw new Error(`PDF document became null during image processing for screenshot ${i + 1}`);
          }
          
          // Check if image fits on current page
          if (this.currentY + imgDimensions.height > this.doc.internal.pageSize.height - this.options.margin) {
            this.doc.addPage();
            this.currentY = this.options.margin;
            
            // Re-add section header on new page
            this.doc.setFontSize(this.options.fontSize.header || 16);
            this.doc.setFont(undefined, 'bold');
            this.doc.text(`${sectionTitle} (continued)`, this.options.margin, this.currentY);
            this.currentY += 10;
          }
          
          // Critical: Final validation before addImage call
          if (!this.doc || typeof this.doc.addImage !== 'function') {
            throw new Error(`PDF document invalid before adding image ${i + 1}`);
          }
          
          // Add image to PDF with error handling
          this.doc.addImage(
            imageData.dataUrl,
            'PNG',
            this.options.margin,
            this.currentY,
            imgDimensions.width,
            imgDimensions.height,
            undefined,
            'FAST'
          );
          
          this.currentY += imgDimensions.height + 10;
          
          console.log(`Screenshot ${i + 1}/${screenshots.length} added successfully`);
          
          // Add some spacing between screenshots
          if (i < screenshots.length - 1) {
            this.currentY += 5;
          }
          
        } catch (screenshotError) {
          console.error(`Failed to process screenshot ${i + 1}:`, screenshotError);
          
          // Add error placeholder instead of failing completely
          if (this.doc && typeof this.doc.text === 'function') {
            try {
              this.doc.setFontSize(this.options.fontSize.body);
              this.doc.setTextColor(220, 53, 69);
              this.doc.text(`Screenshot ${i + 1} could not be processed`, this.options.margin, this.currentY);
              this.currentY += 15;
              this.doc.setTextColor(0);
            } catch (errorTextError) {
              console.error('Could not even add error text:', errorTextError);
              // Continue to next screenshot
            }
          }
        }
      }
      
      // Add summary information
      if (screenshots.length > 1) {
        if (!this.doc) {
          console.warn('PDF document is null - skipping summary section');
          return;
        }
        
        try {
          this.currentY += 10;
          this.doc.setFontSize(this.options.fontSize.small || 10);
          this.doc.setFont(undefined, 'normal');
          this.doc.setTextColor(100);
          
          const summaryText = [
            `Full page capture completed with ${screenshots.length} sections.`,
            `Total page dimensions: ${captureMetadata?.dimensions?.full?.width || 'unknown'}x${captureMetadata?.dimensions?.full?.height || 'unknown'} pixels`,
            `Viewport size: ${captureMetadata?.dimensions?.viewport?.width || 'unknown'}x${captureMetadata?.dimensions?.viewport?.height || 'unknown'} pixels`
          ];
          
          summaryText.forEach(text => {
            if (this.doc && text) {
              this.doc.text(text, this.options.margin, this.currentY);
              this.currentY += 6;
            }
          });
          
          // Reset text color
          if (this.doc) {
            this.doc.setTextColor(0);
          }
        } catch (summaryError) {
          console.warn('Failed to add summary section:', summaryError);
        }
      }
      
    } catch (error) {
      console.error('Critical error in multiple screenshots processing:', error);
      
      // If PDF document is completely corrupted, we need to re-throw
      if (!this.doc) {
        throw new Error(`PDF document became null during processing: ${error.message}`);
      }
      
      // Otherwise, try to add at least an error note if possible
      try {
        if (this.doc && typeof this.doc.text === 'function') {
          this.doc.setFontSize(this.options.fontSize.body);
          this.doc.setTextColor(220, 53, 69);
          this.doc.text('Some screenshots could not be processed', this.options.margin, this.currentY);
          this.currentY += 10;
          this.doc.setTextColor(0);
        }
      } catch (finalError) {
        console.error('Final error handling failed:', finalError);
        throw error; // Re-throw original error
      }
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
    
    // Calculate the aspect ratio
    const aspectRatio = pixelWidth / pixelHeight;
    
    // Scale down if exceeds maximum dimensions while maintaining aspect ratio
    if (mmWidth > maxWidth || mmHeight > maxHeight) {
      // Calculate scale factors for both dimensions
      const widthScale = maxWidth / mmWidth;
      const heightScale = maxHeight / mmHeight;
      
      // Use the smaller scale factor to ensure the image fits within bounds
      const scaleFactor = Math.min(widthScale, heightScale);
      
      // Apply the same scale factor to both dimensions
      mmWidth = mmWidth * scaleFactor;
      mmHeight = mmHeight * scaleFactor;
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
      // Final validation before generating blob
      if (!this.doc) {
        throw new Error('PDF document is null - cannot generate blob');
      }
      
      if (typeof this.doc.output !== 'function') {
        throw new Error('PDF document output method is not available');
      }
      
      const blob = this.doc.output('blob');
      
      // Validate generated blob
      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Generated PDF blob is invalid or empty');
      }
      
      return blob;
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
    // Note: isGenerating and generationId are reset in the finally block of generatePdf
  }
}

// Export for use in other modules
window.PdfGenerator = PdfGenerator;