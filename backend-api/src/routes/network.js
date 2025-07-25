/**
 * Network Routes
 * 
 * Handles blockchain network information and status endpoints
 * for the ProofVault metagraph integration.
 */

const express = require('express');
const logger = require('../utils/logger');
const metagraphService = require('../services/metagraph');

const router = express.Router();

/**
 * GET /api/network/info
 * Get current network information
 */
router.get('/info', async (req, res) => {
  try {
    logger.info('Network info request');

    const networkInfo = await metagraphService.getNetworkInfo();

    res.json(networkInfo);

  } catch (error) {
    logger.error('Network info error:', error);
    res.status(500).json({
      error: 'Failed to get network info',
      code: 'NETWORK_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/network/cluster
 * Get cluster information
 */
router.get('/cluster', async (req, res) => {
  try {
    logger.info('Cluster info request');

    const clusterInfo = await metagraphService.getClusterInfo();

    res.json(clusterInfo);

  } catch (error) {
    logger.error('Cluster info error:', error);
    res.status(500).json({
      error: 'Failed to get cluster info',
      code: 'CLUSTER_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/network/metrics
 * Get node metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    logger.info('Network metrics request');

    const metrics = await metagraphService.getNodeMetrics();

    res.json(metrics);

  } catch (error) {
    logger.error('Network metrics error:', error);
    res.status(500).json({
      error: 'Failed to get network metrics',
      code: 'METRICS_ERROR',
      message: error.message
    });
  }
});

module.exports = router;