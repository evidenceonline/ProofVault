/**
 * TypeScript Type Definitions for Blockchain Integration
 * 
 * This file contains all type definitions used throughout the ProofVault
 * blockchain integration system.
 */

// Basic blockchain types
export type BlockchainNetwork = 'ethereum' | 'polygon' | 'bsc' | 'avalanche' | 'testnet'

export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled'

export type EvidenceType = 'screenshot' | 'document' | 'webpage' | 'file'

// Core blockchain transaction interface
export interface BlockchainTransaction {
  /** Transaction hash on the blockchain */
  hash: string
  /** Block number where transaction was mined */
  blockNumber: number
  /** Timestamp when transaction was mined (Unix timestamp) */
  timestamp: number
  /** Gas used for the transaction */
  gasUsed: number
  /** Current status of the transaction */
  status: TransactionStatus
  /** Gas price used (in wei) */
  gasPrice?: number
  /** Transaction fee (in wei) */
  fee?: number
  /** Number of confirmations */
  confirmations?: number
}

// Evidence record structure
export interface EvidenceRecord {
  /** Unique identifier for the evidence */
  id: string
  /** SHA-256 hash of the evidence data */
  hash: string
  /** Timestamp when evidence was captured (Unix timestamp) */
  timestamp: number
  /** Type of evidence */
  type: EvidenceType
  /** Metadata associated with the evidence */
  metadata: EvidenceMetadata
  /** Optional blockchain transaction reference */
  transaction?: BlockchainTransaction
}

// Evidence metadata structure
export interface EvidenceMetadata {
  /** URL of the captured webpage (if applicable) */
  url?: string
  /** Title of the webpage or document */
  title?: string
  /** Timestamp when evidence was captured */
  capturedAt: number
  /** User agent string */
  userAgent?: string
  /** Viewport dimensions when captured */
  viewport?: {
    width: number
    height: number
  }
  /** File information (if applicable) */
  file?: {
    name: string
    size: number
    mimeType: string
    lastModified?: number
  }
  /** Geographic location (if available) */
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  /** Additional custom metadata */
  custom?: Record<string, any>
}

// Verification result structure
export interface VerificationResult {
  /** Whether the evidence is valid and verified */
  isValid: boolean
  /** Hash found on the blockchain */
  blockchainHash?: string
  /** Associated blockchain transaction */
  transaction?: BlockchainTransaction
  /** Verification timestamp */
  timestamp?: number
  /** Error message if verification failed */
  error?: string
  /** Confidence score (0-1) */
  confidenceScore?: number
  /** Additional verification metadata */
  metadata?: {
    networkUsed: BlockchainNetwork
    verificationMethod: 'direct' | 'merkle' | 'ipfs'
    blockDepth?: number
  }
}

// Blockchain network configuration
export interface BlockchainConfig {
  /** Network identifier */
  network: BlockchainNetwork
  /** RPC endpoint URL */
  rpcUrl: string
  /** Smart contract address */
  contractAddress?: string
  /** Default gas limit */
  gasLimit: number
  /** Default gas price (in wei) */
  gasPrice: number
  /** Chain ID */
  chainId?: number
  /** Network name for display */
  networkName?: string
  /** Block explorer URL */
  explorerUrl?: string
}

// Verification certificate structure
export interface VerificationCertificate {
  /** Unique certificate identifier */
  certificateId: string
  /** Timestamp when certificate was issued */
  issuedAt: number
  /** Hash of the evidence */
  evidenceHash: string
  /** Blockchain hash (if different from evidence hash) */
  blockchainHash?: string
  /** Transaction hash */
  transactionHash?: string
  /** Confidence score (0-1) */
  confidenceScore: number
  /** Evidence metadata */
  metadata: EvidenceMetadata
  /** Certificate validity period */
  validUntil?: number
  /** Digital signature */
  signature?: string
  /** Issuer information */
  issuer?: {
    name: string
    publicKey: string
    address: string
  }
}

// Network status structure
export interface NetworkStatus {
  /** Whether network is reachable */
  isConnected: boolean
  /** Network identifier */
  network?: BlockchainNetwork
  /** Latest block number */
  blockNumber?: number
  /** Current gas price */
  gasPrice?: number
  /** Network latency in milliseconds */
  latency?: number
  /** Error message if disconnected */
  error?: string
  /** Last update timestamp */
  lastUpdate: number
}

// Batch operation types
export interface BatchVerificationItem {
  /** Evidence hash to verify */
  evidenceHash: string
  /** Optional transaction hash */
  transactionHash?: string
  /** Original evidence record */
  evidence?: EvidenceRecord
}

export interface BatchVerificationResult {
  /** Evidence hash that was verified */
  evidenceHash: string
  /** Verification result */
  result: VerificationResult
  /** Processing timestamp */
  timestamp: number
  /** Processing duration in milliseconds */
  duration?: number
}

export interface BatchVerificationState {
  /** Whether batch is currently processing */
  isProcessing: boolean
  /** Total number of items to verify */
  total: number
  /** Number of items processed */
  processed: number
  /** Number of successful verifications */
  successful: number
  /** Number of failed verifications */
  failed: number
  /** Individual verification results */
  results: BatchVerificationResult[]
  /** Overall progress (0-1) */
  progress: number
  /** Estimated time remaining (milliseconds) */
  estimatedTimeRemaining?: number
}

// API response types
export interface ApiResponse<T = any> {
  /** Whether the request was successful */
  success: boolean
  /** Response data */
  data?: T
  /** Error message if unsuccessful */
  error?: string
  /** Additional error details */
  details?: Record<string, any>
  /** Response timestamp */
  timestamp: number
}

export interface EvidenceSubmissionResponse extends ApiResponse {
  data?: {
    evidenceId: string
    hash: string
    transaction: BlockchainTransaction
    estimatedConfirmationTime: number
  }
}

export interface VerificationResponse extends ApiResponse {
  data?: VerificationResult
}

// Event types for real-time updates
export interface BlockchainEvent {
  /** Event type */
  type: 'transaction_confirmed' | 'verification_complete' | 'network_status_change'
  /** Event timestamp */
  timestamp: number
  /** Event payload */
  payload: any
}

export interface TransactionConfirmedEvent extends BlockchainEvent {
  type: 'transaction_confirmed'
  payload: {
    transactionHash: string
    blockNumber: number
    confirmations: number
  }
}

export interface VerificationCompleteEvent extends BlockchainEvent {
  type: 'verification_complete'
  payload: {
    evidenceHash: string
    result: VerificationResult
  }
}

export interface NetworkStatusChangeEvent extends BlockchainEvent {
  type: 'network_status_change'
  payload: {
    previousStatus: NetworkStatus
    currentStatus: NetworkStatus
  }
}

// Hook state types
export interface UseBlockchainVerificationState {
  /** Whether any operation is loading */
  isLoading: boolean
  /** Whether verification is in progress */
  isVerifying: boolean
  /** Whether submission is in progress */
  isSubmitting: boolean
  /** Current network status */
  networkStatus: NetworkStatus
  /** Last verification result */
  lastVerification?: VerificationResult
  /** Current error message */
  error?: string
}

// Utility types
export type Hex = `0x${string}`

export type Address = Hex

export type Hash = Hex

export type Wei = bigint

export type Gwei = number

// Error types
export interface BlockchainError extends Error {
  code?: string | number
  reason?: string
  transaction?: BlockchainTransaction
  network?: BlockchainNetwork
}

export interface VerificationError extends Error {
  evidenceHash?: string
  transactionHash?: string
  blockchainResponse?: any
}

// Configuration types
export interface ProofVaultConfig {
  blockchain: BlockchainConfig
  api: {
    baseUrl: string
    timeout: number
    retries: number
  }
  security: {
    enableEncryption: boolean
    requireTwoFactor: boolean
    sessionTimeout: number
  }
  features: {
    enableBatchVerification: boolean
    enableRealTimeUpdates: boolean
    maxFileSize: number
    supportedFileTypes: string[]
  }
}

// Re-export commonly used types
export type {
  BlockchainTransaction as Transaction,
  EvidenceRecord as Evidence,
  VerificationResult as Verification,
  VerificationCertificate as Certificate
}