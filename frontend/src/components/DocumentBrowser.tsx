import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Copy,
  FileText,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient, APIClient } from '../services/apiClient';
import { 
  EvidenceRecord, 
  DocumentBrowserFilters, 
  PaginationOptions,
  EvidenceStatus 
} from '../types/index';
import { cn } from '../utils/index';

interface DocumentBrowserState {
  filters: DocumentBrowserFilters;
  pagination: PaginationOptions;
}

export function DocumentBrowser() {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [state, setState] = useState<DocumentBrowserState>({
    filters: {},
    pagination: { page: 1, limit: 20, sortBy: 'created_at', sortOrder: 'desc' }
  });

  const queryClient = useQueryClient();

  // Status options for filtering
  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'text-yellow-600 bg-yellow-50' },
    { value: 'processing', label: 'Processing', color: 'text-blue-600 bg-blue-50' },
    { value: 'confirmed', label: 'Confirmed', color: 'text-green-600 bg-green-50' },
    { value: 'failed', label: 'Failed', color: 'text-red-600 bg-red-50' },
    { value: 'rejected', label: 'Rejected', color: 'text-red-600 bg-red-50' },
  ];

  // Sort options
  const sortOptions = [
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Updated Date' },
    { value: 'capture_timestamp', label: 'Capture Time' },
    { value: 'file_size', label: 'File Size' },
    { value: 'document_title', label: 'Document Title' },
  ];

  // Fetch documents with React Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['documents', state.filters, state.pagination],
    queryFn: () => apiClient.browseDocuments(state.filters, state.pagination),
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
  });

  // Update filter function
  const updateFilter = (key: keyof DocumentBrowserFilters, value: any) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
      pagination: { ...prev.pagination, page: 1 } // Reset to first page when filters change
    }));
  };

  // Update pagination function
  const updatePagination = (updates: Partial<PaginationOptions>) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, ...updates }
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setState(prev => ({
      ...prev,
      filters: {},
      pagination: { ...prev.pagination, page: 1 }
    }));
  };

  // Check if filters are active
  const hasActiveFilters = Object.keys(state.filters).some(key => {
    const value = state.filters[key as keyof DocumentBrowserFilters];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });

  // Get filter summary
  const getFilterSummary = useMemo(() => {
    const summary: string[] = [];
    if (state.filters.status?.length) {
      summary.push(`Status: ${state.filters.status.join(', ')}`);
    }
    if (state.filters.submitter) {
      summary.push(`Submitter: ${APIClient.truncateHash(state.filters.submitter, 6)}`);
    }
    if (state.filters.dateFrom) {
      summary.push(`From: ${new Date(state.filters.dateFrom).toLocaleDateString()}`);
    }
    if (state.filters.dateTo) {
      summary.push(`To: ${new Date(state.filters.dateTo).toLocaleDateString()}`);
    }
    if (state.filters.search) {
      summary.push(`Search: "${state.filters.search}"`);
    }
    return summary;
  }, [state.filters]);

  // Export function
  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    try {
      const blob = await apiClient.exportDocuments(state.filters, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `proofvault-documents.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Documents exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  // Record selection functions
  const handleSelectRecord = (id: string) => {
    setSelectedRecords(prev => 
      prev.includes(id) 
        ? prev.filter(recordId => recordId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (data?.records) {
      const allIds = data.records.map(record => record.id);
      setSelectedRecords(prev => 
        prev.length === allIds.length ? [] : allIds
      );
    }
  };

  // Copy hash to clipboard
  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      toast.success('Hash copied to clipboard');
    } catch (error) {
      console.error('Failed to copy hash:', error);
      toast.error('Failed to copy hash');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <FileText className="w-8 h-8 mr-3 text-blue-600" />
                Document Registry
              </h1>
              <p className="text-gray-600 mt-2">
                Browse and search verified PDF documents on the blockchain
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors',
                  showFilters 
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                )}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {Object.keys(state.filters).length}
                  </span>
                )}
              </button>
              
              <ExportMenu onExport={handleExport} />
            </div>
          </div>

          {/* Filter Summary */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 flex items-center space-x-2 text-sm text-gray-600"
            >
              <span>Active filters:</span>
              {getFilterSummary.map((filter, index) => (
                <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {filter}
                </span>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-red-600 hover:text-red-700 underline"
              >
                Clear all
              </button>
            </motion.div>
          )}
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <FiltersPanel
                activeFilters={state.filters}
                statusOptions={statusOptions}
                sortOptions={sortOptions}
                updateFilter={updateFilter}
                pagination={state.pagination}
                updatePagination={updatePagination}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {data?.records && (
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedRecords.length === data.records.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      {selectedRecords.length > 0 
                        ? `${selectedRecords.length} selected`
                        : 'Select all'
                      }
                    </span>
                  </label>
                )}
                
                {data && (
                  <span className="text-sm text-gray-500">
                    {data.totalCount} documents found
                  </span>
                )}
              </div>

              {selectedRecords.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExport('json')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Export Selected
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Document List */}
          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <DocumentListSkeleton />
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Documents</h3>
                <p className="text-gray-600 mb-4">Please try again later</p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : data?.records.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h3>
                <p className="text-gray-600">
                  {hasActiveFilters ? 'Try adjusting your filters' : 'No documents have been registered yet'}
                </p>
              </div>
            ) : (
              data?.records.map((record) => (
                <DocumentRow
                  key={record.id}
                  record={record}
                  isSelected={selectedRecords.includes(record.id)}
                  onSelect={() => handleSelectRecord(record.id)}
                  onCopyHash={copyHash}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {data && data.totalCount > state.pagination.limit && (
            <div className="px-6 py-4 border-t border-gray-200">
              <Pagination
                current={state.pagination.page}
                total={Math.ceil(data.totalCount / state.pagination.limit)}
                onPageChange={(page) => updatePagination({ page })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Document Row Component
function DocumentRow({
  record,
  isSelected,
  onSelect,
  onCopyHash,
}: {
  record: EvidenceRecord;
  isSelected: boolean;
  onSelect: () => void;
  onCopyHash: (hash: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = (status: EvidenceStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <Loader className="w-4 h-4 animate-spin" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'rejected': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const statusIcon = getStatusIcon(record.status);
  const statusColor = APIClient.getStatusColor(record.status);

  return (
    <motion.div
      layout
      className={cn(
        'p-6 hover:bg-gray-50 transition-colors',
        isSelected && 'bg-blue-50'
      )}
    >
      <div className="flex items-start space-x-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {record.documentTitle || 'Untitled Document'}
                </h3>
                <span className={cn(
                  'inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full border',
                  statusColor
                )}>
                  {statusIcon} 
                  <span className="ml-1">{record.status}</span>
                </span>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {APIClient.getRelativeTime(record.createdAt)}
                </div>
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  {APIClient.truncateHash(record.submitterAddress, 6)}
                </div>
                {record.fileSize && (
                  <div>
                    {APIClient.formatFileSize(record.fileSize)}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 mb-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                  {APIClient.truncateHash(record.hash, 8)}
                </code>
                <button
                  onClick={() => onCopyHash(record.hash)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Copy hash"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {record.metagraphTxHash && (
                  <button
                    className="p-1 text-gray-400 hover:text-blue-600"
                    aria-label="View on blockchain explorer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {record.originalUrl && (
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Source:</span>
                  <a 
                    href={record.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 hover:text-blue-800 underline"
                  >
                    {record.originalUrl.length > 50 
                      ? record.originalUrl.substring(0, 50) + '...' 
                      : record.originalUrl
                    }
                  </a>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <DocumentDetails record={record} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// Document Details Component
function DocumentDetails({ record }: { record: EvidenceRecord }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
      <div className="space-y-3">
        <div>
          <span className="font-medium text-gray-700">Full Hash:</span>
          <code className="block mt-1 p-2 bg-gray-50 rounded border text-xs break-all">
            {record.hash}
          </code>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Capture Time:</span>
          <p className="mt-1">{APIClient.formatDate(record.captureTimestamp)}</p>
        </div>

        {record.captureUserAgent && (
          <div>
            <span className="font-medium text-gray-700">User Agent:</span>
            <p className="mt-1 text-gray-600">{record.captureUserAgent}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {record.metagraphTxHash && (
          <div>
            <span className="font-medium text-gray-700">Transaction Hash:</span>
            <code className="block mt-1 p-2 bg-gray-50 rounded border text-xs break-all">
              {record.metagraphTxHash}
            </code>
          </div>
        )}

        {record.metagraphBlockHeight && (
          <div>
            <span className="font-medium text-gray-700">Block Height:</span>
            <p className="mt-1">#{record.metagraphBlockHeight}</p>
          </div>
        )}

        {record.consensusConfirmationCount > 0 && (
          <div>
            <span className="font-medium text-gray-700">Confirmations:</span>
            <p className="mt-1">{record.consensusConfirmationCount}</p>
          </div>
        )}
      </div>

      {Object.keys(record.metadata).length > 0 && (
        <div className="lg:col-span-2">
          <span className="font-medium text-gray-700">Metadata:</span>
          <pre className="mt-1 p-2 bg-gray-50 rounded border text-xs overflow-x-auto">
            {JSON.stringify(record.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Filters Panel Component
function FiltersPanel({
  activeFilters,
  statusOptions,
  sortOptions,
  updateFilter,
  pagination,
  updatePagination,
}: {
  activeFilters: DocumentBrowserFilters;
  statusOptions: Array<{ value: string; label: string; color: string }>;
  sortOptions: Array<{ value: string; label: string }>;
  updateFilter: (key: keyof DocumentBrowserFilters, value: any) => void;
  pagination: PaginationOptions;
  updatePagination: (updates: Partial<PaginationOptions>) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="space-y-2">
            {statusOptions.map((status) => (
              <label key={status.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={activeFilters.status?.includes(status.value as EvidenceStatus) || false}
                  onChange={(e) => {
                    const currentStatuses = activeFilters.status || [];
                    const newStatuses = e.target.checked
                      ? [...currentStatuses, status.value as EvidenceStatus]
                      : currentStatuses.filter(s => s !== status.value);
                    updateFilter('status', newStatuses);
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">{status.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={activeFilters.dateFrom || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="From"
            />
            <input
              type="date"
              value={activeFilters.dateTo || ''}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="To"
            />
          </div>
        </div>

        {/* Submitter Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Submitter Address
          </label>
          <input
            type="text"
            value={activeFilters.submitter || ''}
            onChange={(e) => updateFilter('submitter', e.target.value)}
            placeholder="Enter address..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            value={activeFilters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search documents..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={pagination.sortBy || 'created_at'}
              onChange={(e) => updatePagination({ sortBy: e.target.value })}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Order:</label>
            <select
              value={pagination.sortOrder || 'desc'}
              onChange={(e) => updatePagination({ sortOrder: e.target.value as 'asc' | 'desc' })}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Per page:</label>
          <select
            value={pagination.limit || 20}
            onChange={(e) => updatePagination({ limit: parseInt(e.target.value), page: 1 })}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Export Menu Component
function ExportMenu({ onExport }: { onExport: (format: 'pdf' | 'csv' | 'json') => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10"
          >
            {(['json', 'csv'] as const).map((format) => (
              <button
                key={format}
                onClick={() => {
                  onExport(format);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Export as {format.toUpperCase()}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Pagination Component
function Pagination({
  current,
  total,
  onPageChange,
}: {
  current: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = useMemo(() => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < total - 1) {
      rangeWithDots.push('...', total);
    } else {
      rangeWithDots.push(total);
    }

    return rangeWithDots;
  }, [current, total]);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-700">
        Page {current} of {total}
      </p>
      
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={cn(
              'px-3 py-1 text-sm rounded transition-colors',
              typeof page === 'number' && page === current
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100',
              page === '...' && 'cursor-default'
            )}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(current + 1)}
          disabled={current >= total}
          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Loading Skeleton
function DocumentListSkeleton() {
  return (
    <div className="divide-y divide-gray-200">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-6 animate-pulse">
          <div className="flex space-x-4">
            <div className="w-4 h-4 bg-gray-200 rounded mt-1"></div>
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}