/**
 * React Hook for Blockchain Verification
 * 
 * This hook provides functionality for blockchain evidence verification
 * and real-time status updates for the ProofVault system.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  verifyEvidence,
  submitToBlockchain,
  generateEvidenceHash,
  checkNetworkStatus,
  generateVerificationCertificate,
  type VerificationResult,
  type BlockchainTransaction,
  type EvidenceRecord,
} from '@/lib/blockchain'

export interface VerificationState {
  isLoading: boolean
  isVerifying: boolean
  isSubmitting: boolean
  networkStatus: {
    isConnected: boolean
    network?: string
    blockNumber?: number
    error?: string
  }
  lastVerification?: VerificationResult
  error?: string
}

export interface UseBlockchainVerificationReturn {
  state: VerificationState
  verifyEvidence: (evidenceHash: string, transactionHash?: string) => Promise<VerificationResult>
  submitEvidence: (evidence: {
    imageData: string
    metadata: EvidenceRecord['metadata']
  }) => Promise<BlockchainTransaction>
  generateHash: (data: {
    imageData: string
    metadata: EvidenceRecord['metadata']
  }) => Promise<string>
  checkNetwork: () => Promise<void>
  reset: () => void
}

/**
 * Hook for blockchain verification functionality
 */
export function useBlockchainVerification(): UseBlockchainVerificationReturn {
  const [state, setState] = useState<VerificationState>({
    isLoading: false,
    isVerifying: false,
    isSubmitting: false,
    networkStatus: {
      isConnected: false
    }
  })

  // Check network status on mount and periodically
  useEffect(() => {
    checkNetwork()
    
    // Check network status every 30 seconds
    const interval = setInterval(checkNetwork, 30000)
    
    return () => clearInterval(interval)
  }, [])

  /**
   * Check blockchain network status
   */
  const checkNetwork = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }))
      
      const networkStatus = await checkNetworkStatus()
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        networkStatus,
        error: networkStatus.error
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        networkStatus: {
          isConnected: false,
          error: error instanceof Error ? error.message : 'Network check failed'
        },
        error: 'Failed to check network status'
      }))
    }
  }, [])

  /**
   * Verify evidence against blockchain
   */
  const handleVerifyEvidence = useCallback(async (
    evidenceHash: string,
    transactionHash?: string
  ): Promise<VerificationResult> => {
    try {
      setState(prev => ({ ...prev, isVerifying: true, error: undefined }))
      
      const result = await verifyEvidence(evidenceHash, transactionHash)
      
      setState(prev => ({
        ...prev,
        isVerifying: false,
        lastVerification: result,
        error: result.error
      }))
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed'
      
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
        lastVerification: {
          isValid: false,
          error: errorMessage
        }
      }))
      
      throw error
    }
  }, [])

  /**
   * Submit evidence to blockchain
   */
  const submitEvidence = useCallback(async (evidence: {
    imageData: string
    metadata: EvidenceRecord['metadata']
  }): Promise<BlockchainTransaction> => {
    try {
      setState(prev => ({ ...prev, isSubmitting: true, error: undefined }))
      
      // First generate the evidence hash
      const evidenceHash = await generateEvidenceHash(evidence)
      
      // Then submit to blockchain
      const transaction = await submitToBlockchain(evidenceHash)
      
      setState(prev => ({
        ...prev,
        isSubmitting: false
      }))
      
      return transaction
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed'
      
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage
      }))
      
      throw error
    }
  }, [])

  /**
   * Generate evidence hash
   */
  const generateHash = useCallback(async (data: {
    imageData: string
    metadata: EvidenceRecord['metadata']
  }): Promise<string> => {
    try {
      return await generateEvidenceHash(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Hash generation failed'
      
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      
      throw error
    }
  }, [])

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isVerifying: false,
      isSubmitting: false,
      networkStatus: {
        isConnected: false
      }
    })
  }, [])

  return {
    state,
    verifyEvidence: handleVerifyEvidence,
    submitEvidence,
    generateHash,
    checkNetwork,
    reset
  }
}

/**
 * Hook for managing verification certificates
 */
export function useVerificationCertificate() {
  const [certificates, setCertificates] = useState<Array<{
    certificateId: string
    issuedAt: number
    evidenceHash: string
    blockchainHash?: string
    transactionHash?: string
    confidenceScore: number
    metadata: EvidenceRecord['metadata']
  }>>([])

  const generateCertificate = useCallback((
    evidence: EvidenceRecord,
    verification: VerificationResult
  ) => {
    const certificate = generateVerificationCertificate(evidence, verification)
    
    setCertificates(prev => [certificate, ...prev])
    
    return certificate
  }, [])

  const getCertificate = useCallback((certificateId: string) => {
    return certificates.find(cert => cert.certificateId === certificateId)
  }, [certificates])

  const clearCertificates = useCallback(() => {
    setCertificates([])
  }, [])

  return {
    certificates,
    generateCertificate,
    getCertificate,
    clearCertificates
  }
}

/**
 * Hook for real-time blockchain status monitoring
 */
export function useBlockchainStatus() {
  const [status, setStatus] = useState<{
    isOnline: boolean
    latency: number
    blockNumber?: number
    gasPrice?: number
    lastUpdate: number
  }>({
    isOnline: false,
    latency: 0,
    lastUpdate: Date.now()
  })

  useEffect(() => {
    const checkStatus = async () => {
      const start = Date.now()
      
      try {
        const networkStatus = await checkNetworkStatus()
        const latency = Date.now() - start
        
        setStatus({
          isOnline: networkStatus.isConnected,
          latency,
          blockNumber: networkStatus.blockNumber,
          gasPrice: Math.floor(Math.random() * 50) + 10, // Mock gas price in gwei
          lastUpdate: Date.now()
        })
      } catch (error) {
        setStatus(prev => ({
          ...prev,
          isOnline: false,
          latency: Date.now() - start,
          lastUpdate: Date.now()
        }))
      }
    }

    // Initial check
    checkStatus()
    
    // Check every 10 seconds
    const interval = setInterval(checkStatus, 10000)
    
    return () => clearInterval(interval)
  }, [])

  return status
}

/**
 * Hook for batch verification operations
 */
export function useBatchVerification() {
  const [batchState, setBatchState] = useState<{
    isProcessing: boolean
    total: number
    processed: number
    successful: number
    failed: number
    results: Array<{
      evidenceHash: string
      result: VerificationResult
      timestamp: number
    }>
  }>({
    isProcessing: false,
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    results: []
  })

  const verifyBatch = useCallback(async (
    evidenceList: Array<{ hash: string; transactionHash?: string }>
  ) => {
    setBatchState({
      isProcessing: true,
      total: evidenceList.length,
      processed: 0,
      successful: 0,
      failed: 0,
      results: []
    })

    const results: Array<{
      evidenceHash: string
      result: VerificationResult
      timestamp: number
    }> = []

    for (let i = 0; i < evidenceList.length; i++) {
      const evidence = evidenceList[i]
      
      try {
        const result = await verifyEvidence(evidence.hash, evidence.transactionHash)
        
        results.push({
          evidenceHash: evidence.hash,
          result,
          timestamp: Date.now()
        })

        setBatchState(prev => ({
          ...prev,
          processed: i + 1,
          successful: prev.successful + (result.isValid ? 1 : 0),
          failed: prev.failed + (result.isValid ? 0 : 1),
          results: [...prev.results, results[results.length - 1]]
        }))
      } catch (error) {
        const failedResult = {
          evidenceHash: evidence.hash,
          result: {
            isValid: false,
            error: error instanceof Error ? error.message : 'Verification failed'
          },
          timestamp: Date.now()
        }

        results.push(failedResult)

        setBatchState(prev => ({
          ...prev,
          processed: i + 1,
          failed: prev.failed + 1,
          results: [...prev.results, failedResult]
        }))
      }

      // Small delay to prevent overwhelming the network
      if (i < evidenceList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    setBatchState(prev => ({
      ...prev,
      isProcessing: false
    }))

    return results
  }, [])

  const resetBatch = useCallback(() => {
    setBatchState({
      isProcessing: false,
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      results: []
    })
  }, [])

  return {
    batchState,
    verifyBatch,
    resetBatch
  }
}