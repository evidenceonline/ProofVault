/**
 * Test Data Generator
 * 
 * Generates various types of test data for ProofVault E2E tests:
 * - PDF files with different characteristics
 * - Test documents and metadata
 * - User accounts and authentication data
 * - Blockchain test data
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TestDataGenerator {
  constructor() {
    this.generatedData = new Map();
  }

  /**
   * Generate all test data
   */
  static async generateAllTestData(outputDir) {
    const generator = new TestDataGenerator();
    
    console.log('📊 Generating test data...');
    
    // Create output directories
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'pdfs'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'images'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'documents'), { recursive: true });
    
    // Generate different types of test data
    await generator.generateTestPDFs(path.join(outputDir, 'pdfs'));
    await generator.generateTestImages(path.join(outputDir, 'images'));
    await generator.generateTestDocuments(path.join(outputDir, 'documents'));
    await generator.generateUserData(outputDir);
    await generator.generateMetadataExamples(outputDir);
    await generator.generateBlockchainTestData(outputDir);
    
    console.log('✅ Test data generation complete');
  }

  /**
   * Generate various PDF test files
   */
  async generateTestPDFs(outputDir) {
    console.log('  📄 Generating test PDFs...');
    
    const pdfTypes = [
      { name: 'valid-simple.pdf', type: 'simple' },
      { name: 'valid-complex.pdf', type: 'complex' },
      { name: 'valid-large.pdf', type: 'large' },
      { name: 'invalid-corrupted.pdf', type: 'corrupted' },
      { name: 'invalid-empty.pdf', type: 'empty' },
      { name: 'invalid-too-large.pdf', type: 'oversized' }
    ];

    for (const pdfType of pdfTypes) {
      const pdfContent = this.generatePDFContent(pdfType.type);
      const pdfPath = path.join(outputDir, pdfType.name);
      await fs.writeFile(pdfPath, pdfContent);
    }
  }

  /**
   * Generate PDF content based on type
   */
  generatePDFContent(type) {
    switch (type) {
      case 'simple':
        return this.generateSimplePDF();
      case 'complex':
        return this.generateComplexPDF();
      case 'large':
        return this.generateLargePDF();
      case 'corrupted':
        return this.generateCorruptedPDF();
      case 'empty':
        return Buffer.alloc(0);
      case 'oversized':
        return this.generateOversizedPDF();
      default:
        return this.generateSimplePDF();
    }
  }

  /**
   * Generate a simple valid PDF
   */
  generateSimplePDF() {
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
50 750 Td
(Test PDF Content) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000279 00000 n 
0000000370 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
467
%%EOF`;
    
    return Buffer.from(pdfContent);
  }

  /**
   * Generate a complex PDF with multiple pages and elements
   */
  generateComplexPDF() {
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R 4 0 R]
/Count 2
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 5 0 R
/Resources <<
  /Font <<
    /F1 6 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 7 0 R
/Resources <<
  /Font <<
    /F1 6 0 R
  >>
>>
>>
endobj

5 0 obj
<<
/Length 120
>>
stream
BT
/F1 12 Tf
50 750 Td
(Complex PDF - Page 1) Tj
0 -20 Td
(This is a multi-page PDF document) Tj
0 -20 Td
(with various content elements) Tj
ET
endstream
endobj

6 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

7 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
50 750 Td
(Complex PDF - Page 2) Tj
0 -20 Td
(Additional content on second page) Tj
ET
endstream
endobj

xref
0 8
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000279 00000 n 
0000000433 00000 n 
0000000600 00000 n 
0000000697 00000 n 
trailer
<<
/Size 8
/Root 1 0 R
>>
startxref
844
%%EOF`;
    
    return Buffer.from(pdfContent);
  }

  /**
   * Generate a large PDF file
   */
  generateLargePDF() {
    const basePDF = this.generateSimplePDF();
    const largePaddingSize = 5 * 1024 * 1024; // 5MB padding
    const padding = Buffer.alloc(largePaddingSize, 0x20); // Fill with spaces
    
    return Buffer.concat([basePDF, padding]);
  }

  /**
   * Generate a corrupted PDF
   */
  generateCorruptedPDF() {
    const validPDF = this.generateSimplePDF();
    const corrupted = Buffer.from(validPDF);
    
    // Corrupt some bytes in the middle
    for (let i = 100; i < 150; i++) {
      corrupted[i] = Math.floor(Math.random() * 256);
    }
    
    return corrupted;
  }

  /**
   * Generate an oversized PDF (for testing size limits)
   */
  generateOversizedPDF() {
    const basePDF = this.generateSimplePDF();
    const oversizeAmount = 100 * 1024 * 1024; // 100MB
    const padding = Buffer.alloc(oversizeAmount, 0);
    
    return Buffer.concat([basePDF, padding]);
  }

  /**
   * Generate test images for comparison
   */
  async generateTestImages(outputDir) {
    console.log('  🖼️ Generating test images...');
    
    // Generate simple PNG data (1x1 pixel)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk (minimal)
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC4, 0x2A, 0xE4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
      0x42, 0x60, 0x82
    ]);
    
    await fs.writeFile(path.join(outputDir, 'test-image.png'), pngData);
    
    // Generate JPEG header (minimal)
    const jpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      // ... minimal JPEG structure
      0xFF, 0xD9 // End of image
    ]);
    
    await fs.writeFile(path.join(outputDir, 'test-image.jpg'), jpegData);
  }

  /**
   * Generate test documents with metadata
   */
  async generateTestDocuments(outputDir) {
    console.log('  📋 Generating test documents...');
    
    const documents = [
      {
        name: 'legal-contract.json',
        data: {
          type: 'legal_contract',
          title: 'Software License Agreement',
          parties: ['Company A', 'Company B'],
          date: '2024-01-15',
          hash: this.generateHash('legal contract content'),
          metadata: {
            pages: 12,
            signatures: 2,
            witnesses: 1
          }
        }
      },
      {
        name: 'financial-statement.json',
        data: {
          type: 'financial_statement',
          title: 'Q4 2023 Financial Report',
          company: 'Test Corporation',
          period: '2023-Q4',
          hash: this.generateHash('financial statement content'),
          metadata: {
            revenue: 1000000,
            expenses: 750000,
            profit: 250000
          }
        }
      },
      {
        name: 'academic-paper.json',
        data: {
          type: 'academic_paper',
          title: 'Blockchain Applications in Digital Evidence',
          authors: ['Dr. Smith', 'Prof. Johnson'],
          journal: 'Digital Security Review',
          hash: this.generateHash('academic paper content'),
          metadata: {
            pages: 24,
            references: 87,
            doi: '10.1000/182'
          }
        }
      }
    ];

    for (const doc of documents) {
      const docPath = path.join(outputDir, doc.name);
      await fs.writeFile(docPath, JSON.stringify(doc.data, null, 2));
    }
  }

  /**
   * Generate user test data
   */
  async generateUserData(outputDir) {
    console.log('  👤 Generating user test data...');
    
    const users = [
      {
        username: 'testuser1',
        email: 'testuser1@example.com',
        password: 'TestPassword123!',
        role: 'user',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          organization: 'Test Organization',
          verificationLevel: 'standard'
        },
        walletAddress: this.generateWalletAddress(),
        publicKey: this.generatePublicKey(),
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        role: 'admin',
        profile: {
          firstName: 'Admin',
          lastName: 'User',
          organization: 'ProofVault Admin',
          verificationLevel: 'premium'
        },
        walletAddress: this.generateWalletAddress(),
        publicKey: this.generatePublicKey(),
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        username: 'verifier',
        email: 'verifier@example.com',
        password: 'VerifierPassword123!',
        role: 'verifier',
        profile: {
          firstName: 'Document',
          lastName: 'Verifier',
          organization: 'Verification Services',
          verificationLevel: 'professional'
        },
        walletAddress: this.generateWalletAddress(),
        publicKey: this.generatePublicKey(),
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const userData = {
      users,
      totalUsers: users.length,
      generatedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(outputDir, 'test-users.json'),
      JSON.stringify(userData, null, 2)
    );
  }

  /**
   * Generate metadata examples
   */
  async generateMetadataExamples(outputDir) {
    console.log('  📊 Generating metadata examples...');
    
    const metadataExamples = [
      {
        name: 'webpage-capture',
        metadata: {
          originalUrl: 'https://example.com/important-page',
          documentTitle: 'Important Webpage',
          captureTimestamp: '2024-01-15T10:30:00Z',
          captureUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          captureViewportSize: { width: 1920, height: 1080 },
          pageLoadTime: 1250,
          domElements: 342,
          externalResources: 15,
          sslCertificate: {
            issuer: 'Let\'s Encrypt',
            validFrom: '2024-01-01',
            validTo: '2024-04-01'
          }
        }
      },
      {
        name: 'document-upload',
        metadata: {
          originalFilename: 'contract.pdf',
          uploadTimestamp: '2024-01-15T14:20:00Z',
          fileSize: 2048576,
          mimeType: 'application/pdf',
          checksum: {
            md5: 'a1b2c3d4e5f6',
            sha1: 'f1e2d3c4b5a6',
            sha256: 'abcdef1234567890'
          },
          pdfMetadata: {
            pages: 5,
            author: 'John Doe',
            creator: 'PDF Writer',
            title: 'Service Agreement',
            creationDate: '2024-01-10',
            modificationDate: '2024-01-12'
          }
        }
      },
      {
        name: 'email-evidence',
        metadata: {
          messageId: 'msg-12345@example.com',
          subject: 'Contract Amendment Agreement',
          sender: 'sender@company.com',
          recipients: ['recipient@company.com'],
          timestamp: '2024-01-15T09:15:00Z',
          attachments: [
            {
              filename: 'amendment.pdf',
              size: 1024000,
              hash: 'abc123def456'
            }
          ],
          headers: {
            'DKIM-Signature': 'valid',
            'SPF': 'pass',
            'DMARC': 'pass'
          }
        }
      }
    ];

    const metadataCollection = {
      examples: metadataExamples,
      schema: {
        required: ['originalUrl', 'captureTimestamp'],
        optional: ['documentTitle', 'captureUserAgent', 'captureViewportSize'],
        types: {
          originalUrl: 'string',
          captureTimestamp: 'ISO8601 datetime',
          captureViewportSize: 'object'
        }
      },
      generatedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(outputDir, 'metadata-examples.json'),
      JSON.stringify(metadataCollection, null, 2)
    );
  }

  /**
   * Generate blockchain test data
   */
  async generateBlockchainTestData(outputDir) {
    console.log('  ⛓️ Generating blockchain test data...');
    
    const blockchainData = {
      transactions: [
        {
          id: 'tx_' + this.generateId(),
          hash: this.generateHash('transaction 1'),
          type: 'document_registration',
          timestamp: '2024-01-15T10:00:00Z',
          blockHeight: 12345,
          confirmations: 6,
          status: 'confirmed',
          data: {
            documentHash: this.generateHash('document 1'),
            submitter: this.generateWalletAddress(),
            signature: this.generateSignature()
          }
        },
        {
          id: 'tx_' + this.generateId(),
          hash: this.generateHash('transaction 2'),
          type: 'document_verification',
          timestamp: '2024-01-15T11:00:00Z',
          blockHeight: 12346,
          confirmations: 5,
          status: 'confirmed',
          data: {
            documentHash: this.generateHash('document 2'),
            verifier: this.generateWalletAddress(),
            result: 'verified'
          }
        }
      ],
      blocks: [
        {
          height: 12345,
          hash: this.generateHash('block 12345'),
          previousHash: this.generateHash('block 12344'),
          timestamp: '2024-01-15T10:00:00Z',
          transactions: ['tx_001', 'tx_002'],
          merkleRoot: this.generateHash('merkle root 1'),
          validator: this.generateWalletAddress()
        },
        {
          height: 12346,
          hash: this.generateHash('block 12346'),
          previousHash: this.generateHash('block 12345'),
          timestamp: '2024-01-15T11:00:00Z',
          transactions: ['tx_003', 'tx_004'],
          merkleRoot: this.generateHash('merkle root 2'),
          validator: this.generateWalletAddress()
        }
      ],
      network: {
        networkId: 'testnet',
        consensusNodes: [
          {
            id: 'node_1',
            address: this.generateWalletAddress(),
            publicKey: this.generatePublicKey(),
            status: 'active'
          },
          {
            id: 'node_2',
            address: this.generateWalletAddress(),
            publicKey: this.generatePublicKey(),
            status: 'active'
          },
          {
            id: 'node_3',
            address: this.generateWalletAddress(),
            publicKey: this.generatePublicKey(),
            status: 'active'
          }
        ],
        lastSnapshot: {
          height: 12346,
          hash: this.generateHash('snapshot 12346'),
          timestamp: '2024-01-15T11:00:00Z'
        }
      }
    };

    await fs.writeFile(
      path.join(outputDir, 'blockchain-test-data.json'),
      JSON.stringify(blockchainData, null, 2)
    );

    // Generate individual transaction files
    for (const tx of blockchainData.transactions) {
      await fs.writeFile(
        path.join(outputDir, `transaction-${tx.id}.json`),
        JSON.stringify(tx, null, 2)
      );
    }
  }

  /**
   * Generate cryptographic hash
   */
  generateHash(input) {
    return crypto.createHash('sha256').update(input + Date.now()).digest('hex');
  }

  /**
   * Generate wallet address
   */
  generateWalletAddress() {
    const prefix = 'DAG';
    const address = crypto.randomBytes(20).toString('hex');
    return prefix + address;
  }

  /**
   * Generate public key
   */
  generatePublicKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate digital signature
   */
  generateSignature() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Generate test API keys
   */
  static generateAPIKeys() {
    return {
      extensionApiKey: 'ext_' + crypto.randomBytes(32).toString('hex'),
      internalApiKey: 'int_' + crypto.randomBytes(32).toString('hex'),
      webhookSecret: 'whk_' + crypto.randomBytes(32).toString('hex'),
      jwtSecret: crypto.randomBytes(64).toString('hex')
    };
  }

  /**
   * Generate test configuration
   */
  static generateTestConfig() {
    return {
      api: {
        baseUrl: 'http://localhost:3001',
        timeout: 30000,
        retries: 3
      },
      frontend: {
        url: 'http://localhost:3000'
      },
      metagraph: {
        url: 'http://localhost:9000',
        networkId: 'testnet'
      },
      database: {
        host: 'localhost',
        port: 5432,
        name: 'proofvault_test',
        user: 'postgres',
        password: 'password'
      },
      test: {
        timeout: 300000,
        retries: 3,
        parallel: false,
        browsers: ['chrome'],
        screenshotOnFailure: true,
        recordVideo: false
      }
    };
  }
}

module.exports = TestDataGenerator;