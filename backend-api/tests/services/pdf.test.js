/**
 * PDF Service Tests
 * 
 * Unit tests for PDF processing, validation, and hash calculation.
 */

const pdfService = require('../../src/services/pdf');

describe('PDF Service', () => {
  describe('calculateHash', () => {
    it('should calculate SHA-256 hash correctly', () => {
      const testData = Buffer.from('test data');
      const hash = pdfService.calculateHash(testData);
      
      expect(hash).toBe('916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hashes for same data', () => {
      const testData = Buffer.from('consistent test data');
      const hash1 = pdfService.calculateHash(testData);
      const hash2 = pdfService.calculateHash(testData);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different data', () => {
      const data1 = Buffer.from('test data 1');
      const data2 = Buffer.from('test data 2');
      const hash1 = pdfService.calculateHash(data1);
      const hash2 = pdfService.calculateHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validatePDF', () => {
    it('should validate file size', async () => {
      const largeMockFile = {
        size: 50 * 1024 * 1024, // 50MB
        mimetype: 'application/pdf',
        buffer: testUtils.createTestPDFBuffer()
      };

      const result = await pdfService.validatePDF(largeMockFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('File size exceeds'));
    });

    it('should validate MIME type', async () => {
      const wrongTypeMockFile = {
        size: 1024,
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake image data')
      };

      const result = await pdfService.validatePDF(wrongTypeMockFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Unsupported file type'));
    });

    it('should accept valid PDF file', async () => {
      const validMockFile = {
        size: 1024,
        mimetype: 'application/pdf',
        buffer: testUtils.createTestPDFBuffer()
      };

      const result = await pdfService.validatePDF(validMockFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('processPDF', () => {
    it('should process valid PDF file', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        buffer: testUtils.createTestPDFBuffer()
      };

      const result = await pdfService.processPDF(mockFile);
      
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('originalName', 'test.pdf');
      expect(result).toHaveProperty('size', 1024);
      expect(result).toHaveProperty('mimeType', 'application/pdf');
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('metadata');
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should reject invalid PDF file', async () => {
      const invalidMockFile = {
        originalname: 'invalid.pdf',
        size: 50 * 1024 * 1024, // Too large
        mimetype: 'application/pdf',
        buffer: Buffer.from('not a pdf')
      };

      await expect(pdfService.processPDF(invalidMockFile))
        .rejects.toThrow('PDF validation failed');
    });
  });

  describe('verifyPDFHash', () => {
    it('should verify matching hash', async () => {
      const testData = Buffer.from('test pdf content');
      const expectedHash = pdfService.calculateHash(testData);
      
      // Mock file system operations
      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue(testData);

      const result = await pdfService.verifyPDFHash('/fake/path.pdf', expectedHash);
      
      expect(result.isValid).toBe(true);
      expect(result.calculatedHash).toBe(expectedHash);
      expect(result.expectedHash).toBe(expectedHash);

      fs.readFile.mockRestore();
    });

    it('should detect hash mismatch', async () => {
      const testData = Buffer.from('test pdf content');
      const wrongHash = 'a'.repeat(64);
      
      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue(testData);

      const result = await pdfService.verifyPDFHash('/fake/path.pdf', wrongHash);
      
      expect(result.isValid).toBe(false);
      expect(result.calculatedHash).not.toBe(wrongHash);
      expect(result.expectedHash).toBe(wrongHash);

      fs.readFile.mockRestore();
    });
  });
});