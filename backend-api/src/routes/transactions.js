/**
 * Transactions Routes
 * 
 * Handles blockchain transaction queries and details.
 */

const express = require('express');
const { param, validationResult } = require('express-validator');

const logger = require('../utils/logger');
const metagraphService = require('../services/metagraph');

const router = express.Router();

/**
 * GET /api/transactions/:txHash
 * Get transaction details by hash
 */
router.get('/:txHash',
  [
    param('txHash')
      .isLength({ min: 10 })
      .withMessage('Transaction hash must be at least 10 characters')
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

      const { txHash } = req.params;

      logger.info(`Transaction details request: ${txHash}`);

      const transaction = await metagraphService.getTransaction(txHash);

      if (!transaction) {
        return res.status(404).json({
          error: 'Transaction not found',
          code: 'NOT_FOUND'
        });
      }

      res.json(transaction);

    } catch (error) {
      logger.error('Transaction details error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

module.exports = router;