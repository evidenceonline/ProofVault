/**
 * Blockchain Integration Utilities
 * 
 * This module provides utilities for blockchain verification and integration
 * with the ProofVault evidence management system.
 */

export interface BlockchainTransaction {
  hash: string
  blockNumber: number
  timestamp: number
  gasUsed: number
  status: 'pending' | 'confirmed' | 'failed'
}

export interface EvidenceRecord {
  id: string
  hash: string
  timestamp: number
  metadata: {
    url?: string
    title?: string
    capturedAt: number
    userAgent?: string
    viewport?: {
      width: number
      height: number
    }
  }
}

export interface VerificationResult {
  isValid: boolean
  blockchainHash?: string
  transaction?: BlockchainTransaction
  timestamp?: number
  error?: string
}

/**
 * Configuration for blockchain network
 */
export const BLOCKCHAIN_CONFIG = {
  network: process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || 'ethereum',
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '0x...',
  gasLimit: 100000,
  gasPrice: 20000000000, // 20 gwei
} as const

/**
 * Generate a SHA-256 hash for evidence data
 */
export async function generateEvidenceHash(data: {
  imageData: string
  metadata: EvidenceRecord['metadata']
}): Promise<string> {
  const encoder = new TextEncoder()
  const combinedData = JSON.stringify({
    image: data.imageData,
    metadata: data.metadata,
  })
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(combinedData))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex
}

/**
 * Submit evidence to blockchain for verification
 */
export async function submitToBlockchain(evidenceHash: string): Promise<BlockchainTransaction> {
  try {
    // In a real implementation, this would interact with a Web3 provider
    // For now, we'll simulate the blockchain interaction
    
    const mockTransaction: BlockchainTransaction = {
      hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
      timestamp: Date.now(),
      gasUsed: Math.floor(Math.random() * 50000) + 21000,
      status: 'pending'
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Simulate transaction confirmation
    mockTransaction.status = Math.random() > 0.1 ? 'confirmed' : 'failed'
    
    return mockTransaction
  } catch (error) {
    console.error('Blockchain submission failed:', error)
    throw new Error('Failed to submit evidence to blockchain')
  }
}

/**
 * Verify evidence against blockchain record
 */
export async function verifyEvidence(
  evidenceHash: string,
  transactionHash?: string
): Promise<VerificationResult> {
  try {
    if (!transactionHash) {
      return {
        isValid: false,
        error: 'No transaction hash provided'
      }
    }
    
    // In a real implementation, this would query the blockchain
    // For now, we'll simulate the verification process
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate blockchain query result
    const isValid = Math.random() > 0.05 // 95% success rate for demo
    
    if (isValid) {
      return {
        isValid: true,
        blockchainHash: evidenceHash,
        transaction: {
          hash: transactionHash,
          blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
          timestamp: Date.now() - Math.random() * 86400000, // Within last 24 hours
          gasUsed: Math.floor(Math.random() * 50000) + 21000,
          status: 'confirmed'
        },
        timestamp: Date.now() - Math.random() * 86400000
      }
    } else {
      return {
        isValid: false,
        error: 'Evidence hash not found on blockchain'
      }
    }
  } catch (error) {
    console.error('Verification failed:', error)
    return {
      isValid: false,
      error: 'Blockchain verification failed'
    }
  }
}

/**
 * Get transaction details from blockchain
 */
export async function getTransactionDetails(transactionHash: string): Promise<BlockchainTransaction | null> {
  try {
    // In a real implementation, this would query the blockchain network
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate transaction lookup
    if (Math.random() > 0.1) {
      return {
        hash: transactionHash,
        blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
        timestamp: Date.now() - Math.random() * 86400000,
        gasUsed: Math.floor(Math.random() * 50000) + 21000,
        status: 'confirmed'
      }
    }
    
    return null
  } catch (error) {
    console.error('Failed to get transaction details:', error)
    return null
  }
}

/**
 * Format blockchain hash for display
 */
export function formatBlockchainHash(hash: string, length: number = 8): string {
  if (hash.length <= length * 2) {
    return hash
  }
  
  return `${hash.slice(0, length)}...${hash.slice(-length)}`
}

/**
 * Check if blockchain network is available
 */
export async function checkNetworkStatus(): Promise<{
  isConnected: boolean
  network?: string
  blockNumber?: number
  error?: string
}> {
  try {
    // Simulate network check
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const isConnected = Math.random() > 0.05 // 95% uptime
    
    if (isConnected) {
      return {
        isConnected: true,
        network: BLOCKCHAIN_CONFIG.network,
        blockNumber: Math.floor(Math.random() * 1000000) + 15000000
      }
    } else {
      return {
        isConnected: false,
        error: 'Network unavailable'
      }
    }
  } catch (error) {
    return {
      isConnected: false,
      error: 'Network check failed'
    }
  }
}

/**
 * Calculate verification confidence score
 */
export function calculateConfidenceScore(verification: VerificationResult): number {
  if (!verification.isValid || !verification.transaction) {
    return 0
  }
  
  let score = 0.7 // Base score for valid verification
  
  // Add score based on transaction age (newer = higher confidence)
  const ageHours = (Date.now() - (verification.timestamp || 0)) / (1000 * 60 * 60)
  if (ageHours < 1) score += 0.2
  else if (ageHours < 24) score += 0.1
  
  // Add score for confirmed transaction
  if (verification.transaction.status === 'confirmed') {
    score += 0.1
  }
  
  return Math.min(score, 1.0)
}

/**
 * Generate verification certificate data
 */
export function generateVerificationCertificate(
  evidence: EvidenceRecord,
  verification: VerificationResult
): {
  certificateId: string
  issuedAt: number
  evidenceHash: string
  blockchainHash?: string
  transactionHash?: string
  confidenceScore: number
  metadata: EvidenceRecord['metadata']
} {
  return {
    certificateId: `PV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    issuedAt: Date.now(),
    evidenceHash: evidence.hash,
    blockchainHash: verification.blockchainHash,
    transactionHash: verification.transaction?.hash,
    confidenceScore: calculateConfidenceScore(verification),
    metadata: evidence.metadata
  }
}