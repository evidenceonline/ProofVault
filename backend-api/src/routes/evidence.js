/**
 * Evidence Routes
 * 
 * Handles specific evidence record operations and detailed queries.
 */

const express = require('express');
const { param, validationResult } = require('express-validator');

const logger = require('../utils/logger');
const databaseService = require('../services/database');

const router = express.Router();

/**
 * GET /api/evidence/:id
 * Get specific evidence record by ID
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('ID must be a valid UUID')
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

      const { id } = req.params;

      logger.info(`Evidence record request: ${id}`);

      const evidenceRecord = await databaseService.findEvidenceRecordById(id);

      if (!evidenceRecord) {
        return res.status(404).json({
          error: 'Evidence record not found',
          code: 'NOT_FOUND'
        });
      }

      res.json(evidenceRecord);

    } catch (error) {
      logger.error('Evidence record retrieval error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

module.exports = router;