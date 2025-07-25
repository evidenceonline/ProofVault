/**
 * Chrome Extension Routes
 * 
 * Specialized endpoints for Chrome extension integration with ProofVault.
 * Handles Base64 PDF data, extension authentication, and real-time status updates.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const logger = require('../utils/logger');
const metagraphService = require('../services/metagraph');
const databaseService = require('../services/database');
const pdfService = require('../services/pdf');
const { webSocketService } = require('../services/websocket');
const AuditMiddleware = require('../middleware/audit');

const router = express.Router();

// Extension-specific rate limiting (more permissive for legitimate extension use)
const extensionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window for extension
  message: {
    error: 'Extension rate limit exceeded, please try again later',
    code: 'EXTENSION_RATE_LIMITED'
  },
  keyGenerator: (req) => {
    // Use extension ID + user address for rate limiting
    const extensionId = req.get('X-Extension-ID') || 'unknown';
    const userAddress = req.get('X-User-Address') || req.ip;
    return `ext_${extensionId}_${userAddress}`;
  }
});

// Extension authentication middleware
const extensionAuth = (req, res, next) => {
  const extensionId = req.get('X-Extension-ID');
  const extensionVersion = req.get('X-Extension-Version');
  const userAddress = req.get('X-User-Address');

  // Basic extension validation
  if (!extensionId || !extensionVersion) {
    return res.status(401).json({
      error: 'Extension authentication required',
      code: 'EXTENSION_AUTH_REQUIRED',
      requiredHeaders: ['X-Extension-ID', 'X-Extension-Version']
    });
  }

  // TODO: Validate extension ID against known extension IDs
  // For now, accept any extension ID that looks valid
  if (extensionId.length < 10) {
    return res.status(401).json({
      error: 'Invalid extension ID',
      code: 'INVALID_EXTENSION_ID'
    });
  }

  req.extension = {
    id: extensionId,
    version: extensionVersion,
    userAddress: userAddress
  };

  next();
};

/**
 * POST /api/extension/capture
 * Submit captured PDF from Chrome extension
 */
router.post('/capture',
  extensionRateLimit,
  extensionAuth,
  [
    body('pdfData')
      .isBase64()
      .withMessage('PDF data must be base64 encoded'),
    body('metadata')
      .isObject()
      .withMessage('Metadata must be an object'),
    body('metadata.originalUrl')
      .isURL()
      .withMessage('Original URL must be valid'),
    body('metadata.documentTitle')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Document title is required and must be 1-500 characters'),
    body('metadata.captureTimestamp')
      .isISO8601()
      .withMessage('Capture timestamp must be valid ISO8601 date'),
    body('metadata.submitterAddress')
      .isLength({ min: 10 })
      .withMessage('Submitter address is required'),
    body('signature')
      .isLength({ min: 1 })
      .withMessage('Digital signature is required')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { pdfData, metadata, signature } = req.body;
      const startTime = Date.now();

      logger.info(`Extension PDF capture: ${metadata.originalUrl} from extension ${req.extension.id}`);

      // Decode and validate PDF data
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      
      // Validate PDF size (10MB limit for extension)
      const maxSizeMB = 10;
      if (pdfBuffer.length > maxSizeMB * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          error: 'PDF file too large',
          code: 'FILE_TOO_LARGE',
          maxSizeMB: maxSizeMB,
          actualSizeMB: Math.round(pdfBuffer.length / (1024 * 1024) * 100) / 100
        });
      }

      // Calculate and validate hash
      const calculatedHash = pdfService.calculateHash(pdfBuffer);
      
      if (!metagraphService.isValidHash(calculatedHash)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid calculated hash format',
          code: 'INVALID_HASH_FORMAT'
        });
      }

      // Check for duplicate hash
      const existingRecord = await databaseService.findEvidenceRecordByHash(calculatedHash);
      if (existingRecord) {
        return res.status(409).json({
          success: false,
          error: 'PDF already registered',
          code: 'DUPLICATE_HASH',
          hash: calculatedHash,
          existingRecord: {
            id: existingRecord.id,
            hash: existingRecord.hash,
            originalUrl: existingRecord.originalUrl,
            submitterAddress: existingRecord.submitterAddress,
            status: existingRecord.status,
            createdAt: existingRecord.createdAt
          }
        });
      }

      // Process PDF file
      const pdfInfo = await pdfService.processPDF({
        buffer: pdfBuffer,
        originalname: `extension_capture_${calculatedHash}.pdf`,
        size: pdfBuffer.length,
        mimetype: 'application/pdf'
      }, metadata);

      // Create evidence record with extension metadata
      const evidenceRecord = await databaseService.createEvidenceRecord({
        hash: calculatedHash,
        originalUrl: metadata.originalUrl,
        documentTitle: metadata.documentTitle,
        mimeType: 'application/pdf',
        fileSize: pdfBuffer.length,
        captureTimestamp: metadata.captureTimestamp,
        captureUserAgent: metadata.captureUserAgent || req.get('User-Agent'),
        captureViewportSize: metadata.captureViewportSize,
        submitterAddress: metadata.submitterAddress,
        submitterSignature: signature,
        localFilePath: pdfInfo.filePath,
        ipfsHash: null,
        storageBackend: 'local',
        metadata: {
          ...metadata,
          pdfInfo: {
            pageCount: pdfInfo.metadata.pageCount,
            textLength: pdfInfo.metadata.textLength
          },
          extensionCapture: {
            extensionId: req.extension.id,
            extensionVersion: req.extension.version,
            captureMethod: 'chrome-extension'
          },
          registrationVersion: '1.0',
          networkType: 'constellation'
        }
      });

      // Log extension PDF registration audit
      await AuditMiddleware.logPDFRegistration(evidenceRecord, metadata, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: 'extension',
        actorType: 'extension',
        extensionId: req.extension.id
      });

      // Update status to processing
      await databaseService.updateEvidenceRecordStatus(evidenceRecord.id, 'processing');

      // Notify WebSocket subscribers that processing has started
      webSocketService.notifyExtensionPDFUpdate(
        evidenceRecord.id, 
        'processing', 
        req.extension.id,
        {
          hash: calculatedHash.substring(0, 16) + '...',
          submitterAddress: metadata.submitterAddress,
          documentTitle: metadata.documentTitle,
          fileSize: pdfBuffer.length,
          source: 'extension'
        }
      );

      // Submit to metagraph asynchronously
      setImmediate(async () => {
        try {
          const blockchainResult = await metagraphService.registerPDF({
            hash: calculatedHash,
            metadata: {
              originalUrl: metadata.originalUrl,
              captureTimestamp: metadata.captureTimestamp,
              documentTitle: metadata.documentTitle,
              submitterAddress: metadata.submitterAddress,
              ...evidenceRecord.metadata
            },
            signature,
            submitterAddress: metadata.submitterAddress
          });

          // Create blockchain transaction record
          await databaseService.createBlockchainTransaction({
            txHash: blockchainResult.transactionHash,
            evidenceRecordId: evidenceRecord.id,
            transactionType: 'register_pdf',
            blockHeight: blockchainResult.blockNumber,
            rawTransaction: {
              ...blockchainResult,
              pdfRecord: blockchainResult.pdfRecord,
              layer: blockchainResult.layer,
              extensionSubmission: true
            }
          });

          // Update evidence record with blockchain data
          await databaseService.updateEvidenceRecordBlockchain(
            evidenceRecord.id,
            {
              metagraphTxHash: blockchainResult.transactionHash,
              metagraphBlockHeight: blockchainResult.blockNumber,
              blockchainTimestamp: blockchainResult.timestamp,
              consensusConfirmationCount: 0,
              status: 'confirmed'
            }
          );

          // Create audit log
          await databaseService.createAuditLog({
            action: 'PDF_REGISTERED_VIA_EXTENSION',
            resourceType: 'evidence_record',
            resourceId: evidenceRecord.id,
            actorType: 'extension',
            actorAddress: metadata.submitterAddress,
            sourceIp: req.ip,
            userAgent: req.get('User-Agent'),
            contextData: {
              extensionId: req.extension.id,
              extensionVersion: req.extension.version,
              hash: calculatedHash,
              transactionHash: blockchainResult.transactionHash
            }
          });

          // Notify WebSocket subscribers of successful completion
          webSocketService.notifyExtensionPDFUpdate(
            evidenceRecord.id,
            'confirmed',
            req.extension.id,
            {
              hash: calculatedHash.substring(0, 16) + '...',
              submitterAddress: metadata.submitterAddress,
              documentTitle: metadata.documentTitle,
              transactionHash: blockchainResult.transactionHash,
              blockNumber: blockchainResult.blockNumber,
              source: 'extension'
            }
          );

          logger.info(`Extension PDF registration completed: ${calculatedHash.substring(0, 16)}... via ${req.extension.id}`);

        } catch (blockchainError) {
          logger.error('Extension PDF blockchain registration failed:', blockchainError);
          
          await databaseService.updateEvidenceRecordStatus(
            evidenceRecord.id,
            'failed',
            blockchainError.message
          );

          // Notify WebSocket subscribers of failure
          webSocketService.notifyExtensionPDFUpdate(
            evidenceRecord.id,
            'failed',
            req.extension.id,
            {
              hash: calculatedHash.substring(0, 16) + '...',
              submitterAddress: metadata.submitterAddress,
              documentTitle: metadata.documentTitle,
              error: blockchainError.message,
              source: 'extension'
            }
          );
        }
      });

      const processingTime = Date.now() - startTime;

      // Return immediate response to extension
      res.status(202).json({
        success: true,
        message: 'PDF capture received and processing started',
        evidenceRecord: {
          id: evidenceRecord.id,
          hash: calculatedHash,
          status: 'processing',
          originalUrl: metadata.originalUrl,
          documentTitle: metadata.documentTitle,
          fileSize: pdfBuffer.length,
          submitterAddress: metadata.submitterAddress
        },
        processingTimeMs: processingTime,
        statusCheckUrl: `/api/extension/status/${evidenceRecord.id}`,
        estimatedProcessingTimeMs: 5000
      });

    } catch (error) {
      logger.error('Extension PDF capture error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/extension/status/:evidenceId
 * Check processing status of submitted PDF
 */
router.get('/status/:evidenceId',
  extensionAuth,
  [
    param('evidenceId')
      .isUUID()
      .withMessage('Evidence ID must be a valid UUID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { evidenceId } = req.params;
      
      const evidenceRecord = await databaseService.findEvidenceRecordById(evidenceId);
      
      if (!evidenceRecord) {
        return res.status(404).json({
          success: false,
          error: 'Evidence record not found',
          code: 'EVIDENCE_NOT_FOUND'
        });
      }

      // Check if this extension submitted this record
      const isOwnRecord = evidenceRecord.metadata?.extensionCapture?.extensionId === req.extension.id;
      
      if (!isOwnRecord && evidenceRecord.submitterAddress !== req.extension.userAddress) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this evidence record',
          code: 'ACCESS_DENIED'
        });
      }

      const statusResponse = {
        success: true,
        evidenceRecord: {
          id: evidenceRecord.id,
          hash: evidenceRecord.hash,
          status: evidenceRecord.status,
          originalUrl: evidenceRecord.originalUrl,
          documentTitle: evidenceRecord.documentTitle,
          submitterAddress: evidenceRecord.submitterAddress,
          processingStartedAt: evidenceRecord.processingStartedAt,
          processingCompletedAt: evidenceRecord.processingCompletedAt,
          metagraphTxHash: evidenceRecord.metagraphTxHash,
          errorMessage: evidenceRecord.errorMessage,
          createdAt: evidenceRecord.createdAt,
          updatedAt: evidenceRecord.updatedAt
        },
        statusTimestamp: new Date().toISOString()
      };

      // Add additional data based on status
      if (evidenceRecord.status === 'confirmed' && evidenceRecord.metagraphTxHash) {
        statusResponse.verificationUrl = `/api/extension/verify/${evidenceRecord.hash}`;
        statusResponse.blockchainExplorer = {
          transactionHash: evidenceRecord.metagraphTxHash,
          blockHeight: evidenceRecord.metagraphBlockHeight
        };
      }

      res.json(statusResponse);

    } catch (error) {
      logger.error('Extension status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/extension/verify/:hash
 * Quick verification endpoint for extension
 */
router.get('/verify/:hash',
  extensionAuth,
  [
    param('hash')
      .isLength({ min: 64, max: 64 })
      .matches(/^[a-fA-F0-9]{64}$/)
      .withMessage('Hash must be a valid 64-character hexadecimal string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { hash } = req.params;
      const startTime = Date.now();

      logger.info(`Extension verification request: ${hash.substring(0, 16)}... from ${req.extension.id}`);

      // Log verification attempt with extension context
      await databaseService.logVerificationAttempt({
        submittedHash: hash,
        verificationResult: 'not_found', // Will update if found
        requesterIp: req.ip,
        requesterUserAgent: req.get('User-Agent'),
        requesterAddress: req.extension.userAddress,
        verificationMethod: 'extension',
        additionalData: {
          extensionId: req.extension.id,
          extensionVersion: req.extension.version
        }
      });

      // Check database first, then blockchain
      let evidenceRecord = await databaseService.findEvidenceRecordByHash(hash);
      let blockchainResult = null;

      if (evidenceRecord && evidenceRecord.status === 'confirmed') {
        blockchainResult = {
          verified: true,
          data: {
            hash: evidenceRecord.hash,
            submitterAddress: evidenceRecord.submitterAddress,
            registrationTimestamp: evidenceRecord.blockchainTimestamp || evidenceRecord.createdAt,
            blockNumber: evidenceRecord.metagraphBlockHeight,
            transactionHash: evidenceRecord.metagraphTxHash,
            metadata: evidenceRecord.metadata,
            source: 'localDatabase'
          }
        };
      } else {
        blockchainResult = await metagraphService.verifyPDF(hash);
      }

      const processingTime = Date.now() - startTime;
      const verificationResult = blockchainResult.verified ? 'valid' : 'not_found';

      // Log extension verification attempt audit
      await AuditMiddleware.logVerificationAttempt(hash, blockchainResult, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userAddress: req.extension.userAddress,
        method: 'extension',
        extensionId: req.extension.id,
        processingTime: processingTime,
        actorType: 'extension'
      });

      // Update verification attempt
      await databaseService.logVerificationAttempt({
        submittedHash: hash,
        matchedEvidenceId: evidenceRecord?.id,
        verificationResult,
        requesterIp: req.ip,
        requesterUserAgent: req.get('User-Agent'),
        requesterAddress: req.extension.userAddress,
        verificationMethod: 'extension',
        additionalData: {
          extensionId: req.extension.id,
          extensionVersion: req.extension.version,
          foundInLocalDB: !!evidenceRecord
        },
        verificationDurationMs: processingTime
      });

      const response = {
        success: true,
        verified: blockchainResult.verified,
        hash: hash,
        processingTimeMs: processingTime,
        verificationTimestamp: new Date().toISOString(),
        extensionMetadata: {
          extensionId: req.extension.id,
          extensionVersion: req.extension.version
        }
      };

      if (blockchainResult.verified) {
        response.evidenceData = blockchainResult.data;
        logger.info(`Extension verification successful: ${hash.substring(0, 16)}... (${processingTime}ms)`);
      } else {
        response.message = blockchainResult.message || 'Hash not found on blockchain';
        logger.info(`Extension verification failed: ${hash.substring(0, 16)}... (${processingTime}ms)`);
      }

      res.json(response);

    } catch (error) {
      logger.error('Extension verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/extension/history
 * Get submission history for extension user
 */
router.get('/history',
  extensionAuth,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'confirmed', 'failed', 'rejected'])
      .withMessage('Invalid status value')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      if (!req.extension.userAddress) {
        return res.status(400).json({
          success: false,
          error: 'User address required for history',
          code: 'USER_ADDRESS_REQUIRED'
        });
      }

      const {
        page = 1,
        limit = 20,
        status
      } = req.query;

      const result = await databaseService.getEvidenceRecordsBySubmitter(
        req.extension.userAddress,
        {
          page: parseInt(page),
          limit: parseInt(limit),
          status,
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      );

      res.json({
        success: true,
        ...result,
        extensionMetadata: {
          extensionId: req.extension.id,
          extensionVersion: req.extension.version,
          userAddress: req.extension.userAddress,
          requestTimestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Extension history error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/extension/info
 * Get extension information and API status
 */
router.get('/info',
  extensionAuth,
  async (req, res) => {
    try {
      const networkInfo = await metagraphService.getNetworkInfo();
      
      res.json({
        success: true,
        extensionInfo: {
          supportedVersion: '1.0.0',
          apiVersion: '1.0.0',
          maxFileSizeMB: 10,
          supportedFormats: ['pdf'],
          rateLimits: {
            requestsPerWindow: 50,
            windowMinutes: 15
          }
        },
        networkInfo: {
          networkName: networkInfo.networkName,
          status: networkInfo.status,
          blockHeight: networkInfo.blockHeight,
          nodeVersion: networkInfo.nodeVersion
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Extension info error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

module.exports = router;