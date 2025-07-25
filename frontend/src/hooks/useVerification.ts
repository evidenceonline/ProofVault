import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import {
  PDFRegistrationRequest,
  PDFVerificationResponse,
  PDFValidationRequest,
  EvidenceRecord,
  PDFValidationResponse,
  VerificationAttempt,
  AuditLog,
  NetworkInfo,
} from '../types/index';

// Query keys for React Query
export const verificationKeys = {
  all: ['verification'] as const,
  verify: (hash: string) => [...verificationKeys.all, 'verify', hash] as const,
  evidence: (id: string) => [...verificationKeys.all, 'evidence', id] as const,
  transaction: (txHash: string) => [...verificationKeys.all, 'transaction', txHash] as const,
};

// Hook for PDF verification by hash
export function useVerifyPDF(hash: string, enabled = true) {
  return useQuery({
    queryKey: verificationKeys.verify(hash),
    queryFn: () => apiClient.verifyPDF(hash),
    enabled: Boolean(hash && enabled),
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (hash not found)
      if (error?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });
}

// Hook for PDF registration
export function useRegisterPDF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PDFRegistrationRequest) => apiClient.registerPDF(data),
    onSuccess: (response) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: verificationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      // Optimistically update the verification cache
      queryClient.setQueryData(
        verificationKeys.verify(response.evidenceRecord.hash),
        {
          verified: true,
          data: {
            hash: response.evidenceRecord.hash,
            submitter: response.evidenceRecord.submitterAddress,
            timestamp: response.timestamp,
            blockNumber: response.blockNumber,
            transactionHash: response.transactionHash,
            metadata: response.evidenceRecord.metadata,
            evidenceRecord: response.evidenceRecord,
          },
        } as PDFVerificationResponse
      );
      
      toast.success('PDF registered successfully on blockchain!');
    },
    onError: (error) => {
      console.error('PDF registration failed:', error);
      toast.error('Failed to register PDF on blockchain');
    },
  });
}

// Hook for PDF validation (file upload)
export function useValidatePDF() {
  return useMutation({
    mutationFn: (data: PDFValidationRequest) => apiClient.validatePDF(data),
    onSuccess: (result) => {
      if (result.isValid) {
        toast.success('PDF file is valid');
      } else {
        toast.error('PDF file validation failed');
      }
    },
    onError: (error) => {
      console.error('PDF validation failed:', error);
      toast.error('Failed to validate PDF file');
    },
  });
}

// Hook for network information
export function useNetworkInfo() {
  return useQuery({
    queryKey: ['network-info'],
    queryFn: () => apiClient.getNetworkInfo(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // 15 seconds
  });
}

// Hook for audit logs
export function useAuditLogs(
  filters: { action?: string; resourceType?: string; actorId?: string } = {},
  pagination = { page: 1, limit: 20 }
) {
  return useQuery({
    queryKey: ['audit-logs', filters, pagination],
    queryFn: () => apiClient.getAuditLogs(filters, pagination),
    staleTime: 30000, // 30 seconds
  });
}

// Hook for verification report generation
export function useVerificationReport() {
  const mutation = useMutation({
    mutationFn: async (data: { 
      hash: string; 
      verification: PDFVerificationResponse; 
      format: 'pdf' | 'json' 
    }) => {
      // Generate verification report
      const report = {
        hash: data.hash,
        verified: data.verification.verified,
        timestamp: new Date().toISOString(),
        verificationData: data.verification.data,
        reportId: `report-${Date.now()}`,
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verification-report-${data.hash.substring(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return report;
    },
    onSuccess: () => {
      toast.success('Verification report downloaded');
    },
    onError: (error) => {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate verification report');
    },
  });

  return {
    generateReport: mutation.mutate,
    isGenerating: mutation.isPending,
    reportError: mutation.error,
  };
}

// Hook for getting evidence record details
export function useEvidenceRecord(id: string, enabled = true) {
  return useQuery({
    queryKey: verificationKeys.evidence(id),
    queryFn: () => apiClient.getEvidenceRecord(id),
    enabled: Boolean(id && enabled),
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook for getting transaction details
export function useTransaction(txHash: string, enabled = true) {
  return useQuery({
    queryKey: verificationKeys.transaction(txHash),
    queryFn: () => apiClient.getTransaction(txHash),
    enabled: Boolean(txHash && enabled),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook for polling verification status
export function useVerificationPolling(evidenceId: string, enabled = true) {
  return useQuery({
    queryKey: verificationKeys.evidence(evidenceId),
    queryFn: () => apiClient.getEvidenceRecord(evidenceId),
    enabled: Boolean(evidenceId && enabled),
    refetchInterval: (data) => {
      const record = data as EvidenceRecord;
      // Stop polling when confirmed, failed, or rejected
      if (record?.status && ['confirmed', 'failed', 'rejected'].includes(record.status)) {
        return false;
      }
      // Poll every 5 seconds for pending/processing records
      return 5000;
    },
    staleTime: 0, // Always fetch fresh data when polling
  });
}

// Hook for calculating PDF hash client-side
export function useCalculateHash() {
  return useMutation({
    mutationFn: (file: File) => apiClient.calculatePDFHash(file),
  });
}

// Custom hook for multi-step verification process
export function useMultiStepVerification() {
  const calculateHash = useCalculateHash();
  const validatePDF = useValidatePDF();
  const verifyPDF = useVerifyPDF('', false); // Disabled by default
  const registerPDF = useRegisterPDF();

  const verifyFile = async (file: File, expectedHash?: string) => {
    try {
      // Step 1: Calculate hash
      const calculatedHash = await calculateHash.mutateAsync(file);

      // Step 2: Validate file integrity if expected hash provided
      if (expectedHash) {
        const validation = await validatePDF.mutateAsync({ pdf: file, expectedHash });
        if (!validation.isValid) {
          throw new Error('File integrity check failed');
        }
      }

      // Step 3: Verify on blockchain
      const verification = await apiClient.verifyPDF(calculatedHash);

      return {
        hash: calculatedHash,
        verification,
        isValid: expectedHash ? true : undefined,
      };
    } catch (error) {
      throw error;
    }
  };

  const registerFile = async (file: File, metadata: Record<string, any>, signature: string) => {
    try {
      // Step 1: Calculate hash
      const hash = await calculateHash.mutateAsync(file);

      // Step 2: Convert file to base64
      const pdfData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Step 3: Register on blockchain
      const registration = await registerPDF.mutateAsync({
        hash,
        metadata,
        signature,
        pdfData,
      });

      return registration;
    } catch (error) {
      throw error;
    }
  };

  return {
    verifyFile,
    registerFile,
    isCalculating: calculateHash.isPending,
    isValidating: validatePDF.isPending,
    isVerifying: verifyPDF.isFetching,
    isRegistering: registerPDF.isPending,
    error: calculateHash.error || validatePDF.error || verifyPDF.error || registerPDF.error,
  };
}