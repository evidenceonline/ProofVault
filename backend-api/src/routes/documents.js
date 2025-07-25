/**
 * Documents Routes
 * 
 * Handles document browsing, searching, and export operations
 * for the ProofVault evidence management system.
 */

const express = require('express');
const { query, param, validationResult } = require('express-validator');

const logger = require('../utils/logger');
const databaseService = require('../services/database');

const router = express.Router();

/**
 * GET /api/documents/browse
 * Browse documents with filters and pagination
 */
router.get('/browse',
  [
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
      .isArray()
      .custom((value) => {
        const validStatuses = ['pending', 'processing', 'confirmed', 'failed', 'rejected'];
        return value.every(status => validStatuses.includes(status));
      })
      .withMessage('Invalid status values'),
    query('submitter')
      .optional()
      .isLength({ min: 10 })
      .withMessage('Submitter address must be at least 10 characters'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be valid ISO8601 date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be valid ISO8601 date'),
    query('search')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Search term must be between 3 and 100 characters'),
    query('sortBy')
      .optional()
      .isIn(['created_at', 'updated_at', 'capture_timestamp', 'file_size', 'document_title'])
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

      const {
        page = 1,
        limit = 20,
        status,
        submitter,
        dateFrom,
        dateTo,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      logger.info('Document browse request', {
        page,
        limit,
        filters: { status, submitter, dateFrom, dateTo, search }
      });

      const filters = {};
      if (status) filters.status = Array.isArray(status) ? status : [status];
      if (submitter) filters.submitter = submitter;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (search) filters.search = search;

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      const result = await databaseService.browseEvidenceRecords(filters, pagination);

      res.json(result);

    } catch (error) {
      logger.error('Document browse error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/documents/search/:hash
 * Search documents by hash (supports partial matches)
 */
router.get('/search/:hash',
  [
    param('hash')
      .isLength({ min: 8, max: 64 })
      .matches(/^[a-fA-F0-9]+$/)
      .withMessage('Hash must be a valid hexadecimal string (8-64 characters)')
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

      logger.info(`Document search by hash: ${hash}`);

      // If full hash provided, do exact match
      if (hash.length === 64) {
        const record = await databaseService.findEvidenceRecordByHash(hash);
        return res.json(record ? [record] : []);
      }

      // For partial hash, use database search
      const filters = { search: hash };
      const pagination = { page: 1, limit: 50 };

      const result = await databaseService.browseEvidenceRecords(filters, pagination);

      res.json(result.records);

    } catch (error) {
      logger.error('Document search error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/documents/export
 * Export documents in various formats
 */
router.get('/export',
  [
    query('format')
      .optional()
      .isIn(['json', 'csv', 'pdf'])
      .withMessage('Format must be json, csv, or pdf'),
    query('status')
      .optional()
      .isArray()
      .custom((value) => {
        const validStatuses = ['pending', 'processing', 'confirmed', 'failed', 'rejected'];
        return value.every(status => validStatuses.includes(status));
      })
      .withMessage('Invalid status values'),
    query('submitter')
      .optional()
      .isLength({ min: 10 })
      .withMessage('Submitter address must be at least 10 characters'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be valid ISO8601 date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be valid ISO8601 date')
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

      const {
        format = 'json',
        status,
        submitter,
        dateFrom,
        dateTo,
        search
      } = req.query;

      logger.info(`Document export request: ${format}`, {
        filters: { status, submitter, dateFrom, dateTo, search }
      });

      const filters = {};
      if (status) filters.status = Array.isArray(status) ? status : [status];
      if (submitter) filters.submitter = submitter;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (search) filters.search = search;

      // Get all matching records (no pagination for export)
      const pagination = { page: 1, limit: 10000 }; // Large limit for export
      const result = await databaseService.browseEvidenceRecords(filters, pagination);

      if (result.records.length === 0) {
        return res.status(404).json({
          error: 'No documents found matching criteria',
          code: 'NO_DOCUMENTS'
        });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `proofvault-export-${timestamp}`;

      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.json({
            exportTimestamp: new Date().toISOString(),
            totalRecords: result.records.length,
            filters,
            records: result.records
          });
          break;

        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          
          const csvHeaders = [
            'ID', 'Hash', 'Original URL', 'Document Title', 'File Size', 
            'Capture Timestamp', 'Submitter Address', 'Status', 
            'Blockchain TX Hash', 'Block Height', 'Created At'
          ];
          
          let csv = csvHeaders.join(',') + '\n';
          
          result.records.forEach(record => {
            const row = [
              record.id,
              record.hash,
              `"${(record.originalUrl || '').replace(/"/g, '""')}"`,
              `"${(record.documentTitle || '').replace(/"/g, '""')}"`,
              record.fileSize || '',
              record.captureTimestamp || '',
              record.submitterAddress || '',
              record.status || '',
              record.metagraphTxHash || '',
              record.metagraphBlockHeight || '',
              record.createdAt || ''
            ];
            csv += row.join(',') + '\n';
          });
          
          res.send(csv);
          break;

        case 'pdf':
          // TODO: Implement PDF export
          res.status(501).json({
            error: 'PDF export not implemented yet',
            code: 'NOT_IMPLEMENTED'
          });
          break;

        default:
          res.status(400).json({
            error: 'Unsupported export format',
            code: 'UNSUPPORTED_FORMAT'
          });
      }

    } catch (error) {
      logger.error('Document export error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/documents/stats
 * Get document statistics
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Document stats request');

    // Get counts by status
    const { query } = require('../../database/config/database');
    
    const statusStats = await query(`
      SELECT status, COUNT(*) as count
      FROM evidence_records
      GROUP BY status
    `);

    const totalCount = await query(`
      SELECT COUNT(*) as total FROM evidence_records
    `);

    const recentCount = await query(`
      SELECT COUNT(*) as recent 
      FROM evidence_records 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const totalSize = await query(`
      SELECT SUM(file_size) as total_size 
      FROM evidence_records 
      WHERE file_size IS NOT NULL
    `);

    const stats = {
      total: parseInt(totalCount.rows[0].total),
      recent24h: parseInt(recentCount.rows[0].recent),
      totalSizeBytes: parseInt(totalSize.rows[0].total_size || 0),
      statusBreakdown: statusStats.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    };

    res.json(stats);

  } catch (error) {
    logger.error('Document stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;