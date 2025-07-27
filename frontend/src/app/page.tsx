'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface EvidenceRecord {
  id: string;
  company_name: string;
  username: string;
  pdf_filename: string;
  created_at: string;
  pdf_hash?: string;
  file_id?: string;
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch records from API
  const fetchRecords = useCallback(async () => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);
      
      const response = await fetch('/api/pdf/list');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch records: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setRecords(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load evidence records');
      setRecords([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Apply filters and sorting
  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...records];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        record.company_name.toLowerCase().includes(searchLower) ||
        record.username.toLowerCase().includes(searchLower) ||
        record.id.toLowerCase().includes(searchLower) ||
        record.pdf_filename.toLowerCase().includes(searchLower) ||
        (record.file_id && record.file_id.toLowerCase().includes(searchLower))
      );
    }

    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
      
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate >= startOfDay && recordDate <= endOfDay;
      });
    }

    // Apply status filter (currently all records are verified, but ready for expansion)
    if (statusFilter !== 'all') {
      // For future use when different statuses are implemented
      filtered = filtered.filter(record => statusFilter === 'verified');
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (sortConfig.key === 'created_at') {
          const aDate = new Date(aValue as string).getTime();
          const bDate = new Date(bValue as string).getTime();
          return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredRecords(filtered);
  }, [records, searchTerm, dateFilter, statusFilter, sortConfig]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

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
    await fetchRecords();
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setStatusFilter('all');
    setSortConfig({ key: 'created_at', direction: 'desc' });
  };

  // Handle PDF download
  const handleDownload = async (recordId: string, filename: string) => {
    try {
      setLoadingActions(prev => ({ ...prev, [`download-${recordId}`]: true }));
      
      const response = await fetch(`/api/pdf/${recordId}?download=true`);
      
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

  // Handle View - show PDF metadata
  const handleView = async (recordId: string) => {
    try {
      setLoadingActions(prev => ({ ...prev, [`view-${recordId}`]: true }));
      
      const response = await fetch(`/api/pdf/${recordId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF metadata: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setViewModalData(result.data);
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
        setViewModalData(null);
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
              <div className="logo-icon" role="img" aria-label="ProofVault Shield Icon">
                🛡
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
              
              <div className="form-group">
                <label htmlFor="status-filter" className="form-label">
                  Filter by Status
                </label>
                <select
                  id="status-filter"
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-describedby="status-filter-description"
                >
                  <option value="all">All Statuses</option>
                  <option value="verified">Verified Only</option>
                  <option value="pending">Pending Only</option>
                </select>
                <div id="status-filter-description" className="sr-only">
                  Filter records by verification status
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
              {!loading && (
                <span className="records-count" aria-label={`${filteredRecords.length} records found`}>
                  {filteredRecords.length} {filteredRecords.length === 1 ? 'Record' : 'Records'}
                </span>
              )}
            </h2>
            <div className="records-actions">
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
                {searchTerm || dateFilter || statusFilter !== 'all'
                  ? 'No records match your current search criteria. Try adjusting your filters.'
                  : 'No evidence records are currently available in the system.'}
              </p>
            </div>
          )}
          
          {!loading && !error && filteredRecords.length > 0 && (
            <div className="table-container" role="region" aria-label="Evidence records table">
              <table className="evidence-table" role="table">
                <thead>
                  <tr role="row">
                    <th 
                      role="columnheader"
                      tabIndex={0}
                      onClick={() => handleSort('id')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('id')}
                      aria-sort={sortConfig.key === 'id' ? sortConfig.direction : 'none'}
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
                      aria-sort={sortConfig.key === 'company_name' ? sortConfig.direction : 'none'}
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
                      aria-sort={sortConfig.key === 'username' ? sortConfig.direction : 'none'}
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
                      aria-sort={sortConfig.key === 'file_id' ? sortConfig.direction : 'none'}
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
                      aria-sort={sortConfig.key === 'created_at' ? sortConfig.direction : 'none'}
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
                        <span className="status-badge status-verified" role="img" aria-label="Verified status">
                          <span aria-hidden="true">✓</span> Verified
                        </span>
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
        </section>
      </main>

      {/* Evidence Details Modal */}
      {viewModalData && (
        <div 
          className="modal-backdrop"
          onClick={() => setViewModalData(null)}
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
                <div className="detail-label">Verification Status</div>
                <div className="detail-value">
                  <span className="status-badge status-verified" role="img" aria-label="Blockchain verified">
                    <span aria-hidden="true">✓</span> Blockchain Verified
                  </span>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewModalData(null)}
                aria-label="Close evidence details modal"
              >
                Close
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleDownload(viewModalData.id, viewModalData.pdf_filename);
                  setViewModalData(null);
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