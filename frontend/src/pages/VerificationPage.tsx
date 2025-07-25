import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Copy, 
  ExternalLink, 
  Hash,
  FileText,
  User,
  Calendar,
  Database,
  Link,
  Download,
  Loader
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CompactFileUpload } from '../components/FileUpload';
import { apiClient, APIClient } from '../services/apiClient';
import { 
  PDFVerificationResponse, 
  EvidenceRecord,
  PDFValidationResponse,
  VerificationAttempt,
  AuditLog
} from '../types/index';
import { cn } from '../utils/index';

interface VerificationResult {
  hash: string;
  verification: PDFVerificationResponse;
  isValid?: boolean;
  file?: File;
  calculatedHash?: string;
}

interface VerificationPageState {
  searchHash: string;
  verificationResult: VerificationResult | null;
  isSearching: boolean;
  isCalculatingHash: boolean;
  uploadedFile: File | null;
  auditTrail: VerificationAttempt[];
  showAuditTrail: boolean;
}

export function VerificationPage() {
  const [state, setState] = useState<VerificationPageState>({
    searchHash: '',
    verificationResult: null,
    isSearching: false,
    isCalculatingHash: false,
    uploadedFile: null,
    auditTrail: [],
    showAuditTrail: false,
  });

  // Verify PDF by hash query
  const { data: verificationData, isFetching: isVerifying, error: verifyError } = useQuery({
    queryKey: ['verify-pdf', state.searchHash],
    queryFn: () => apiClient.verifyPDF(state.searchHash),
    enabled: Boolean(state.searchHash && state.searchHash.length === 64 && state.isSearching),
    retry: false,
  });

  // Network info query
  const { data: networkInfo } = useQuery({
    queryKey: ['network-info'],
    queryFn: () => apiClient.getNetworkInfo(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Handle verification result
  useEffect(() => {
    if (verificationData && state.isSearching) {
      setState(prev => ({
        ...prev,
        verificationResult: {
          hash: state.searchHash,
          verification: verificationData,
        },
        isSearching: false,
      }));
    }
  }, [verificationData, state.isSearching, state.searchHash]);

  // Handle verification error
  useEffect(() => {
    if (verifyError && state.isSearching) {
      setState(prev => ({
        ...prev,
        verificationResult: {
          hash: state.searchHash,
          verification: { 
            verified: false, 
            message: getErrorMessage(verifyError)
          },
        },
        isSearching: false,
      }));
    }
  }, [verifyError, state.isSearching, state.searchHash]);

  // Get error message from error object
  const getErrorMessage = (error: any): string => {
    if (error?.message) return error.message;
    if (error?.details?.message) return error.details.message;
    if (typeof error === 'string') return error;
    return 'An unknown error occurred';
  };

  // Handle hash search
  const handleHashSearch = async () => {
    if (!state.searchHash.trim()) {
      toast.error('Please enter a document hash');
      return;
    }

    if (!APIClient.isValidHash(state.searchHash)) {
      toast.error('Invalid hash format. Hash must be 64 hexadecimal characters.');
      return;
    }

    setState(prev => ({ ...prev, isSearching: true, verificationResult: null }));
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setState(prev => ({ 
      ...prev, 
      uploadedFile: file, 
      isCalculatingHash: true, 
      verificationResult: null 
    }));

    try {
      // Calculate hash
      const calculatedHash = await apiClient.calculatePDFHash(file);
      
      // Validate the file
      const validationResult = await apiClient.validatePDF({ pdf: file });
      
      setState(prev => ({ 
        ...prev, 
        searchHash: calculatedHash,
        isCalculatingHash: false,
        isSearching: true,
      }));

      // The verification will be triggered by the useQuery hook
    } catch (error) {
      console.error('File processing failed:', error);
      toast.error('Failed to process file: ' + getErrorMessage(error));
      setState(prev => ({ 
        ...prev, 
        isCalculatingHash: false,
        uploadedFile: null 
      }));
    }
  };

  // Copy hash to clipboard
  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      toast.success('Hash copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy hash');
    }
  };

  // Load audit trail
  const loadAuditTrail = async (hash: string) => {
    try {
      // This would load verification attempts for the hash
      // For now, we'll create a mock implementation
      setState(prev => ({ ...prev, showAuditTrail: true }));
      toast.success('Audit trail loaded');
    } catch (error) {
      toast.error('Failed to load audit trail');
    }
  };

  const isLoading = state.isCalculatingHash || isVerifying || state.isSearching;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center space-x-3 mb-4"
          >
            <Shield className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">PDF Verification</h1>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Verify the authenticity and integrity of PDF documents using blockchain technology.
            Upload a file or search by document hash.
          </motion.p>

          {/* Network Status */}
          {networkInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Connected to {networkInfo.networkName}</span>
              <span className="text-green-600">• Block #{networkInfo.blockHeight}</span>
            </motion.div>
          )}
        </div>

        {/* Search by Hash */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Hash className="w-5 h-5 mr-2 text-blue-600" />
              Verify by Hash
            </h2>
            
            <div className="flex space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={state.searchHash}
                  onChange={(e) => setState(prev => ({ ...prev, searchHash: e.target.value }))}
                  placeholder="Enter document hash (SHA-256, 64 characters)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  maxLength={64}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {state.searchHash.length}/64 characters
                </p>
              </div>
              <button
                onClick={handleHashSearch}
                disabled={isLoading || !state.searchHash.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Verify</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* File Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Or Upload Document
            </h2>
            
            <div className="space-y-4">
              <CompactFileUpload
                onFileUpload={handleFileUpload}
                disabled={isLoading}
                className="w-full justify-center p-8 text-base"
              />
              
              {state.uploadedFile && (
                <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">{state.uploadedFile.name}</p>
                    <p className="text-sm text-blue-700">
                      {APIClient.formatFileSize(state.uploadedFile.size)}
                    </p>
                  </div>
                  {state.isCalculatingHash && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Calculating hash...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Verification Result */}
        <AnimatePresence>
          {state.verificationResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
            >
              <VerificationResultCard 
                result={state.verificationResult} 
                onCopyHash={copyHash}
                onLoadAuditTrail={loadAuditTrail}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && !state.verificationResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center"
            >
              <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {state.isCalculatingHash ? 'Calculating Hash...' : 'Verifying Document...'}
              </h3>
              <p className="text-gray-600">
                {state.isCalculatingHash 
                  ? 'Processing your PDF file and generating SHA-256 hash'
                  : 'Searching blockchain for document verification'
                }
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Verification Result Card Component
function VerificationResultCard({ 
  result, 
  onCopyHash,
  onLoadAuditTrail
}: { 
  result: VerificationResult; 
  onCopyHash: (hash: string) => void;
  onLoadAuditTrail: (hash: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  
  const { hash, verification, file } = result;
  const isVerified = verification.verified;
  const data = verification.data;

  const getStatusConfig = () => {
    if (isVerified && data) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        title: 'Document Verified ✓',
        message: 'This document is authentic and has been recorded on the blockchain.',
      };
    } else {
      return {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        title: 'Document Not Found',
        message: verification.message || 'This document hash was not found in the blockchain registry.',
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-6">
      {/* Status Header */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-lg mb-6',
        statusConfig.bgColor,
        statusConfig.borderColor,
        'border'
      )}>
        <div className="flex items-center space-x-3">
          <StatusIcon className={cn('w-6 h-6', statusConfig.color)} />
          <div>
            <h3 className={cn('font-semibold text-lg', statusConfig.color)}>
              {statusConfig.title}
            </h3>
            <p className={cn('text-sm mt-1', statusConfig.color.replace('600', '700'))}>
              {statusConfig.message}
            </p>
          </div>
        </div>

        {isVerified && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            <button
              onClick={() => onLoadAuditTrail(hash)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Audit Trail
            </button>
          </div>
        )}
      </div>

      {/* Document Hash */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document Hash (SHA-256)
        </label>
        <div className="flex items-center space-x-2">
          <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm break-all">
            {hash}
          </code>
          <button
            onClick={() => onCopyHash(hash)}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Copy hash"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File Information */}
      {file && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Uploaded File Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600 block">Filename:</span>
              <span className="font-medium text-gray-900">{file.name}</span>
            </div>
            <div>
              <span className="text-gray-600 block">Size:</span>
              <span className="font-medium text-gray-900">
                {APIClient.formatFileSize(file.size)}
              </span>
            </div>
            <div>
              <span className="text-gray-600 block">Type:</span>
              <span className="font-medium text-gray-900">{file.type}</span>
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Information */}
      {isVerified && data && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Database className="w-5 h-5 mr-2 text-blue-600" />
                Blockchain Record
              </h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <User className="w-4 h-4 inline mr-1" />
                      Submitter Address
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-gray-50 px-3 py-2 rounded border flex-1">
                        {APIClient.truncateHash(data.submitterAddress || data.submitter, 8)}
                      </code>
                      <button
                        onClick={() => onCopyHash(data.submitterAddress || data.submitter)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="Copy address"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Registration Date
                    </label>
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {APIClient.formatDate(data.registrationTimestamp || data.timestamp)}
                      </div>
                      <div className="text-gray-500">
                        {APIClient.getRelativeTime(data.registrationTimestamp || data.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Block Number
                    </label>
                    <span className="text-sm font-mono bg-gray-50 px-3 py-2 rounded border inline-block">
                      #{data.blockNumber}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <Link className="w-4 h-4 inline mr-1" />
                      Transaction Hash
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-gray-50 px-3 py-2 rounded border flex-1">
                        {APIClient.truncateHash(data.transactionHash, 8)}
                      </code>
                      <button
                        onClick={() => onCopyHash(data.transactionHash)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="Copy transaction hash"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-blue-600" title="View on explorer">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence Record Details */}
            {showDetails && data.evidenceRecord && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t pt-6"
              >
                <h5 className="font-medium text-gray-900 mb-4">Evidence Record Details</h5>
                <EvidenceRecordDetails record={data.evidenceRecord} />
              </motion.div>
            )}

            {/* Metadata */}
            {data.metadata && Object.keys(data.metadata).length > 0 && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-medium text-gray-900">Document Metadata</h5>
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showMetadata ? 'Hide' : 'Show'} Metadata
                  </button>
                </div>
                
                <AnimatePresence>
                  {showMetadata && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(data.metadata, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-6">
              <div className="flex flex-wrap gap-3">
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Download className="w-4 h-4" />
                  <span>Download Certificate</span>
                </button>
                
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  <span>View on Explorer</span>
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// Evidence Record Details Component
function EvidenceRecordDetails({ record }: { record: EvidenceRecord }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="space-y-3">
        <div>
          <span className="font-medium text-gray-700 block">Document Title:</span>
          <span className="text-gray-900">{record.documentTitle || 'N/A'}</span>
        </div>
        
        <div>
          <span className="font-medium text-gray-700 block">Original URL:</span>
          {record.originalUrl ? (
            <a 
              href={record.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {record.originalUrl.length > 50 
                ? record.originalUrl.substring(0, 50) + '...' 
                : record.originalUrl
              }
            </a>
          ) : (
            <span className="text-gray-500">N/A</span>
          )}
        </div>

        <div>
          <span className="font-medium text-gray-700 block">Status:</span>
          <span className={cn(
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
            APIClient.getStatusColor(record.status)
          )}>
            {record.status}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <span className="font-medium text-gray-700 block">File Size:</span>
          <span className="text-gray-900">
            {record.fileSize ? APIClient.formatFileSize(record.fileSize) : 'N/A'}
          </span>
        </div>

        <div>
          <span className="font-medium text-gray-700 block">Storage Backend:</span>
          <span className="text-gray-900 capitalize">{record.storageBackend}</span>
        </div>

        <div>
          <span className="font-medium text-gray-700 block">Confirmations:</span>
          <span className="text-gray-900">{record.consensusConfirmationCount}</span>
        </div>
      </div>
    </div>
  );
}