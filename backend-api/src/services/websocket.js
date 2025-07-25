/**
 * WebSocket Service
 * 
 * Handles real-time updates and notifications for ProofVault clients
 * including PDF processing status, verification results, and network updates.
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.server = null;
    this.clients = new Map(); // Map of client ID to WebSocket connection
    this.subscriptions = new Map(); // Map of subscription type to Set of client IDs
    this.port = process.env.WS_PORT || 3002;
  }

  /**
   * Initialize WebSocket server
   */
  initialize() {
    try {
      this.server = new WebSocket.Server({
        port: this.port,
        perMessageDeflate: {
          zlibDeflateOptions: {
            level: 3
          }
        }
      });

      logger.info(`WebSocket server started on port ${this.port}`);

      this.server.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      this.server.on('error', (error) => {
        logger.error('WebSocket server error:', error);
      });

      // Heartbeat interval to keep connections alive
      this.heartbeatInterval = setInterval(() => {
        this.heartbeat();
      }, 30000); // 30 seconds

    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date().toISOString(),
      lastPing: Date.now(),
      subscriptions: new Set()
    };

    // Store client connection
    this.clients.set(clientId, { ws, info: clientInfo });

    logger.info(`WebSocket client connected: ${clientId}`, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection_established',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to ProofVault WebSocket server'
    });

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      this.handleDisconnect(clientId, code, reason);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket client error (${clientId}):`, error);
      this.handleDisconnect(clientId, 1000, 'Error occurred');
    });

    // Handle pong responses
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.info.lastPing = Date.now();
      }
    });
  }

  /**
   * Handle incoming messages from clients
   */
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) {
        return;
      }

      logger.debug(`WebSocket message from ${clientId}:`, message);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.subscription);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.subscription);
          break;

        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;

        case 'verify_hash':
          this.handleHashVerificationRequest(clientId, message.hash);
          break;

        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Unknown message type',
            timestamp: new Date().toISOString()
          });
      }

    } catch (error) {
      logger.error(`Error handling WebSocket message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle client subscription
   */
  handleSubscription(clientId, subscription) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, parameters } = subscription;

    // Add to client's subscriptions
    client.info.subscriptions.add(type);

    // Add to global subscriptions map
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    this.subscriptions.get(type).add(clientId);

    logger.debug(`Client ${clientId} subscribed to ${type}`, parameters);

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      subscription: type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client unsubscription
   */
  handleUnsubscription(clientId, subscription) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type } = subscription;

    // Remove from client's subscriptions
    client.info.subscriptions.delete(type);

    // Remove from global subscriptions map
    if (this.subscriptions.has(type)) {
      this.subscriptions.get(type).delete(clientId);
    }

    logger.debug(`Client ${clientId} unsubscribed from ${type}`);

    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      subscription: type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle hash verification request
   */
  async handleHashVerificationRequest(clientId, hash) {
    try {
      // This would integrate with the verification service
      const metagraphService = require('./metagraph');
      const result = await metagraphService.verifyPDF(hash);

      this.sendToClient(clientId, {
        type: 'verification_result',
        hash,
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`Verification request error for ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'verification_error',
        hash,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.info(`WebSocket client disconnected: ${clientId}`, {
      code,
      reason: reason.toString(),
      duration: Date.now() - new Date(client.info.connectedAt).getTime()
    });

    // Remove from all subscriptions
    for (const subscription of client.info.subscriptions) {
      if (this.subscriptions.has(subscription)) {
        this.subscriptions.get(subscription).delete(clientId);
      }
    }

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all subscribers of a type
   */
  broadcastToSubscribers(subscriptionType, message) {
    const subscribers = this.subscriptions.get(subscriptionType);
    if (!subscribers) return 0;

    let sentCount = 0;
    for (const clientId of subscribers) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }

    logger.debug(`Broadcasted to ${sentCount} subscribers of ${subscriptionType}`);
    return sentCount;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(message) {
    let sentCount = 0;
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    logger.debug(`Broadcasted to ${sentCount} clients`);
    return sentCount;
  }

  /**
   * Send PDF processing update
   */
  notifyPDFProcessingUpdate(evidenceRecordId, status, details = {}) {
    const message = {
      type: 'pdf_processing_update',
      evidenceRecordId,
      status,
      details: {
        ...details,
        stage: this.getProcessingStage(status),
        progress: this.getProcessingProgress(status)
      },
      timestamp: new Date().toISOString()
    };

    // Send to general PDF processing subscribers
    this.broadcastToSubscribers('pdf_processing', message);

    // Send to specific evidence record subscribers
    this.broadcastToSubscribers(`evidence_${evidenceRecordId}`, message);

    logger.debug(`PDF processing update sent: ${evidenceRecordId} -> ${status}`);
  }

  /**
   * Send extension-specific PDF processing update
   */
  notifyExtensionPDFUpdate(evidenceRecordId, status, extensionId, details = {}) {
    const message = {
      type: 'extension_pdf_update',
      evidenceRecordId,
      status,
      extensionId,
      details: {
        ...details,
        stage: this.getProcessingStage(status),
        progress: this.getProcessingProgress(status),
        nextAction: this.getNextAction(status)
      },
      timestamp: new Date().toISOString()
    };

    // Send to extension-specific subscribers
    this.broadcastToSubscribers(`extension_${extensionId}`, message);
    
    // Send to specific evidence record subscribers
    this.broadcastToSubscribers(`evidence_${evidenceRecordId}`, message);

    logger.debug(`Extension PDF update sent: ${evidenceRecordId} -> ${status} for ${extensionId}`);
  }

  /**
   * Send verification result update
   */
  notifyVerificationResult(hash, result) {
    this.broadcastToSubscribers('verification_updates', {
      type: 'verification_result',
      hash,
      result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send network status update
   */
  notifyNetworkStatus(networkInfo) {
    this.broadcastToSubscribers('network_status', {
      type: 'network_status_update',
      networkInfo,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Heartbeat to keep connections alive
   */
  heartbeat() {
    const now = Date.now();
    const timeout = 60000; // 60 seconds timeout

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Check if client has responded to ping recently
        if (now - client.info.lastPing > timeout) {
          logger.warn(`Client ${clientId} timed out, terminating connection`);
          client.ws.terminate();
          this.handleDisconnect(clientId, 1001, 'Ping timeout');
        } else {
          // Send ping
          client.ws.ping();
        }
      } else {
        // Clean up dead connections
        this.handleDisconnect(clientId, 1000, 'Connection closed');
      }
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Subscribe client to specific evidence record updates
   */
  subscribeToEvidenceRecord(clientId, evidenceRecordId) {
    const subscriptionType = `evidence_${evidenceRecordId}`;
    this.handleSubscription(clientId, { type: subscriptionType });
  }

  /**
   * Subscribe extension to its specific updates
   */
  subscribeExtension(clientId, extensionId) {
    const subscriptionType = `extension_${extensionId}`;
    this.handleSubscription(clientId, { type: subscriptionType });
  }

  /**
   * Get processing stage description
   */
  getProcessingStage(status) {
    const stages = {
      'pending': 'Queued for processing',
      'processing': 'Submitting to blockchain',
      'confirmed': 'Confirmed on blockchain',
      'failed': 'Processing failed',
      'rejected': 'Validation rejected'
    };
    return stages[status] || 'Unknown stage';
  }

  /**
   * Get processing progress percentage
   */
  getProcessingProgress(status) {
    const progress = {
      'pending': 10,
      'processing': 50,
      'confirmed': 100,
      'failed': 0,
      'rejected': 0
    };
    return progress[status] || 0;
  }

  /**
   * Get next action for status
   */
  getNextAction(status) {
    const actions = {
      'pending': 'Please wait while we process your PDF',
      'processing': 'Submitting to blockchain network',
      'confirmed': 'PDF successfully registered! You can now verify it.',
      'failed': 'Please try submitting again or contact support',
      'rejected': 'Please check your PDF and try again'
    };
    return actions[status] || 'No action required';
  }

  /**
   * Notify blockchain transaction confirmation
   */
  notifyTransactionConfirmation(evidenceRecordId, transactionHash, confirmations) {
    const message = {
      type: 'transaction_confirmation',
      evidenceRecordId,
      transactionHash,
      confirmations,
      isFullyConfirmed: confirmations >= 6, // Assume 6 confirmations for finality
      timestamp: new Date().toISOString()
    };

    this.broadcastToSubscribers(`evidence_${evidenceRecordId}`, message);
    this.broadcastToSubscribers('transaction_updates', message);
  }

  /**
   * Notify of hash verification attempt
   */
  notifyHashVerificationAttempt(hash, verified, source) {
    const message = {
      type: 'hash_verification_attempt',
      hash,
      verified,
      source, // 'extension', 'web', 'api'
      timestamp: new Date().toISOString()
    };

    this.broadcastToSubscribers('verification_attempts', message);
  }

  /**
   * Get server statistics
   */
  getStats() {
    const subscriptionStats = {};
    for (const [type, subscribers] of this.subscriptions) {
      subscriptionStats[type] = subscribers.size;
    }

    const clientStats = {
      total: this.clients.size,
      byType: {
        web: 0,
        extension: 0,
        api: 0
      }
    };

    // Categorize clients by type based on subscriptions
    for (const [clientId, client] of this.clients) {
      const hasExtensionSub = Array.from(client.info.subscriptions)
        .some(sub => sub.startsWith('extension_'));
      
      if (hasExtensionSub) {
        clientStats.byType.extension++;
      } else if (client.info.userAgent?.includes('Mozilla')) {
        clientStats.byType.web++;
      } else {
        clientStats.byType.api++;
      }
    }

    return {
      connectedClients: clientStats,
      subscriptions: subscriptionStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.server) {
      this.server.close(() => {
        logger.info('WebSocket server closed');
      });
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.ws.close(1001, 'Server shutdown');
    }

    this.clients.clear();
    this.subscriptions.clear();
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

/**
 * Initialize WebSocket server
 */
function initializeWebSocket() {
  webSocketService.initialize();
}

module.exports = {
  webSocketService,
  initializeWebSocket
};