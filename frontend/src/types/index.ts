// Core ProofVault TypeScript type definitions

export type EvidenceStatus = 'pending' | 'processing' | 'confirmed' | 'failed' | 'rejected';

export type VerificationResult = 'valid' | 'invalid' | 'not_found' | 'expired';

export type TransactionType = 'register_pdf' | 'verify_document' | 'update_metadata';

export interface EvidenceRecord {
  id: string;
  hash: string;
  originalUrl: string;
  documentTitle?: string;
  mimeType: string;
  fileSize?: number;
  captureTimestamp: string;
  captureUserAgent?: string;
  captureViewportSize?: {
    width: number;
    height: number;
  };
  submitterAddress: string;
  submitterSignature?: string;
  metagraphTxHash?: string;
  metagraphBlockHeight?: number;
  blockchainTimestamp?: string;
  consensusConfirmationCount: number;
  status: EvidenceStatus;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  errorMessage?: string;
  retryCount: number;
  localFilePath?: string;
  ipfsHash?: string;
  storageBackend: 'local' | 'ipfs' | 's3';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BlockchainTransaction {
  id: string;
  txHash: string;
  evidenceRecordId: string;
  transactionType: TransactionType;
  blockHeight?: number;
  blockHash?: string;
  transactionIndex?: number;
  gasUsed?: number;
  gasPrice?: number;
  transactionFee?: number;
  submittedAt: string;
  confirmedAt?: string;
  finalizedAt?: string;
  confirmationCount: number;
  isConfirmed: boolean;
  isFinalized: boolean;
  rawTransaction?: Record<string, any>;
  receiptData?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
}

export interface VerificationAttempt {
  id: string;
  submittedHash: string;
  matchedEvidenceId?: string;
  verificationResult: VerificationResult;
  verificationTimestamp: string;
  requesterIp?: string;
  requesterUserAgent?: string;
  requesterAddress?: string;
  verificationMethod: 'api' | 'web' | 'extension';
  additionalData: Record<string, any>;
  verificationDurationMs?: number;
}

export interface User {
  id: string;
  address: string;
  displayName?: string;
  email?: string;
  apiKeyHash?: string;
  apiQuotaDaily: number;
  apiUsageCount: number;
  apiUsageResetDate: string;
  isActive: boolean;
  isVerified: boolean;
  verificationLevel: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
  failedLoginAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: 'evidence_record' | 'user' | 'transaction';
  resourceId?: string;
  actorType: 'user' | 'system' | 'api';
  actorId?: string;
  actorAddress?: string;
  occurredAt: string;
  sourceIp?: string;
  userAgent?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  contextData: Record<string, any>;
  retentionUntil?: string;
  isSensitive: boolean;
}

export interface SystemConfig {
  key: string;
  value: any;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// API Request/Response types
export interface PDFRegistrationRequest {
  hash: string;
  metadata: Record<string, any>;
  signature: string;
  pdfData: string; // Base64 encoded PDF
}

export interface PDFRegistrationResponse {
  transactionHash: string;
  registrationId: string;
  blockNumber: number;
  timestamp: string;
  evidenceRecord: EvidenceRecord;
}

export interface PDFVerificationResponse {
  verified: boolean;
  data?: {
    hash: string;
    submitter: string;
    timestamp: string;
    blockNumber: number;
    transactionHash: string;
    metadata: Record<string, any>;
    evidenceRecord: EvidenceRecord;
  };
  message?: string;
}

export interface PDFValidationRequest {
  pdf: File;
  expectedHash?: string;
}

export interface PDFValidationResponse {
  isValid: boolean;
  calculatedHash: string;
  expectedHash?: string;
  message: string;
}

export interface NetworkInfo {
  networkName: string;
  chainId: string;
  blockHeight: number;
  nodeVersion: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastBlockTimestamp: string;
  peerCount: number;
}

export interface SubmissionHistory {
  records: EvidenceRecord[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// UI Component Props
export interface FileUploadProps {
  onFileUpload: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  multiple?: boolean;
}

export interface VerificationStatusProps {
  status: EvidenceStatus;
  transactionHash?: string;
  blockHeight?: number;
  confirmations?: number;
  errorMessage?: string;
}

export interface DocumentBrowserFilters {
  status?: EvidenceStatus[];
  submitter?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Export formats
export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  filters?: DocumentBrowserFilters;
  dateRange?: {
    from: string;
    to: string;
  };
  includeMetadata?: boolean;
}

// Real-time updates
export interface WebSocketMessage {
  type: 'verification_update' | 'transaction_confirmed' | 'network_status';
  payload: any;
  timestamp: string;
}

export interface VerificationUpdate {
  evidenceRecordId: string;
  status: EvidenceStatus;
  transactionHash?: string;
  blockHeight?: number;
  confirmations?: number;
  errorMessage?: string;
}