/**
 * Audit Middleware
 * 
 * Comprehensive audit logging for ProofVault operations including
 * PDF submissions, verifications, and blockchain interactions.
 */

const logger = require('../utils/logger');
const databaseService = require('../services/database');

class AuditMiddleware {
  /**
   * Create audit middleware for request logging
   */
  static createRequestAuditMiddleware() {
    return async (req, res, next) => {
      // Store request start time
      req.auditContext = {
        startTime: Date.now(),
        requestId: this.generateRequestId(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers)
      };

      // Override res.json to capture response data
      const originalJson = res.json;
      res.json = function(data) {
        req.auditContext.responseData = data;
        req.auditContext.statusCode = res.statusCode;
        req.auditContext.responseTime = Date.now() - req.auditContext.startTime;
        return originalJson.call(this, data);
      };

      // Log the audit trail after response
      res.on('finish', async () => {
        try {
          await AuditMiddleware.logRequestAudit(req);
        } catch (error) {
          logger.error('Failed to log request audit:', error);
        }
      });

      next();
    };
  }

  /**
   * Log comprehensive request audit information
   */
  static async logRequestAudit(req) {
    const context = req.auditContext;
    const sensitiveEndpoints = ['/api/pdf/register', '/api/extension/capture', '/api/pdf/verify'];
    
    // Only log detailed audits for sensitive endpoints
    if (!sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
      return;
    }

    const auditData = {
      action: this.getActionFromRequest(req),
      resourceType: this.getResourceTypeFromPath(req.path),
      resourceId: this.extractResourceId(req),
      actorType: this.getActorType(req),
      actorId: req.user?.id || null,
      actorAddress: req.get('X-User-Address') || null,
      sourceIp: context.ip,
      userAgent: context.userAgent,
      contextData: {
        requestId: context.requestId,
        method: context.method,
        path: context.path,
        query: context.query,
        responseTime: context.responseTime,
        statusCode: context.statusCode,
        extensionId: req.get('X-Extension-ID'),
        extensionVersion: req.get('X-Extension-Version'),
        success: context.statusCode < 400
      }
    };

    // Add request/response data for critical operations
    if (req.method === 'POST' && req.path.includes('register')) {
      auditData.newValues = {
        hash: req.body.hash?.substring(0, 16) + '...' || 'unknown',
        originalUrl: req.body.metadata?.originalUrl,
        documentTitle: req.body.metadata?.documentTitle,
        submitterAddress: req.body.metadata?.submitterAddress
      };
    }

    await databaseService.createAuditLog(auditData);
  }

  /**
   * Create audit middleware for PDF operations
   */
  static createPDFAuditMiddleware() {
    return async (req, res, next) => {
      // Add PDF-specific audit context
      req.pdfAuditContext = {
        operation: this.getPDFOperation(req.path, req.method),
        startTime: Date.now()
      };

      next();
    };
  }

  /**
   * Log PDF registration audit
   */
  static async logPDFRegistration(evidenceRecord, metadata, userInfo = {}) {
    try {
      await databaseService.createAuditLog({
        action: 'PDF_REGISTRATION_INITIATED',
        resourceType: 'evidence_record',
        resourceId: evidenceRecord.id,
        actorType: userInfo.actorType || 'user',
        actorAddress: metadata.submitterAddress,
        sourceIp: userInfo.ip,
        userAgent: userInfo.userAgent,
        newValues: {
          hash: evidenceRecord.hash,
          originalUrl: evidenceRecord.originalUrl,
          documentTitle: evidenceRecord.documentTitle,
          fileSize: evidenceRecord.fileSize,
          submitterAddress: evidenceRecord.submitterAddress,
          storageBackend: evidenceRecord.storageBackend
        },
        contextData: {
          registrationMethod: userInfo.method || 'api',
          extensionId: userInfo.extensionId,
          captureTimestamp: metadata.captureTimestamp
        }
      });

      logger.info(`PDF registration audit logged: ${evidenceRecord.id}`);
    } catch (error) {
      logger.error('Failed to log PDF registration audit:', error);
    }
  }

  /**
   * Log blockchain submission audit
   */
  static async logBlockchainSubmission(evidenceRecord, transactionResult, userInfo = {}) {
    try {
      await databaseService.createAuditLog({
        action: 'BLOCKCHAIN_SUBMISSION_COMPLETED',
        resourceType: 'evidence_record',
        resourceId: evidenceRecord.id,
        actorType: 'system',
        contextData: {
          transactionHash: transactionResult.transactionHash,
          blockNumber: transactionResult.blockNumber,
          layer: transactionResult.layer,
          registrationId: transactionResult.registrationId,
          submissionMethod: userInfo.method || 'api',
          processingTimeMs: userInfo.processingTime
        }
      });

      logger.info(`Blockchain submission audit logged: ${transactionResult.transactionHash}`);
    } catch (error) {
      logger.error('Failed to log blockchain submission audit:', error);
    }
  }

  /**
   * Log verification attempt audit
   */
  static async logVerificationAttempt(hash, result, userInfo = {}) {
    try {
      await databaseService.createAuditLog({
        action: 'PDF_VERIFICATION_ATTEMPTED',
        resourceType: 'verification_attempt',
        resourceId: null,
        actorType: userInfo.actorType || 'user',
        actorAddress: userInfo.userAddress,
        sourceIp: userInfo.ip,
        userAgent: userInfo.userAgent,
        contextData: {
          submittedHash: hash,
          verificationResult: result.verified ? 'valid' : 'not_found',
          verificationSource: result.data?.source,
          verificationMethod: userInfo.method || 'api',
          extensionId: userInfo.extensionId,
          processingTimeMs: userInfo.processingTime,
          foundInLocalDB: result.data?.source === 'localDatabase'
        }
      });

      logger.debug(`Verification attempt audit logged: ${hash.substring(0, 16)}...`);
    } catch (error) {
      logger.error('Failed to log verification attempt audit:', error);
    }
  }

  /**
   * Log extension operation audit
   */
  static async logExtensionOperation(operation, data, userInfo = {}) {
    try {
      await databaseService.createAuditLog({
        action: `EXTENSION_${operation.toUpperCase()}`,
        resourceType: 'extension_operation',
        resourceId: data.evidenceRecordId || null,
        actorType: 'extension',
        actorAddress: userInfo.userAddress,
        sourceIp: userInfo.ip,
        userAgent: userInfo.userAgent,
        contextData: {
          extensionId: userInfo.extensionId,
          extensionVersion: userInfo.extensionVersion,
          operation: operation,
          data: {
            ...data,
            // Sanitize sensitive data
            hash: data.hash ? data.hash.substring(0, 16) + '...' : undefined
          }
        }
      });

      logger.debug(`Extension operation audit logged: ${operation} by ${userInfo.extensionId}`);
    } catch (error) {
      logger.error('Failed to log extension operation audit:', error);
    }
  }

  /**
   * Log system event audit
   */
  static async logSystemEvent(event, data = {}) {
    try {
      await databaseService.createAuditLog({
        action: `SYSTEM_${event.toUpperCase()}`,
        resourceType: 'system_event',
        resourceId: null,
        actorType: 'system',
        contextData: {
          event: event,
          timestamp: new Date().toISOString(),
          nodeId: process.env.NODE_ID || 'unknown',
          ...data
        }
      });

      logger.info(`System event audit logged: ${event}`);
    } catch (error) {
      logger.error('Failed to log system event audit:', error);
    }
  }

  /**
   * Helper methods
   */
  static generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  static getActionFromRequest(req) {
    const pathActions = {
      '/api/pdf/register': 'PDF_REGISTER',
      '/api/pdf/verify': 'PDF_VERIFY',
      '/api/pdf/validate': 'PDF_VALIDATE',
      '/api/pdf/history': 'PDF_HISTORY',
      '/api/extension/capture': 'EXTENSION_CAPTURE',
      '/api/extension/verify': 'EXTENSION_VERIFY',
      '/api/extension/status': 'EXTENSION_STATUS',
      '/api/extension/history': 'EXTENSION_HISTORY'
    };

    for (const [path, action] of Object.entries(pathActions)) {
      if (req.path.startsWith(path)) {
        return `${action}_${req.method}`;
      }
    }

    return `${req.method}_${req.path.replace(/\//g, '_').toUpperCase()}`;
  }

  static getResourceTypeFromPath(path) {
    if (path.includes('/pdf/')) return 'evidence_record';
    if (path.includes('/extension/')) return 'extension_operation';
    if (path.includes('/users/')) return 'user';
    if (path.includes('/transactions/')) return 'blockchain_transaction';
    return 'unknown';
  }

  static extractResourceId(req) {
    // Extract IDs from path parameters
    const pathParts = req.path.split('/');
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Look for UUID pattern or hash pattern
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(part)) {
        return part; // UUID
      }
      if (/^[a-fA-F0-9]{64}$/.test(part)) {
        return part; // Hash
      }
    }
    return null;
  }

  static getActorType(req) {
    if (req.get('X-Extension-ID')) return 'extension';
    if (req.get('X-API-Key')) return 'api_client';
    if (req.user) return 'authenticated_user';
    return 'anonymous';
  }

  static getPDFOperation(path, method) {
    if (path.includes('/register')) return 'register';
    if (path.includes('/verify')) return 'verify';
    if (path.includes('/validate')) return 'validate';
    if (path.includes('/history')) return 'history';
    return `${method.toLowerCase()}_operation`;
  }
}

module.exports = AuditMiddleware;