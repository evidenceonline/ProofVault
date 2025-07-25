import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  Check, 
  X, 
  Loader,
  Hash,
  Send,
  Eye,
  Download,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient, webSocketService, APIClient } from '../services/apiClient';
import { 
  PDFRegistrationRequest,
  PDFRegistrationResponse,
  FileUploadProps,
  EvidenceRecord,
  VerificationUpdate 
} from '../types/index';
import { cn } from '../utils/index';

interface FileUploadState {
  file: File | null;
  hash: string | null;
  isCalculatingHash: boolean;
  isUploading: boolean;
  uploadProgress: number;
  registrationResult: PDFRegistrationResponse | null;
  error: string | null;
  showPreview: boolean;
}

interface FileUploadComponentProps extends Partial<FileUploadProps> {
  className?: string;
  title?: string;
  description?: string;
  onUploadSuccess?: (result: PDFRegistrationResponse) => void;
  onUploadError?: (error: string) => void;
  showHashCalculation?: boolean;
  showProgress?: boolean;
  autoSubmit?: boolean;
}

export function FileUpload({
  accept = '.pdf,application/pdf',
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  multiple = false,
  className,
  title = 'Upload PDF Document',
  description = 'Drag and drop your PDF file here, or click to browse',
  onUploadSuccess,
  onUploadError,
  showHashCalculation = true,
  showProgress = true,
  autoSubmit = false,
}: FileUploadComponentProps) {
  const [state, setState] = useState<FileUploadState>({
    file: null,
    hash: null,
    isCalculatingHash: false,
    isUploading: false,
    uploadProgress: 0,
    registrationResult: null,
    error: null,
    showPreview: false,
  });

  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!state.registrationResult?.evidenceRecordId) return;

    const unsubscribe = webSocketService.subscribe('verification_update', (update: VerificationUpdate) => {
      if (update.evidenceRecordId === state.registrationResult?.evidenceRecordId) {
        setState(prev => ({
          ...prev,
          registrationResult: prev.registrationResult ? {
            ...prev.registrationResult,
            evidenceRecord: {
              ...prev.registrationResult.evidenceRecord,
              status: update.status,
              metagraphTxHash: update.transactionHash || prev.registrationResult.evidenceRecord.metagraphTxHash,
              metagraphBlockHeight: update.blockHeight || prev.registrationResult.evidenceRecord.metagraphBlockHeight,
              consensusConfirmationCount: update.confirmations || prev.registrationResult.evidenceRecord.consensusConfirmationCount,
              errorMessage: update.errorMessage,
            }
          } : null
        }));

        // Show toast notifications for status updates
        if (update.status === 'confirmed') {
          toast.success('PDF registration confirmed on blockchain!');
        } else if (update.status === 'failed') {
          toast.error(`Registration failed: ${update.errorMessage}`);
        }
      }
    });

    return unsubscribe;
  }, [state.registrationResult?.evidenceRecordId]);

  // PDF registration mutation
  const registerPDFMutation = useMutation({
    mutationFn: async (data: PDFRegistrationRequest) => {
      return apiClient.registerPDF(data);
    },
    onSuccess: (result) => {
      setState(prev => ({ ...prev, registrationResult: result, isUploading: false }));
      toast.success('PDF registered successfully!');
      onUploadSuccess?.(result);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Registration failed';
      setState(prev => ({ ...prev, error: errorMessage, isUploading: false }));
      toast.error(errorMessage);
      onUploadError?.(errorMessage);
    },
  });

  // Calculate PDF hash
  const calculateHash = async (file: File): Promise<string> => {
    setState(prev => ({ ...prev, isCalculatingHash: true, error: null }));
    
    try {
      const hash = await apiClient.calculatePDFHash(file);
      setState(prev => ({ ...prev, hash, isCalculatingHash: false }));
      return hash;
    } catch (error) {
      const errorMessage = 'Failed to calculate PDF hash';
      setState(prev => ({ ...prev, error: errorMessage, isCalculatingHash: false }));
      throw new Error(errorMessage);
    }
  };

  // Handle file drop/selection
  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: any[]) => {
      setState(prev => ({ ...prev, error: null }));
      
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errorMessages = rejectedFiles.map((rejection) => {
          const { file, errors } = rejection;
          return errors.map((error: any) => {
            switch (error.code) {
              case 'file-too-large':
                return `File too large (max ${APIClient.formatFileSize(maxSize)})`;
              case 'file-invalid-type':
                return 'Invalid file type (PDF only)';
              default:
                return error.message;
            }
          });
        }).flat().join(', ');
        
        setState(prev => ({ ...prev, error: errorMessages }));
        toast.error(errorMessages);
        return;
      }

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setState(prev => ({ 
        ...prev, 
        file, 
        hash: null, 
        registrationResult: null, 
        error: null 
      }));

      // Calculate hash if enabled
      if (showHashCalculation) {
        try {
          const hash = await calculateHash(file);
          
          // Auto-submit if enabled
          if (autoSubmit) {
            await handleSubmitRegistration(file, hash);
          }
        } catch (error) {
          console.error('Hash calculation failed:', error);
        }
      }
    },
    [maxSize, showHashCalculation, autoSubmit]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize,
    multiple: false,
    disabled: disabled || state.isCalculatingHash || state.isUploading,
  });

  // Handle manual registration submission
  const handleSubmitRegistration = async (file?: File, hash?: string) => {
    const currentFile = file || state.file;
    const currentHash = hash || state.hash;

    if (!currentFile || !currentHash) {
      toast.error('Please select a PDF file first');
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0, error: null }));

    try {
      // Convert file to base64
      const fileBuffer = await currentFile.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

      // Get current user address (in a real app, this would come from wallet connection)
      const userAddress = localStorage.getItem('proofvault_user_address') || 'demo_user_address';

      const registrationData: PDFRegistrationRequest = {
        hash: currentHash,
        metadata: {
          originalUrl: window.location.href,
          captureTimestamp: new Date().toISOString(),
          documentTitle: currentFile.name.replace('.pdf', ''),
          submitterAddress: userAddress,
          captureUserAgent: navigator.userAgent,
          captureViewportSize: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          fileSize: currentFile.size,
          mimeType: currentFile.type,
        },
        signature: 'demo_signature', // In a real app, this would be a cryptographic signature
        pdfData: base64Data,
      };

      await registerPDFMutation.mutateAsync(registrationData);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  // Reset form
  const handleReset = () => {
    setState({
      file: null,
      hash: null,
      isCalculatingHash: false,
      isUploading: false,
      uploadProgress: 0,
      registrationResult: null,
      error: null,
      showPreview: false,
    });
    abortControllerRef.current?.abort();
  };

  // Toggle preview
  const togglePreview = () => {
    setState(prev => ({ ...prev, showPreview: !prev.showPreview }));
  };

  const dropzoneClass = cn(
    'relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer',
    'hover:border-blue-400 hover:bg-blue-50/50',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    {
      'border-blue-400 bg-blue-50/50': isDragActive && isDragAccept,
      'border-red-400 bg-red-50/50': isDragActive && isDragReject,
      'border-gray-300 bg-gray-50/50': !isDragActive,
      'opacity-50 cursor-not-allowed': disabled || state.isCalculatingHash || state.isUploading,
    },
    className
  );

  return (
    <div className="w-full space-y-6">
      {/* Upload Area */}
      {!state.file && (
        <motion.div
          {...getRootProps()}
          className={dropzoneClass}
          whileHover={!disabled && !state.isCalculatingHash && !state.isUploading ? { scale: 1.02 } : {}}
          whileTap={!disabled && !state.isCalculatingHash && !state.isUploading ? { scale: 0.98 } : {}}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center space-y-4">
            <motion.div
              animate={{
                scale: isDragActive ? 1.1 : 1,
                rotate: isDragActive ? 10 : 0,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Upload 
                className={cn(
                  'w-16 h-16 transition-colors',
                  isDragActive && isDragAccept ? 'text-blue-500' : 'text-gray-400'
                )} 
              />
            </motion.div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
              <p className="text-gray-600">{description}</p>
              <p className="text-sm text-gray-500">
                Max file size: {APIClient.formatFileSize(maxSize)} • PDF files only
              </p>
            </div>

            {isDragActive && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-blue-600 font-medium"
              >
                {isDragAccept ? 'Drop to upload' : 'Invalid file type'}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* File Processing Area */}
      {state.file && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* File Info */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">{state.file.name}</h4>
                <p className="text-sm text-gray-500">
                  {APIClient.formatFileSize(state.file.size)} • {state.file.type}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePreview}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="Preview file"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hash Calculation */}
          {showHashCalculation && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Hash className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900">SHA-256 Hash</span>
                </div>
                
                {state.isCalculatingHash && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Calculating...</span>
                  </div>
                )}
              </div>

              {state.hash ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <code className="text-sm font-mono break-all text-gray-800">
                    {state.hash}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(state.hash!)}
                    className="ml-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Copy
                  </button>
                </div>
              ) : state.isCalculatingHash ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Registration Controls */}
          {state.hash && !state.registrationResult && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-gray-900">Register on Blockchain</h5>
                  <p className="text-sm text-gray-600">
                    Submit this PDF to the ProofVault blockchain for permanent verification
                  </p>
                </div>
                
                <button
                  onClick={() => handleSubmitRegistration()}
                  disabled={state.isUploading}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.isUploading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Register PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Registration Progress */}
          {state.isUploading && showProgress && (
            <div className="border-t pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Submitting to blockchain...</span>
                  <span className="text-gray-600">{Math.round(state.uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-blue-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${state.uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Registration Result */}
          {state.registrationResult && (
            <div className="border-t pt-6">
              <RegistrationResult result={state.registrationResult} />
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-200"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{state.error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Registration Result Component
function RegistrationResult({ result }: { result: PDFRegistrationResponse }) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing': return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed on blockchain';
      case 'processing': return 'Processing on blockchain';
      case 'failed': return 'Registration failed';
      default: return 'Pending confirmation';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon(result.evidenceRecord.status)}
          <div>
            <h5 className="font-medium text-gray-900">Registration Complete</h5>
            <p className="text-sm text-gray-600">{getStatusText(result.evidenceRecord.status)}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-gray-700">Transaction Hash:</span>
          <code className="block mt-1 p-2 bg-gray-50 rounded text-xs break-all">
            {result.transactionHash}
          </code>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Block Number:</span>
          <p className="mt-1">#{result.blockNumber}</p>
        </div>
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t pt-4 space-y-3 text-sm"
          >
            <div>
              <span className="font-medium text-gray-700">Registration ID:</span>
              <p className="mt-1">{result.registrationId}</p>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Timestamp:</span>
              <p className="mt-1">{APIClient.formatDate(result.timestamp)}</p>
            </div>

            {result.evidenceRecord.metagraphBlockHeight && (
              <div>
                <span className="font-medium text-gray-700">Confirmations:</span>
                <p className="mt-1">{result.evidenceRecord.consensusConfirmationCount}</p>
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button className="text-blue-600 hover:text-blue-700 flex items-center space-x-1">
                <Download className="w-4 h-4" />
                <span>Download Receipt</span>
              </button>
              
              <button className="text-blue-600 hover:text-blue-700 flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>View on Explorer</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact version for inline use
export function CompactFileUpload({
  onFileUpload,
  accept = '.pdf,application/pdf',
  maxSize = 10 * 1024 * 1024,
  disabled = false,
  className,
}: Partial<FileUploadComponentProps> & { onFileUpload: (file: File) => void }) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        if (file.type === 'application/pdf' && file.size <= maxSize) {
          onFileUpload(file);
          toast.success(`${file.name} selected`);
        } else {
          toast.error('Invalid file. Please select a PDF file under ' + APIClient.formatFileSize(maxSize));
        }
      }
    },
    [onFileUpload, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize,
    multiple: false,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'inline-flex items-center space-x-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg',
        'hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        {
          'border-blue-400 bg-blue-50/50': isDragActive,
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
    >
      <input {...getInputProps()} />
      <Upload className="w-4 h-4 text-gray-500" />
      <span className="text-sm text-gray-600">
        {isDragActive ? 'Drop PDF here' : 'Choose PDF'}
      </span>
    </div>
  );
}