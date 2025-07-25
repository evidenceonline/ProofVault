/**
 * PDF Routes
 * 
 * Handles PDF registration, verification, validation, and history endpoints
 * for the ProofVault blockchain-powered digital notary system.
 */

const express = require('express');
const multer = require('multer');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const logger = require('../utils/logger');
const metagraphService = require('../services/metagraph');
const databaseService = require('../services/database');
const pdfService = require('../services/pdf');
const authMiddleware = require('../middleware/auth');
const { webSocketService } = require('../services/websocket');
const AuditMiddleware = require('../middleware/audit');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024 || 10 * 1024 * 1024, // 10MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Rate limiting for PDF operations
const pdfRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    error: 'Too many PDF operations, please try again later',
    code: 'PDF_RATE_LIMITED'
  }
});

/**
 * POST /api/pdf/register
 * Register PDF evidence on the blockchain
 */
router.post('/register',
  pdfRateLimit,
  [
    body('hash')
      .isLength({ min: 64, max: 64 })
      .matches(/^[a-fA-F0-9]{64}$/)
      .withMessage('Hash must be a valid 64-character hexadecimal string'),
    body('metadata')
      .isObject()
      .withMessage('Metadata must be an object'),
    body('metadata.originalUrl')
      .isURL()
      .withMessage('Original URL must be valid'),
    body('metadata.captureTimestamp')
      .isISO8601()
      .withMessage('Capture timestamp must be valid ISO8601 date'),
    body('metadata.submitterAddress')
      .isLength({ min: 10 })
      .withMessage('Submitter address is required'),
    body('signature')
      .isLength({ min: 1 })
      .withMessage('Digital signature is required'),
    body('pdfData')
      .isBase64()
      .withMessage('PDF data must be base64 encoded')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { hash, metadata, signature, pdfData } = req.body;
      const startTime = Date.now();

      logger.info(`PDF registration request: ${hash.substring(0, 16)}...`);

      // Check if hash already exists
      const existingRecord = await databaseService.findEvidenceRecordByHash(hash);
      if (existingRecord) {
        return res.status(409).json({
          error: 'PDF hash already registered',
          code: 'DUPLICATE_HASH',
          evidenceRecord: existingRecord
        });
      }

      // Decode and validate PDF data
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      const calculatedHash = pdfService.calculateHash(pdfBuffer);
      
      if (calculatedHash !== hash) {
        return res.status(400).json({
          error: 'Hash mismatch: calculated hash does not match provided hash',
          code: 'HASH_MISMATCH',
          calculatedHash,
          providedHash: hash
        });
      }

      // Validate hash format using metagraph validation
      if (!metagraphService.isValidHash(hash)) {
        return res.status(400).json({
          error: 'Invalid hash format',
          code: 'INVALID_HASH_FORMAT',
          message: 'Hash must be a valid 64-character hexadecimal string'
        });
      }

      // Process PDF file
      const pdfInfo = await pdfService.processPDF({
        buffer: pdfBuffer,
        originalname: `evidence_${hash}.pdf`,
        size: pdfBuffer.length,
        mimetype: 'application/pdf'
      }, metadata);

      // Create evidence record in database with enhanced metadata
      const evidenceRecord = await databaseService.createEvidenceRecord({
        hash,
        originalUrl: metadata.originalUrl,
        documentTitle: metadata.documentTitle || metadata.title || 'Unknown Document',
        mimeType: 'application/pdf',
        fileSize: pdfBuffer.length,
        captureTimestamp: metadata.captureTimestamp,
        captureUserAgent: metadata.captureUserAgent,
        captureViewportSize: metadata.captureViewportSize,
        submitterAddress: metadata.submitterAddress,
        submitterSignature: signature,
        localFilePath: pdfInfo.filePath,
        ipfsHash: null, // TODO: Implement IPFS storage
        storageBackend: 'local',
        metadata: {
          ...metadata,
          pdfInfo: {
            pageCount: pdfInfo.metadata.pageCount,
            textLength: pdfInfo.metadata.textLength
          },
          registrationVersion: '1.0',
          networkType: 'constellation',
          processingNode: process.env.NODE_ID || 'api-server'
        }
      });

      // Log PDF registration audit
      await AuditMiddleware.logPDFRegistration(evidenceRecord, metadata, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: 'api',
        actorType: 'api_user'
      });

      // Update status to processing
      await databaseService.updateEvidenceRecordStatus(evidenceRecord.id, 'processing');
      
      // Notify WebSocket subscribers of processing start
      webSocketService.notifyPDFProcessingUpdate(evidenceRecord.id, 'processing', {
        hash: hash.substring(0, 16) + '...',\n        submitterAddress: metadata.submitterAddress,
        documentTitle: metadata.documentTitle || metadata.title,
        source: 'api'
      });

      // Submit to metagraph using Scala PDFRegistrationData format
      try {
        const blockchainResult = await metagraphService.registerPDF({
          hash,
          metadata: {
            originalUrl: metadata.originalUrl,
            captureTimestamp: metadata.captureTimestamp,
            documentTitle: metadata.documentTitle || metadata.title || 'Unknown Document',
            submitterAddress: metadata.submitterAddress,
            ...evidenceRecord.metadata
          },
          signature,
          submitterAddress: metadata.submitterAddress
        });

        // Create blockchain transaction record with enhanced data
        await databaseService.createBlockchainTransaction({
          txHash: blockchainResult.transactionHash,
          evidenceRecordId: evidenceRecord.id,
          transactionType: 'register_pdf',
          blockHeight: blockchainResult.blockNumber,
          rawTransaction: {
            ...blockchainResult,
            pdfRecord: blockchainResult.pdfRecord,
            layer: blockchainResult.layer,
            scalaPDFRegistrationData: true
          }
        });

        // Update evidence record with blockchain data including PDFRecord ID
        const updatedRecord = await databaseService.updateEvidenceRecordBlockchain(
          evidenceRecord.id,
          {
            metagraphTxHash: blockchainResult.transactionHash,
            metagraphBlockHeight: blockchainResult.blockNumber,
            blockchainTimestamp: blockchainResult.timestamp,
            consensusConfirmationCount: 0,
            status: 'confirmed'
          }
        );

        const processingTime = Date.now() - startTime;
        logger.info(`PDF registration completed: ${hash.substring(0, 16)}... (${processingTime}ms)`);

        // Log blockchain submission audit
        await AuditMiddleware.logBlockchainSubmission(evidenceRecord, blockchainResult, {
          method: 'api',
          processingTime: processingTime
        });

        // Notify WebSocket subscribers of successful completion
        webSocketService.notifyPDFProcessingUpdate(evidenceRecord.id, 'confirmed', {
          hash: hash.substring(0, 16) + '...',
          submitterAddress: metadata.submitterAddress,
          documentTitle: metadata.documentTitle || metadata.title,
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          processingTimeMs: processingTime,
          source: 'api'
        });

        res.status(201).json({
          success: true,
          transactionHash: blockchainResult.transactionHash,
          registrationId: blockchainResult.registrationId,
          evidenceRecordId: evidenceRecord.id,
          blockNumber: blockchainResult.blockNumber,
          timestamp: blockchainResult.timestamp,
          pdfRecord: blockchainResult.pdfRecord,
          evidenceRecord: updatedRecord,
          processingTimeMs: processingTime,
          layer: blockchainResult.layer
        });

      } catch (blockchainError) {
        logger.error('Blockchain registration failed:', blockchainError);
        
        // Update status to failed
        await databaseService.updateEvidenceRecordStatus(
          evidenceRecord.id,
          'failed',
          blockchainError.message
        );

        // Notify WebSocket subscribers of failure
        webSocketService.notifyPDFProcessingUpdate(evidenceRecord.id, 'failed', {
          hash: hash.substring(0, 16) + '...',
          submitterAddress: metadata.submitterAddress,
          documentTitle: metadata.documentTitle || metadata.title,
          error: blockchainError.message,
          source: 'api'
        });

        res.status(500).json({
          error: 'Blockchain registration failed',
          code: 'BLOCKCHAIN_ERROR',
          message: blockchainError.message,
          evidenceRecord: evidenceRecord
        });
      }

    } catch (error) {
      logger.error('PDF registration error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/pdf/verify/:hash
 * Verify PDF hash against blockchain
 */
router.get('/verify/:hash',
  [
    param('hash')
      .isLength({ min: 64, max: 64 })
      .matches(/^[a-fA-F0-9]{64}$/)
      .withMessage('Hash must be a valid 64-character hexadecimal string')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { hash } = req.params;
      const startTime = Date.now();

      logger.info(`PDF verification request: ${hash.substring(0, 16)}...`);

      // Log verification attempt
      const verificationAttempt = await databaseService.logVerificationAttempt({
        submittedHash: hash,
        verificationResult: 'not_found', // Will update if found
        requesterIp: req.ip,
        requesterUserAgent: req.get('User-Agent'),
        requesterAddress: req.get('X-User-Address'),
        verificationMethod: req.get('X-Extension-Version') ? 'extension' : 'api',
        additionalData: {
          userAgent: req.get('User-Agent'),
          extensionVersion: req.get('X-Extension-Version')
        }
      });

      // Check local database first (faster)
      let evidenceRecord = await databaseService.findEvidenceRecordByHash(hash);
      let blockchainResult = null;

      if (evidenceRecord && evidenceRecord.status === 'confirmed') {
        // Found in local database and confirmed
        blockchainResult = {
          verified: true,
          data: {
            hash: evidenceRecord.hash,
            submitterAddress: evidenceRecord.submitterAddress,
            registrationTimestamp: evidenceRecord.blockchainTimestamp || evidenceRecord.createdAt,
            blockNumber: evidenceRecord.metagraphBlockHeight,
            transactionHash: evidenceRecord.metagraphTxHash,
            metadata: evidenceRecord.metadata,
            evidenceRecord,
            source: 'localDatabase'
          }
        };
      } else {
        // Query blockchain directly using Scala state structures
        blockchainResult = await metagraphService.verifyPDF(hash);
        
        if (blockchainResult.verified && !evidenceRecord) {
          // Found on blockchain but not in local database
          // This could happen if the record was registered on another node
          logger.info(`Hash found on blockchain but not in local database: ${hash}`);
          
          // Optionally sync the record to local database for future lookups
          if (blockchainResult.data.pdfRecord) {
            try {
              await syncPDFRecordFromBlockchain(blockchainResult.data.pdfRecord);
            } catch (syncError) {
              logger.warn('Failed to sync PDF record from blockchain:', syncError.message);
            }
          }
        }
      }

      // Update verification attempt with result
      const verificationResult = blockchainResult.verified ? 'valid' : 'not_found';
      const processingTime = Date.now() - startTime;

      // Log verification attempt audit
      await AuditMiddleware.logVerificationAttempt(hash, blockchainResult, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userAddress: req.get('X-User-Address'),
        method: req.get('X-Extension-Version') ? 'extension' : 'api',
        extensionId: req.get('X-Extension-ID'),
        processingTime: processingTime,
        actorType: req.get('X-Extension-Version') ? 'extension' : 'api_user'
      });

      await databaseService.logVerificationAttempt({
        submittedHash: hash,
        matchedEvidenceId: evidenceRecord?.id,
        verificationResult,
        requesterIp: req.ip,
        requesterUserAgent: req.get('User-Agent'),
        requesterAddress: req.get('X-User-Address'),
        verificationMethod: req.get('X-Extension-Version') ? 'extension' : 'api',
        additionalData: {
          userAgent: req.get('User-Agent'),
          extensionVersion: req.get('X-Extension-Version'),
          foundInLocalDB: !!evidenceRecord
        },
        verificationDurationMs: processingTime
      });

      if (blockchainResult.verified) {
        logger.info(`PDF verification successful: ${hash.substring(0, 16)}... (${processingTime}ms)`);
        
        // Enhanced response with additional verification metadata
        const verificationResponse = {
          ...blockchainResult,
          verificationMetadata: {
            verificationTimestamp: new Date().toISOString(),
            processingTimeMs: processingTime,
            source: blockchainResult.data.source,
            networkType: 'constellation',
            apiVersion: '1.0'
          }
        };
        
        res.json(verificationResponse);
      } else {
        logger.info(`PDF verification failed: ${hash.substring(0, 16)}... (${processingTime}ms)`);
        
        const failureResponse = {
          ...blockchainResult,
          verificationMetadata: {
            verificationTimestamp: new Date().toISOString(),
            processingTimeMs: processingTime,
            searchedLayers: blockchainResult.searchedLayers || ['database', 'metagraph'],
            networkType: 'constellation',
            apiVersion: '1.0'
          }
        };
        
        res.status(404).json(failureResponse);
      }

    } catch (error) {
      logger.error('PDF verification error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/pdf/validate
 * Upload PDF file to validate hash and integrity
 */
router.post('/validate',
  upload.single('pdf'),
  [
    body('expectedHash')
      .optional()
      .isLength({ min: 64, max: 64 })
      .matches(/^[a-fA-F0-9]{64}$/)
      .withMessage('Expected hash must be a valid 64-character hexadecimal string')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No PDF file uploaded',
          code: 'NO_FILE'
        });
      }

      const { expectedHash } = req.body;
      const startTime = Date.now();

      logger.info(`PDF validation request: ${req.file.originalname} (${req.file.size} bytes)`);

      // Calculate hash
      const calculatedHash = pdfService.calculateHash(req.file.buffer);
      
      // Validate PDF structure
      const validation = await pdfService.validatePDF(req.file);
      
      const result = {
        isValid: validation.isValid,
        calculatedHash,
        expectedHash,
        fileSize: req.file.size,
        fileName: req.file.originalname,
        processingTimeMs: Date.now() - startTime
      };

      if (expectedHash) {
        result.hashMatches = calculatedHash === expectedHash;
        result.message = result.hashMatches 
          ? 'PDF hash matches expected value'
          : 'PDF hash does not match expected value';
      } else {
        result.message = validation.isValid 
          ? 'PDF is valid'
          : `PDF validation failed: ${validation.errors.join(', ')}`;
      }

      if (!validation.isValid) {
        result.errors = validation.errors;
      }

      logger.info(`PDF validation completed: ${calculatedHash.substring(0, 16)}... (${result.processingTimeMs}ms)`);

      res.json(result);

    } catch (error) {
      logger.error('PDF validation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/pdf/history/:address
 * Get submission history for a specific address
 */
router.get('/history/:address',
  [
    param('address')
      .isLength({ min: 10 })
      .withMessage('Address must be at least 10 characters'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'confirmed', 'failed', 'rejected'])
      .withMessage('Invalid status value'),
    query('sortBy')
      .optional()
      .isIn(['created_at', 'updated_at', 'capture_timestamp', 'file_size'])
      .withMessage('Invalid sortBy field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { address } = req.params;
      const {
        page = 1,
        limit = 20,
        status,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      logger.info(`History request for address: ${address.substring(0, 16)}...`);

      // Get records from local database
      const localResult = await databaseService.getEvidenceRecordsBySubmitter(address, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        sortBy,
        sortOrder
      });

      // Optionally augment with blockchain data if requested
      const includeBlockchainData = req.query.includeBlockchain === 'true';
      let blockchainResult = null;
      
      if (includeBlockchainData) {
        try {
          blockchainResult = await metagraphService.getPDFsBySubmitter(address, {
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
          });
        } catch (error) {
          logger.warn('Failed to get blockchain data for address history:', error.message);
        }
      }

      const response = {
        ...localResult,
        metadata: {
          requestTimestamp: new Date().toISOString(),
          address: address,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(localResult.totalCount / parseInt(limit))
          },
          filters: {
            status,
            sortBy,
            sortOrder
          },
          blockchainDataIncluded: includeBlockchainData,
          networkType: 'constellation'
        }
      };

      if (blockchainResult) {
        response.blockchainData = blockchainResult;
      }

      res.json(response);

    } catch (error) {
      logger.error('History retrieval error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * Helper function to sync PDF record from blockchain to local database
 */
async function syncPDFRecordFromBlockchain(pdfRecord) {
  try {
    // Check if record already exists
    const existingRecord = await databaseService.findEvidenceRecordByHash(pdfRecord.hash);
    if (existingRecord) {
      return existingRecord;
    }

    // Create new evidence record from blockchain data
    const evidenceRecord = await databaseService.createEvidenceRecord({
      hash: pdfRecord.hash,
      originalUrl: pdfRecord.url,
      documentTitle: pdfRecord.title,
      mimeType: 'application/pdf',
      fileSize: 0, // Unknown from blockchain data
      captureTimestamp: new Date(pdfRecord.captureTimestamp).toISOString(),
      captureUserAgent: 'Unknown',
      captureViewportSize: null,
      submitterAddress: pdfRecord.submitterAddress,
      submitterSignature: null,
      localFilePath: null,
      ipfsHash: null,
      storageBackend: 'blockchain',
      metadata: {
        ...pdfRecord.metadata,
        syncedFromBlockchain: true,
        registrationId: pdfRecord.registrationId
      }
    });

    // Update with confirmed blockchain status
    await databaseService.updateEvidenceRecordStatus(evidenceRecord.id, 'confirmed');

    logger.info(`Synced PDF record from blockchain: ${pdfRecord.hash.substring(0, 16)}...`);
    return evidenceRecord;

  } catch (error) {
    logger.error('Failed to sync PDF record from blockchain:', error);
    throw error;
  }
}

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: process.env.MAX_FILE_SIZE_MB || 10
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field',
        code: 'UNEXPECTED_FILE'
      });
    }
  }
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      error: 'Invalid file type',
      code: 'INVALID_FILE_TYPE',
      message: 'Only PDF files are allowed'
    });
  }
  
  next(error);
});

module.exports = router;