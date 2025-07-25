/**
 * PDF Processing Service
 * 
 * Handles PDF file processing, validation, hash calculation,
 * and storage operations for ProofVault evidence system.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const logger = require('../utils/logger');

class PDFService {
  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024 || 10 * 1024 * 1024; // 10MB default
    this.supportedMimeTypes = process.env.SUPPORTED_MIME_TYPES?.split(',') || ['application/pdf'];
    
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
      logger.info(`Upload directory ready: ${this.uploadPath}`);
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
    }
  }

  /**
   * Calculate SHA-256 hash of PDF data
   */
  calculateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate PDF file
   */
  async validatePDF(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!this.supportedMimeTypes.includes(file.mimetype)) {
      errors.push(`Unsupported file type: ${file.mimetype}. Supported types: ${this.supportedMimeTypes.join(', ')}`);
    }

    // Validate PDF structure
    try {
      await pdfParse(file.buffer);
    } catch (error) {
      errors.push('Invalid PDF file structure');
      logger.warn('PDF validation failed:', error.message);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process uploaded PDF file
   */
  async processPDF(file, metadata = {}) {
    try {
      logger.info(`Processing PDF: ${file.originalname} (${file.size} bytes)`);

      // Validate PDF
      const validation = await this.validatePDF(file);
      if (!validation.isValid) {
        throw new Error(`PDF validation failed: ${validation.errors.join(', ')}`);
      }

      // Calculate hash
      const hash = this.calculateHash(file.buffer);
      logger.info(`PDF hash calculated: ${hash}`);

      // Extract PDF metadata
      const pdfData = await pdfParse(file.buffer);
      const extractedMetadata = {
        pageCount: pdfData.numpages,
        textLength: pdfData.text?.length || 0,
        info: pdfData.info || {},
        ...metadata
      };

      // Save file to storage
      const filePath = await this.saveFile(file.buffer, hash, file.originalname);

      // Generate thumbnail (optional)
      let thumbnailPath = null;
      try {
        thumbnailPath = await this.generateThumbnail(file.buffer, hash);
      } catch (thumbnailError) {
        logger.warn('Thumbnail generation failed:', thumbnailError.message);
      }

      return {
        hash,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        filePath,
        thumbnailPath,
        metadata: extractedMetadata,
        text: pdfData.text // For search indexing
      };

    } catch (error) {
      logger.error('PDF processing failed:', error);
      throw error;
    }
  }

  /**
   * Save PDF file to storage
   */
  async saveFile(buffer, hash, originalName) {
    try {
      const fileName = `${hash}.pdf`;
      const filePath = path.join(this.uploadPath, fileName);

      await fs.writeFile(filePath, buffer);
      logger.info(`PDF saved: ${filePath}`);

      return filePath;

    } catch (error) {
      logger.error('Failed to save PDF file:', error);
      throw error;
    }
  }

  /**
   * Generate PDF thumbnail
   */
  async generateThumbnail(pdfBuffer, hash) {
    try {
      // This is a simplified implementation
      // In a production system, you'd use a proper PDF-to-image converter
      // like pdf-poppler or pdf2pic
      
      const thumbnailDir = path.join(this.uploadPath, 'thumbnails');
      await fs.mkdir(thumbnailDir, { recursive: true });

      const thumbnailPath = path.join(thumbnailDir, `${hash}_thumb.png`);
      
      // For now, create a placeholder thumbnail
      // In production, implement actual PDF-to-image conversion
      const placeholderBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await fs.writeFile(thumbnailPath, placeholderBuffer);
      logger.info(`Thumbnail created: ${thumbnailPath}`);

      return thumbnailPath;

    } catch (error) {
      logger.error('Thumbnail generation failed:', error);
      throw error;
    }
  }

  /**
   * Verify PDF hash against stored file
   */
  async verifyPDFHash(filePath, expectedHash) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const calculatedHash = this.calculateHash(fileBuffer);
      
      return {
        isValid: calculatedHash === expectedHash,
        calculatedHash,
        expectedHash
      };

    } catch (error) {
      logger.error('PDF hash verification failed:', error);
      throw error;
    }
  }

  /**
   * Get PDF file buffer by hash
   */
  async getPDFByHash(hash) {
    try {
      const filePath = path.join(this.uploadPath, `${hash}.pdf`);
      const fileBuffer = await fs.readFile(filePath);
      
      return {
        buffer: fileBuffer,
        path: filePath
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File not found
      }
      logger.error('Failed to get PDF by hash:', error);
      throw error;
    }
  }

  /**
   * Delete PDF file and associated files
   */
  async deletePDF(hash) {
    try {
      const filePath = path.join(this.uploadPath, `${hash}.pdf`);
      const thumbnailPath = path.join(this.uploadPath, 'thumbnails', `${hash}_thumb.png`);

      // Delete main file
      try {
        await fs.unlink(filePath);
        logger.info(`Deleted PDF: ${filePath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn('Failed to delete PDF file:', error.message);
        }
      }

      // Delete thumbnail
      try {
        await fs.unlink(thumbnailPath);
        logger.info(`Deleted thumbnail: ${thumbnailPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn('Failed to delete thumbnail:', error.message);
        }
      }

      return true;

    } catch (error) {
      logger.error('PDF deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get file storage statistics
   */
  async getStorageStats() {
    try {
      const files = await fs.readdir(this.uploadPath);
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));

      let totalSize = 0;
      for (const file of pdfFiles) {
        const filePath = path.join(this.uploadPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return {
        fileCount: pdfFiles.length,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        uploadPath: this.uploadPath
      };

    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        totalSizeMB: 0,
        uploadPath: this.uploadPath,
        error: error.message
      };
    }
  }

  /**
   * Cleanup old temporary files
   */
  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.uploadPath);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.uploadPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < cutoffTime && file.startsWith('temp_')) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} old temporary files`);
      return deletedCount;

    } catch (error) {
      logger.error('File cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Extract text content for search indexing
   */
  async extractText(pdfBuffer) {
    try {
      const pdfData = await pdfParse(pdfBuffer);
      return pdfData.text || '';
    } catch (error) {
      logger.warn('Text extraction failed:', error.message);
      return '';
    }
  }

  /**
   * Validate PDF signature (if present)
   */
  async validatePDFSignature(pdfBuffer) {
    // TODO: Implement PDF digital signature validation
    // This would require a library like node-signpdf or similar
    try {
      // Placeholder implementation
      return {
        hasSginature: false,
        isValid: false,
        signers: [],
        certificates: []
      };
    } catch (error) {
      logger.warn('PDF signature validation failed:', error.message);
      return {
        hasSignature: false,
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Get PDF metadata without full processing
   */
  async getPDFMetadata(pdfBuffer) {
    try {
      const pdfData = await pdfParse(pdfBuffer, { max: 1 }); // Only parse first page for metadata
      
      return {
        pageCount: pdfData.numpages,
        info: pdfData.info || {},
        version: pdfData.version || 'unknown',
        hasText: (pdfData.text || '').length > 0
      };

    } catch (error) {
      logger.warn('PDF metadata extraction failed:', error.message);
      return {
        pageCount: 0,
        info: {},
        version: 'unknown',
        hasText: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const pdfService = new PDFService();

module.exports = pdfService;