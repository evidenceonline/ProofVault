'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const buildAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = process.env.NEXT_PUBLIC_PROOFVAULT_API_TOKEN;
  const apiKey = process.env.NEXT_PUBLIC_PROOFVAULT_API_KEY;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return headers;
};

interface EvidenceRecord {
  id: string;
  company_name: string;
  username: string;
  pdf_filename: string;
  created_at: string;
  pdf_hash?: string;
  file_id?: string;
  blockchain_status?: string;
  blockchain_tx_id?: string;
  blockchain_verified_at?: string;
}

interface DigitalEvidenceStatus {
  status: 'NEW' | 'QUEUED' | 'PROCESSING' | 'PENDING_COMMITMENT' | 'FINALIZED_COMMITMENT' | 'ERRORED_COMMITMENT' | 'NOT_FOUND' | 'ERROR';
  explorerUrl?: string;
  confirmationTimestamp?: string;
  error?: string;
}

interface SortConfig {
  key: keyof EvidenceRecord | null;
  direction: 'asc' | 'desc';
}

export default function HomePage() {
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingActions, setLoadingActions] = useState<{ [key: string]: boolean }>({});
  const [viewModalData, setViewModalData] = useState<EvidenceRecord | null>(null);
  const [digitalEvidenceStatus, setDigitalEvidenceStatus] = useState<DigitalEvidenceStatus | null>(null);
  const [loadingDigitalEvidence, setLoadingDigitalEvidence] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [dateFilter, setDateFilter] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // View mode state (table or card) - Updated with pagination
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  
  // Track initial mount to prevent duplicate API calls
  const [initialMount, setInitialMount] = useState(true);
  
  // Track if we're on client side (prevents hydration mismatch)
  const [isClient, setIsClient] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch records from API with pagination
  const fetchRecords = useCallback(async (page = currentPage, resetPage = false) => {
    try {
      console.log('Fetching records for page:', page);
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: recordsPerPage.toString(),
        sort_by: sortConfig.key || 'created_at',
        sort_order: sortConfig.direction === 'asc' ? 'ASC' : 'DESC'
      });
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      
      if (dateFilter) {
        params.append('date_from', dateFilter);
        params.append('date_to', dateFilter);
      }
      
      const response = await fetch(`/api/pdf/list?${params}`, {
        headers: buildAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch records: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setRecords(result.data);
        setFilteredRecords(result.data); // Since filtering is now server-side
        setTotalRecords(result.pagination?.total_count || 0);
        setTotalPages(result.pagination?.total_pages || 0);
        
        if (resetPage && page !== 1) {
          setCurrentPage(1);
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load evidence records');
      setRecords([]);
      setFilteredRecords([]);
      setTotalRecords(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, recordsPerPage, sortConfig, searchTerm, dateFilter, isRefreshing]);

  // Effect to fetch records when dependencies change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 first
      fetchRecords(1, true); // Then fetch page 1 data
    }, 300); // Debounce API calls
    
    return () => clearTimeout(timeoutId);
  }, [recordsPerPage, sortConfig, searchTerm, dateFilter]);

  // Effect to fetch records when page changes (but not on initial mount)
  useEffect(() => {
    if (initialMount) {
      setInitialMount(false);
      fetchRecords(1, false); // Initial load
    } else {
      fetchRecords(currentPage, false); // Subsequent page changes
    }
  }, [currentPage]);

  // Handle sorting
  const handleSort = (key: keyof EvidenceRecord) => {
    setSortConfig(prevSort => ({
      key,
      direction: prevSort.key === key && prevSort.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecords(currentPage, false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setSortConfig({ key: 'created_at', direction: 'desc' });
    setCurrentPage(1);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRecordsPerPageChange = (newLimit: number) => {
    setRecordsPerPage(newLimit);
    setCurrentPage(1);
  };

  // Client-side initialization to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
    
    // Simple mobile detection without immediate state changes
    const updateViewMode = () => {
      if (typeof window !== 'undefined') {
        if (window.innerWidth >= 768) {
          setViewMode('table');
        }
        // Don't auto-change on mobile resize
      }
    };

    // Set initial mode without causing re-render during hydration
    setTimeout(() => {
      updateViewMode();
    }, 0);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateViewMode);
      return () => window.removeEventListener('resize', updateViewMode);
    }
  }, []);

  // Handle PDF download
  const handleDownload = async (recordId: string, filename: string) => {
    try {
      setLoadingActions(prev => ({ ...prev, [`download-${recordId}`]: true }));
      
      const response = await fetch(`/api/pdf/${recordId}?download=true`, {
        headers: buildAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `ProofVault_${recordId}.pdf`;
      a.setAttribute('aria-label', `Download ${filename || 'evidence PDF'}`);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setLoadingActions(prev => ({ ...prev, [`download-${recordId}`]: false }));
    }
  };

  // Fetch Digital Evidence verification status
  const fetchDigitalEvidenceStatus = async (recordId: string) => {
    try {
      setLoadingDigitalEvidence(true);
      setDigitalEvidenceStatus(null);

      const response = await fetch(`/api/pdf/${recordId}/verify`, {
        headers: buildAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch verification status: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;

        // Map the verification status from our API to Digital Evidence status
        let status: DigitalEvidenceStatus['status'] = 'ERROR';

        if (data.digital_evidence_status) {
          switch (data.digital_evidence_status) {
            case 'NEW':
            case 'QUEUED':
            case 'PROCESSING':
            case 'PENDING_COMMITMENT':
            case 'FINALIZED_COMMITMENT':
            case 'ERRORED_COMMITMENT':
              status = data.digital_evidence_status;
              break;
            case 'NOT_FOUND':
              status = 'NOT_FOUND';
              break;
            default:
              status = 'ERROR';
          }
        } else if (data.verification_status === 'verified') {
          status = 'FINALIZED_COMMITMENT';
        } else if (data.verification_status === 'pending') {
          status = 'PENDING_COMMITMENT';
        } else {
          status = 'ERROR';
        }

        const digitalStatus: DigitalEvidenceStatus = {
          status,
          explorerUrl: data.explorer_url || (data.fingerprint_hash ? `https://digitalevidence.constellationnetwork.io/fingerprint/${data.fingerprint_hash}` : undefined),
          confirmationTimestamp: data.blockchain_verified_at,
          error: data.verification_message
        };

        setDigitalEvidenceStatus(digitalStatus);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching Digital Evidence status:', err);
      setDigitalEvidenceStatus({
        status: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to fetch verification status'
      });
    } finally {
      setLoadingDigitalEvidence(false);
    }
  };

  // Handle View - show PDF metadata
  const handleView = async (recordId: string) => {
    try {
      setLoadingActions(prev => ({ ...prev, [`view-${recordId}`]: true }));

      const response = await fetch(`/api/pdf/${recordId}`, {
        headers: buildAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF metadata: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setViewModalData(result.data);
        // Fetch Digital Evidence status when viewing details
        await fetchDigitalEvidenceStatus(recordId);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error viewing PDF metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF metadata');
    } finally {
      setLoadingActions(prev => ({ ...prev, [`view-${recordId}`]: false }));
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return dateString;
    }
  };

  // Format date for input field
  const formatDateForInput = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewModalData && e.key === 'Escape') {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [viewModalData]);

  // Focus management for modal
  useEffect(() => {
    if (viewModalData && modalRef.current) {
      modalRef.current.focus();
    }
  }, [viewModalData]);

  // Format Digital Evidence status for display
  const formatDigitalEvidenceStatus = (status: DigitalEvidenceStatus) => {
    const getStatusInfo = (status: DigitalEvidenceStatus['status']) => {
      switch (status) {
        case 'FINALIZED_COMMITMENT':
          return { text: 'Verified', icon: '✅', color: 'var(--color-success-600)', bgColor: 'var(--color-success-50)' };
        case 'PENDING_COMMITMENT':
          return { text: 'Pending', icon: '⏳', color: 'var(--color-warning-600)', bgColor: 'var(--color-warning-50)' };
        case 'PROCESSING':
          return { text: 'Processing', icon: '⚙️', color: 'var(--color-info-600)', bgColor: 'var(--color-info-50)' };
        case 'QUEUED':
          return { text: 'Queued', icon: '📋', color: 'var(--color-info-600)', bgColor: 'var(--color-info-50)' };
        case 'NEW':
          return { text: 'New', icon: '🆕', color: 'var(--color-info-600)', bgColor: 'var(--color-info-50)' };
        case 'ERRORED_COMMITMENT':
          return { text: 'Error', icon: '❌', color: 'var(--color-error-600)', bgColor: 'var(--color-error-50)' };
        case 'NOT_FOUND':
          return { text: 'Not Found', icon: '❓', color: 'var(--color-neutral-600)', bgColor: 'var(--color-neutral-50)' };
        case 'ERROR':
        default:
          return { text: 'Error', icon: '❌', color: 'var(--color-error-600)', bgColor: 'var(--color-error-50)' };
      }
    };

    return getStatusInfo(status.status);
  };

  // Clear modal data and digital evidence status
  const closeModal = () => {
    setViewModalData(null);
    setDigitalEvidenceStatus(null);
  };

  // Get sort icon
  const getSortIcon = (columnKey: keyof EvidenceRecord) => {
    if (sortConfig.key === columnKey) {
      return sortConfig.direction === 'asc' ? '↑' : '↓';
    }
    return '↕';
  };

  return (
    <>
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Header */}
      <header className="header" role="banner">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <div className="logo-image-clean" role="img" aria-label="ProofVault Logo">
                <img src="/proofvault-logo.jpg" alt="ProofVault Logo" width="80" height="80" style={{ objectFit: 'contain' }} />
              </div>
              <div className="logo-text">
                <h1>ProofVault</h1>
                <p>Secure Evidence Management Platform</p>
              </div>
            </div>
            <div className="header-actions">
              <div className="user-info">
                <div className="user-avatar" role="img" aria-label="User Avatar">
                  👤
                </div>
                <span>Legal Professional</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container" role="main">
        {/* Search and Filter Section */}
        <section className="search-section" role="search" aria-labelledby="search-heading">
          <div className="search-header">
            <h2 id="search-heading">
              <span className="icon" role="img" aria-label="Search Icon">🔍</span>
              Search & Filter Evidence
            </h2>
          </div>
          <div className="search-content">
            <div className="search-form">
              <div className="form-group">
                <label htmlFor="search" className="form-label">
                  Global Search
                </label>
                <div className="search-input">
                  <input
                    ref={searchInputRef}
                    id="search"
                    type="text"
                    className="form-input"
                    placeholder="Search by company, username, ID, filename, or file ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-describedby="search-description"
                  />
                </div>
                <div id="search-description" className="sr-only">
                  Search across all evidence record fields
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
                aria-label="Clear all filters and search terms"
              >
                Clear Filters
              </button>
            </div>
            
            <div className="advanced-filters">
              <div className="form-group">
                <label htmlFor="date-filter" className="form-label">
                  Filter by Date
                </label>
                <input
                  id="date-filter"
                  type="date"
                  className="form-input"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  aria-describedby="date-filter-description"
                />
                <div id="date-filter-description" className="sr-only">
                  Filter records by specific date
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Evidence Records Section */}
        <section className="records-section" aria-labelledby="records-heading">
          <div className="records-header">
            <h2 id="records-heading">
              <span className="icon" role="img" aria-label="Documents Icon">📋</span>
              Evidence Records
              {!loading && totalRecords > 0 && (
                <span className="records-count" aria-label={`${totalRecords} records found`}>
                  {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
                </span>
              )}
            </h2>
            <div className="records-actions">
              {isClient && (
                <div className="view-mode-toggle mobile-only">
                  <button 
                    type="button"
                    className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('table')}
                    aria-label="Table view"
                    title="Table view"
                  >
                    <span role="img" aria-hidden="true">📊</span>
                  </button>
                  <button 
                    type="button"
                    className={`btn btn-sm ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('card')}
                    aria-label="Card view"
                    title="Card view"
                  >
                    <span role="img" aria-hidden="true">🗃</span>
                  </button>
                </div>
              )}
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label={isRefreshing ? 'Refreshing records...' : 'Refresh evidence records'}
              >
                {isRefreshing ? (
                  <>
                    <span className="loading-spinner" aria-hidden="true"></span>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <span role="img" aria-hidden="true">🔄</span>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
          
          {loading && (
            <div className="loading" role="status" aria-live="polite">
              <div className="loading-spinner" aria-hidden="true"></div>
              <p>Loading evidence records...</p>
            </div>
          )}
          
          {error && !loading && (
            <div className="error" role="alert" aria-live="assertive">
              <h3>Error Loading Records</h3>
              <p>{error}</p>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleRefresh}
                style={{ marginTop: 'var(--space-4)' }}
              >
                Try Again
              </button>
            </div>
          )}
          
          {!loading && !error && filteredRecords.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" role="img" aria-label="No records found">
                📄
              </div>
              <h3>No Evidence Records Found</h3>
              <p>
                {searchTerm || dateFilter
                  ? 'No records match your current search criteria. Try adjusting your filters.'
                  : 'No evidence records are currently available in the system.'}
              </p>
            </div>
          )}
          
          {!loading && !error && filteredRecords.length > 0 && (
            <>

              {/* Card View */}
              {viewMode === 'card' && (
                <div className="card-view" role="region" aria-label="Evidence records cards">
                  {filteredRecords.map((record) => (
                    <div key={record.id} className="evidence-card">
                      <div className="card-header">
                        <div className="card-title">
                          <span className="company-name">{record.company_name}</span>
                          {record.blockchain_status === 'submitted' ? (
                            <span className="status-badge" style={{ color: 'var(--color-success-600)', backgroundColor: 'var(--color-success-50)' }} role="img" aria-label="Blockchain submitted">
                              <span aria-hidden="true">✅</span> Submitted
                            </span>
                          ) : record.blockchain_status === 'failed' ? (
                            <span className="status-badge" style={{ color: 'var(--color-error-600)', backgroundColor: 'var(--color-error-50)' }} role="img" aria-label="Blockchain failed">
                              <span aria-hidden="true">❌</span> Failed
                            </span>
                          ) : (
                            <span className="status-badge" style={{ color: 'var(--color-neutral-600)', backgroundColor: 'var(--color-neutral-50)' }} role="img" aria-label="Blockchain pending">
                              <span aria-hidden="true">⏳</span> Pending
                            </span>
                          )}
                        </div>
                        <div className="card-date">
                          <time dateTime={record.created_at}>
                            {formatDate(record.created_at)}
                          </time>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="card-field">
                          <span className="field-label">Username:</span>
                          <span className="field-value">{record.username}</span>
                        </div>
                        <div className="card-field">
                          <span className="field-label">File ID:</span>
                          <span className="field-value">{record.file_id || 'N/A'}</span>
                        </div>
                        <div className="card-field">
                          <span className="field-label">Evidence ID:</span>
                          <span className="field-value evidence-id-truncated" title={record.id}>
                            {record.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleView(record.id)}
                          disabled={loadingActions[`view-${record.id}`]}
                          aria-label={`View details for evidence ${record.id}`}
                        >
                          {loadingActions[`view-${record.id}`] ? (
                            <>
                              <span className="loading-spinner" aria-hidden="true"></span>
                              <span className="sr-only">Loading...</span>
                            </>
                          ) : (
                            <>
                              <span role="img" aria-hidden="true">👁</span>
                              View
                            </>
                          )}
                        </button>
                        <button 
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownload(record.id, record.pdf_filename)}
                          disabled={loadingActions[`download-${record.id}`]}
                          aria-label={`Download PDF: ${record.pdf_filename}`}
                        >
                          {loadingActions[`download-${record.id}`] ? (
                            <>
                              <span className="loading-spinner" aria-hidden="true"></span>
                              <span className="sr-only">Downloading...</span>
                            </>
                          ) : (
                            <>
                              <span role="img" aria-hidden="true">⬇</span>
                              Download
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="table-container" role="region" aria-label="Evidence records table">
                  <table className="evidence-table" role="table">
                <thead>
                  <tr role="row">
                    <th 
                      role="columnheader"
                      tabIndex={0}
                      onClick={() => handleSort('id')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('id')}
                      aria-sort={sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="sortable"
                      style={{ cursor: 'pointer' }}
                    >
                      Evidence ID {getSortIcon('id')}
                    </th>
                    <th 
                      role="columnheader"
                      tabIndex={0}
                      onClick={() => handleSort('company_name')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('company_name')}
                      aria-sort={sortConfig.key === 'company_name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="sortable"
                      style={{ cursor: 'pointer' }}
                    >
                      Company Name {getSortIcon('company_name')}
                    </th>
                    <th 
                      role="columnheader"
                      tabIndex={0}
                      onClick={() => handleSort('username')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('username')}
                      aria-sort={sortConfig.key === 'username' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="sortable"
                      style={{ cursor: 'pointer' }}
                    >
                      Username {getSortIcon('username')}
                    </th>
                    <th 
                      role="columnheader"
                      tabIndex={0}
                      onClick={() => handleSort('file_id')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('file_id')}
                      aria-sort={sortConfig.key === 'file_id' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="sortable"
                      style={{ cursor: 'pointer' }}
                    >
                      File ID {getSortIcon('file_id')}
                    </th>
                    <th 
                      role="columnheader"
                      tabIndex={0}
                      onClick={() => handleSort('created_at')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('created_at')}
                      aria-sort={sortConfig.key === 'created_at' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="sortable"
                      style={{ cursor: 'pointer' }}
                    >
                      Date & Time {getSortIcon('created_at')}
                    </th>
                    <th role="columnheader">Verification Status</th>
                    <th role="columnheader">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => (
                    <tr key={record.id} role="row">
                      <td role="gridcell" className="evidence-id" title={record.id}>
                        <span aria-label={`Evidence ID: ${record.id}`}>
                          {record.id}
                        </span>
                      </td>
                      <td role="gridcell" className="company-name">
                        {record.company_name}
                      </td>
                      <td role="gridcell" className="username">
                        {record.username}
                      </td>
                      <td role="gridcell" className="file-id">
                        {record.file_id || 'N/A'}
                      </td>
                      <td role="gridcell" className="date-time">
                        <time dateTime={record.created_at}>
                          {formatDate(record.created_at)}
                        </time>
                      </td>
                      <td role="gridcell">
                        {record.blockchain_status === 'submitted' ? (
                          <span className="status-badge" style={{ color: 'var(--color-success-600)', backgroundColor: 'var(--color-success-50)' }} role="img" aria-label="Blockchain submitted">
                            <span aria-hidden="true">✅</span> Submitted
                          </span>
                        ) : record.blockchain_status === 'failed' ? (
                          <span className="status-badge" style={{ color: 'var(--color-error-600)', backgroundColor: 'var(--color-error-50)' }} role="img" aria-label="Blockchain failed">
                            <span aria-hidden="true">❌</span> Failed
                          </span>
                        ) : (
                          <span className="status-badge" style={{ color: 'var(--color-neutral-600)', backgroundColor: 'var(--color-neutral-50)' }} role="img" aria-label="Blockchain pending">
                            <span aria-hidden="true">⏳</span> Pending
                          </span>
                        )}
                      </td>
                      <td role="gridcell">
                        <div className="action-buttons" role="group" aria-label={`Actions for evidence ${record.id}`}>
                          <button 
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleView(record.id)}
                            disabled={loadingActions[`view-${record.id}`]}
                            aria-label={`View details for evidence ${record.id}`}
                          >
                            {loadingActions[`view-${record.id}`] ? (
                              <>
                                <span className="loading-spinner" aria-hidden="true"></span>
                                <span className="sr-only">Loading...</span>
                              </>
                            ) : (
                              <>
                                <span role="img" aria-hidden="true">👁</span>
                                View
                              </>
                            )}
                          </button>
                          <button 
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDownload(record.id, record.pdf_filename)}
                            disabled={loadingActions[`download-${record.id}`]}
                            aria-label={`Download PDF: ${record.pdf_filename}`}
                          >
                            {loadingActions[`download-${record.id}`] ? (
                              <>
                                <span className="loading-spinner" aria-hidden="true"></span>
                                <span className="sr-only">Downloading...</span>
                              </>
                            ) : (
                              <>
                                <span role="img" aria-hidden="true">⬇</span>
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                  </table>
                </div>
              )}

              {/* Enhanced Pagination Controls - Bottom Only */}
              <div className="pagination-controls-bottom">
                <div className="pagination-left">
                  <div className="pagination-info">
                    <span>
                      {totalRecords > 0 ? (
                        `Showing ${((currentPage - 1) * recordsPerPage) + 1} to ${Math.min(currentPage * recordsPerPage, totalRecords)} of ${totalRecords} records`
                      ) : (
                        `Showing ${filteredRecords.length} records`
                      )}
                    </span>
                  </div>
                  <div className="records-per-page">
                    <label htmlFor="records-per-page">Show:</label>
                    <select 
                      id="records-per-page" 
                      className="form-select" 
                      value={recordsPerPage} 
                      onChange={(e) => handleRecordsPerPageChange(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
                
                {totalPages > 1 && (
                  <div className="pagination-right">
                    <div className="pagination-navigation">
                      <button 
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        aria-label="Previous page"
                      >
                        <span role="img" aria-hidden="true">←</span>
                        Previous
                      </button>
                      
                      {/* Page number buttons */}
                      <div className="page-numbers">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => handlePageChange(pageNum)}
                              aria-label={`Go to page ${pageNum}`}
                              aria-current={currentPage === pageNum ? 'page' : undefined}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button 
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        aria-label="Next page"
                      >
                        Next
                        <span role="img" aria-hidden="true">→</span>
                      </button>
                    </div>
                    
                    <div className="page-info">
                      <span>Page {currentPage} of {totalPages}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>

      {/* Evidence Details Modal */}
      {viewModalData && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <div 
            ref={modalRef}
            className="modal"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <div className="modal-header">
              <h3 id="modal-title">
                <span role="img" aria-hidden="true">📄</span>
                Evidence Details
              </h3>
            </div>
            
            <div className="modal-body" id="modal-description">
              <div className="detail-item">
                <div className="detail-label">Evidence ID</div>
                <div className="detail-value mono" aria-label={`Evidence ID: ${viewModalData.id}`}>
                  {viewModalData.id}
                </div>
              </div>
              
              <div className="detail-item">
                <div className="detail-label">Company Name</div>
                <div className="detail-value">{viewModalData.company_name}</div>
              </div>
              
              <div className="detail-item">
                <div className="detail-label">Username</div>
                <div className="detail-value">{viewModalData.username}</div>
              </div>
              
              <div className="detail-item">
                <div className="detail-label">PDF Filename</div>
                <div className="detail-value">{viewModalData.pdf_filename}</div>
              </div>
              
              {viewModalData.file_id && (
                <div className="detail-item">
                  <div className="detail-label">File ID</div>
                  <div className="detail-value">{viewModalData.file_id}</div>
                </div>
              )}
              
              <div className="detail-item">
                <div className="detail-label">Created Date & Time</div>
                <div className="detail-value">
                  <time dateTime={viewModalData.created_at}>
                    {formatDate(viewModalData.created_at)}
                  </time>
                </div>
              </div>
              
              {viewModalData.pdf_hash && (
                <div className="detail-item">
                  <div className="detail-label">
                    Cryptographic Hash (SHA-256)
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-500)', fontWeight: 'var(--font-weight-normal)' }}>
                      {' '}— Blockchain Verification
                    </span>
                  </div>
                  <div className="detail-value mono" aria-label={`SHA-256 hash: ${viewModalData.pdf_hash}`}>
                    {viewModalData.pdf_hash}
                  </div>
                </div>
              )}
              
              <div className="detail-item">
                <div className="detail-label">Digital Evidence Verification Status</div>
                <div className="detail-value">
                  {loadingDigitalEvidence ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="loading-spinner" aria-hidden="true"></span>
                      <span>Checking verification status...</span>
                    </div>
                  ) : digitalEvidenceStatus ? (
                    <>
                      <span
                        className="status-badge"
                        style={{
                          color: formatDigitalEvidenceStatus(digitalEvidenceStatus).color,
                          backgroundColor: formatDigitalEvidenceStatus(digitalEvidenceStatus).bgColor,
                          border: `1px solid ${formatDigitalEvidenceStatus(digitalEvidenceStatus).color}`,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        role="img"
                        aria-label={`Digital Evidence status: ${formatDigitalEvidenceStatus(digitalEvidenceStatus).text}`}
                      >
                        <span aria-hidden="true">{formatDigitalEvidenceStatus(digitalEvidenceStatus).icon}</span>
                        {formatDigitalEvidenceStatus(digitalEvidenceStatus).text}
                      </span>

                      {digitalEvidenceStatus.explorerUrl && (
                        <div style={{ marginTop: '8px' }}>
                          <a
                            href={digitalEvidenceStatus.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--color-primary-600)',
                              textDecoration: 'none',
                              fontSize: '14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <span aria-hidden="true">🔗</span>
                            View on Digital Evidence Explorer
                          </a>
                        </div>
                      )}

                      {digitalEvidenceStatus.confirmationTimestamp && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-neutral-600)' }}>
                          Confirmed: {formatDate(digitalEvidenceStatus.confirmationTimestamp)}
                        </div>
                      )}

                      {digitalEvidenceStatus.error && digitalEvidenceStatus.status === 'ERROR' && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-error-600)' }}>
                          Error: {digitalEvidenceStatus.error}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="status-badge" style={{ color: 'var(--color-neutral-600)', backgroundColor: 'var(--color-neutral-50)' }}>
                      <span aria-hidden="true">❓</span> Status not checked
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
                aria-label="Close evidence details modal"
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleDownload(viewModalData.id, viewModalData.pdf_filename);
                  closeModal();
                }}
                aria-label={`Download PDF: ${viewModalData.pdf_filename}`}
              >
                <span role="img" aria-hidden="true">⬇</span>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen reader only content */}
      <div className="sr-only">
        <div aria-live="polite" aria-atomic="true">
          {loading && 'Loading evidence records'}
          {error && `Error: ${error}`}
          {!loading && !error && `${filteredRecords.length} evidence records loaded`}
        </div>
      </div>

      <style jsx>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        
        .sortable {
          position: relative;
          user-select: none;
        }
        
        .sortable:hover {
          background: var(--color-neutral-100);
        }
        
        .sortable:focus {
          background: var(--color-primary-50);
        }
      `}</style>
    </>
  );
}