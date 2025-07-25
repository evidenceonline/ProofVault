import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import {
  DocumentBrowserFilters,
  PaginationOptions,
  EvidenceRecord,
  SubmissionHistory,
} from '../types/index';

// Query keys for documents
export const documentKeys = {
  all: ['documents'] as const,
  browse: (filters: DocumentBrowserFilters, pagination: PaginationOptions) => 
    [...documentKeys.all, 'browse', filters, pagination] as const,
  history: (address: string, pagination: PaginationOptions) => 
    [...documentKeys.all, 'history', address, pagination] as const,
  search: (hash: string) => [...documentKeys.all, 'search', hash] as const,
  stats: (address?: string) => [...documentKeys.all, 'stats', address] as const,
};

// Hook for browsing documents with filters and pagination
export function useDocumentBrowser(
  initialFilters: DocumentBrowserFilters = {},
  initialPagination: PaginationOptions = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }
) {
  const [filters, setFilters] = useState<DocumentBrowserFilters>(initialFilters);
  const [pagination, setPagination] = useState<PaginationOptions>(initialPagination);

  const queryResult = useQuery({
    queryKey: documentKeys.browse(filters, pagination),
    queryFn: () => apiClient.browseDocuments(filters, pagination),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds
  });

  const updateFilters = (newFilters: Partial<DocumentBrowserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const updatePagination = (newPagination: Partial<PaginationOptions>) => {
    setPagination(prev => ({ ...prev, ...newPagination }));
  };

  const clearFilters = () => {
    setFilters({});
    setPagination({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
  };

  return {
    ...queryResult,
    filters,
    pagination,
    updateFilters,
    updatePagination,
    clearFilters,
    hasFilters: Object.keys(filters).some(key => {
      const value = filters[key as keyof DocumentBrowserFilters];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }),
  };
}

// Hook for user submission history
export function useSubmissionHistory(
  address: string,
  pagination: PaginationOptions = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
  enabled = true
) {
  return useQuery({
    queryKey: documentKeys.history(address, pagination),
    queryFn: () => apiClient.getSubmissionHistory(address, pagination),
    enabled: Boolean(address && enabled),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook for searching documents by hash
export function useSearchByHash(hash: string, enabled = true) {
  return useQuery({
    queryKey: documentKeys.search(hash),
    queryFn: () => apiClient.searchByHash(hash),
    enabled: Boolean(hash && enabled),
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook for user statistics
export function useUserStats(address?: string) {
  return useQuery({
    queryKey: documentKeys.stats(address),
    queryFn: () => address ? apiClient.getUserStats(address) : apiClient.getSystemStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for document export
export function useDocumentExport() {
  const mutation = useMutation({
    mutationFn: ({ filters, format }: { filters: DocumentBrowserFilters; format: 'pdf' | 'csv' | 'json' }) =>
      apiClient.exportDocuments(filters, format),
    onSuccess: (blob, { format }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `proofvault-documents-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Documents exported as ${format.toUpperCase()}`);
    },
    onError: (error) => {
      console.error('Export failed:', error);
      toast.error('Failed to export documents');
    },
  });

  const exportDocuments = (filters: DocumentBrowserFilters, format: 'pdf' | 'csv' | 'json') => {
    return mutation.mutate({ filters, format });
  };

  return {
    exportDocuments,
    isExporting: mutation.isPending,
    exportError: mutation.error,
  };
}

// Hook for retrying failed document processing
export function useRetryDocumentProcessing() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (evidenceId: string) => apiClient.retryEvidenceProcessing(evidenceId),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-record', data.id] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
      
      toast.success('Document processing retry initiated');
    },
    onError: (error) => {
      console.error('Retry failed:', error);
      toast.error('Failed to retry document processing');
    },
  });

  return {
    retryProcessing: mutation.mutate,
    isRetrying: mutation.isPending,
    retryError: mutation.error,
  };
}

// Hook for downloading PDF files
export function useDownloadPDF() {
  const mutation = useMutation({
    mutationFn: (evidenceId: string) => apiClient.downloadPDF(evidenceId),
    onSuccess: (blob, evidenceId) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `evidence-${evidenceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF downloaded successfully');
    },
    onError: (error) => {
      console.error('Download failed:', error);
      toast.error('Failed to download PDF');
    },
  });

  return {
    downloadPDF: mutation.mutate,
    isDownloading: mutation.isPending,
    downloadError: mutation.error,
  };
}

// Hook for advanced document filtering
export function useDocumentFilters() {
  const [activeFilters, setActiveFilters] = useState<DocumentBrowserFilters>({});

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'yellow' },
    { value: 'processing', label: 'Processing', color: 'blue' },
    { value: 'confirmed', label: 'Confirmed', color: 'green' },
    { value: 'failed', label: 'Failed', color: 'red' },
    { value: 'rejected', label: 'Rejected', color: 'red' },
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'Created Date' },
    { value: 'captureTimestamp', label: 'Capture Date' },
    { value: 'fileSize', label: 'File Size' },
    { value: 'submitterAddress', label: 'Submitter' },
    { value: 'status', label: 'Status' },
  ];

  const updateFilter = (key: keyof DocumentBrowserFilters, value: any) => {
    setActiveFilters(prev => {
      if (value === undefined || value === null || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
  };

  const hasActiveFilters = useMemo(() => {
    return Object.keys(activeFilters).some(key => {
      const value = activeFilters[key as keyof DocumentBrowserFilters];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });
  }, [activeFilters]);

  const getFilterSummary = useMemo(() => {
    const summary: string[] = [];
    
    if (activeFilters.status?.length) {
      summary.push(`Status: ${activeFilters.status.join(', ')}`);
    }
    if (activeFilters.submitter) {
      summary.push(`Submitter: ${activeFilters.submitter}`);
    }
    if (activeFilters.dateFrom || activeFilters.dateTo) {
      const from = activeFilters.dateFrom ? new Date(activeFilters.dateFrom).toLocaleDateString() : 'start';
      const to = activeFilters.dateTo ? new Date(activeFilters.dateTo).toLocaleDateString() : 'end';
      summary.push(`Date: ${from} - ${to}`);
    }
    if (activeFilters.search) {
      summary.push(`Search: "${activeFilters.search}"`);
    }

    return summary;
  }, [activeFilters]);

  return {
    activeFilters,
    statusOptions,
    sortOptions,
    updateFilter,
    clearAllFilters,
    hasActiveFilters,
    getFilterSummary,
  };
}

// Hook for real-time document updates
export function useDocumentRealtime(evidenceIds: string[]) {
  const queryClient = useQueryClient();

  // Invalidate and refetch specific evidence records
  const refreshDocuments = (ids: string[] = evidenceIds) => {
    ids.forEach(id => {
      queryClient.invalidateQueries({
        queryKey: ['verification', 'evidence', id],
      });
    });
    
    // Also refresh document lists
    queryClient.invalidateQueries({
      queryKey: documentKeys.all,
    });
  };

  // Update specific document in cache
  const updateDocument = (evidenceId: string, updates: Partial<EvidenceRecord>) => {
    queryClient.setQueryData(['verification', 'evidence', evidenceId], (old: EvidenceRecord) => {
      if (!old) return old;
      return { ...old, ...updates };
    });

    // Update document in browse results
    queryClient.setQueriesData(
      { queryKey: documentKeys.all },
      (old: SubmissionHistory | undefined) => {
        if (!old) return old;
        
        return {
          ...old,
          records: old.records.map(record => 
            record.id === evidenceId ? { ...record, ...updates } : record
          ),
        };
      }
    );
  };

  return {
    refreshDocuments,
    updateDocument,
  };
}