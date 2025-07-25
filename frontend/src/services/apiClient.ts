import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  PDFRegistrationRequest,
  PDFRegistrationResponse,
  PDFVerificationResponse,
  PDFValidationRequest,
  PDFValidationResponse,
  NetworkInfo,
  SubmissionHistory,
  EvidenceRecord,
  DocumentBrowserFilters,
  PaginationOptions,
  APIError,
  WebSocketMessage,
  VerificationUpdate,
  BlockchainTransaction,
  AuditLog,
} from '../types/index';

class APIClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add API key if available
        const apiKey = localStorage.getItem('proofvault_api_key');
        if (apiKey) {
          config.headers.Authorization = `Bearer ${apiKey}`;
        }

        // Add user address if available
        const userAddress = localStorage.getItem('proofvault_user_address');
        if (userAddress) {
          config.headers['X-User-Address'] = userAddress;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError: APIError = {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An unknown error occurred',
          details: error.response?.data || {},
          timestamp: new Date().toISOString(),
        };

        // Handle specific error cases
        if (error.response?.status === 401) {
          // Clear auth data on unauthorized
          localStorage.removeItem('proofvault_api_key');
          localStorage.removeItem('proofvault_user_address');
          apiError.code = 'UNAUTHORIZED';
          apiError.message = 'Authentication required';
        } else if (error.response?.status === 429) {
          apiError.code = 'RATE_LIMITED';
          apiError.message = 'Rate limit exceeded. Please try again later.';
        } else if (error.response?.status >= 500) {
          apiError.code = 'SERVER_ERROR';
          apiError.message = 'Server error. Please try again later.';
        }

        return Promise.reject(apiError);
      }
    );
  }

  // PDF Registration
  async registerPDF(data: PDFRegistrationRequest): Promise<PDFRegistrationResponse> {
    const response = await this.client.post<PDFRegistrationResponse>('/pdf/register', data);
    return response.data;
  }

  // PDF Verification
  async verifyPDF(hash: string): Promise<PDFVerificationResponse> {
    const response = await this.client.get<PDFVerificationResponse>(`/pdf/verify/${hash}`);
    return response.data;
  }

  // PDF Validation (upload file for hash verification)
  async validatePDF(data: PDFValidationRequest): Promise<PDFValidationResponse> {
    const formData = new FormData();
    formData.append('pdf', data.pdf);
    if (data.expectedHash) {
      formData.append('expectedHash', data.expectedHash);
    }

    const response = await this.client.post<PDFValidationResponse>('/pdf/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Get submission history
  async getSubmissionHistory(
    address: string,
    options: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<SubmissionHistory> {
    const params = new URLSearchParams({
      page: options.page.toString(),
      limit: options.limit.toString(),
    });

    if (options.sortBy) {
      params.append('sortBy', options.sortBy);
      params.append('sortOrder', options.sortOrder || 'desc');
    }

    const response = await this.client.get<SubmissionHistory>(`/pdf/history/${address}?${params}`);
    return response.data;
  }

  // Browse documents with filters
  async browseDocuments(
    filters: DocumentBrowserFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<SubmissionHistory> {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
    });

    // Add filters
    if (filters.status?.length) {
      filters.status.forEach(status => params.append('status', status));
    }
    if (filters.submitter) {
      params.append('submitter', filters.submitter);
    }
    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }

    // Add sorting
    if (pagination.sortBy) {
      params.append('sortBy', pagination.sortBy);
      params.append('sortOrder', pagination.sortOrder || 'desc');
    }

    const response = await this.client.get<SubmissionHistory>(`/documents/browse?${params}`);
    return response.data;
  }

  // Get specific evidence record
  async getEvidenceRecord(id: string): Promise<EvidenceRecord> {
    const response = await this.client.get<EvidenceRecord>(`/evidence/${id}`);
    return response.data;
  }

  // Get network info
  async getNetworkInfo(): Promise<NetworkInfo> {
    const response = await this.client.get<NetworkInfo>('/network/info');
    return response.data;
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // Export documents
  async exportDocuments(
    filters: DocumentBrowserFilters = {},
    format: 'pdf' | 'csv' | 'json' = 'json'
  ): Promise<Blob> {
    const params = new URLSearchParams({ format });

    // Add filters
    if (filters.status?.length) {
      filters.status.forEach(status => params.append('status', status));
    }
    if (filters.submitter) {
      params.append('submitter', filters.submitter);
    }
    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }

    const response = await this.client.get(`/documents/export?${params}`, {
      responseType: 'blob',
    });

    return response.data;
  }

  // Search documents by hash
  async searchByHash(hash: string): Promise<EvidenceRecord[]> {
    const response = await this.client.get<EvidenceRecord[]>(`/documents/search/${hash}`);
    return response.data;
  }

  // Get transaction details
  async getTransaction(txHash: string): Promise<any> {
    const response = await this.client.get(`/transactions/${txHash}`);
    return response.data;
  }

  // Get user statistics
  async getUserStats(address: string): Promise<any> {
    const response = await this.client.get(`/users/${address}/stats`);
    return response.data;
  }

  // Get system statistics
  async getSystemStats(): Promise<any> {
    const response = await this.client.get('/stats/system');
    return response.data;
  }

  // Get document statistics
  async getDocumentStats(): Promise<any> {
    const response = await this.client.get('/documents/stats');
    return response.data;
  }

  // Get blockchain transaction history
  async getTransactionHistory(
    filters: { txHash?: string; evidenceId?: string; type?: string } = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{ transactions: BlockchainTransaction[]; totalCount: number }> {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
    });

    if (filters.txHash) params.append('txHash', filters.txHash);
    if (filters.evidenceId) params.append('evidenceId', filters.evidenceId);
    if (filters.type) params.append('type', filters.type);

    const response = await this.client.get(`/transactions?${params}`);
    return response.data;
  }

  // Get audit logs
  async getAuditLogs(
    filters: { action?: string; resourceType?: string; actorId?: string } = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{ logs: AuditLog[]; totalCount: number }> {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
    });

    if (filters.action) params.append('action', filters.action);
    if (filters.resourceType) params.append('resourceType', filters.resourceType);
    if (filters.actorId) params.append('actorId', filters.actorId);

    const response = await this.client.get(`/audit?${params}`);
    return response.data;
  }

  // Download PDF file
  async downloadPDF(evidenceId: string): Promise<Blob> {
    const response = await this.client.get(`/evidence/${evidenceId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Get system configuration
  async getSystemConfig(): Promise<Record<string, any>> {
    const response = await this.client.get('/system/config');
    return response.data;
  }

  // Retry failed evidence record processing
  async retryEvidenceProcessing(evidenceId: string): Promise<EvidenceRecord> {
    const response = await this.client.post(`/evidence/${evidenceId}/retry`);
    return response.data;
  }

  // Calculate PDF hash client-side
  async calculatePDFHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Utility method to format file size
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Utility method to format date
  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  // Utility method to get status color
  static getStatusColor(status: string): string {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-50',
      processing: 'text-blue-600 bg-blue-50',
      confirmed: 'text-green-600 bg-green-50',
      failed: 'text-red-600 bg-red-50',
      rejected: 'text-red-600 bg-red-50',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  }

  // Utility method to get status icon
  static getStatusIcon(status: string): string {
    const icons = {
      pending: 'clock',
      processing: 'loader',
      confirmed: 'check-circle',
      failed: 'x-circle',
      rejected: 'alert-circle',
    };
    return icons[status as keyof typeof icons] || 'help-circle';
  }

  // Utility method to truncate hash for display
  static truncateHash(hash: string, length = 8): string {
    if (!hash) return '';
    return `${hash.substring(0, length)}...${hash.substring(hash.length - length)}`;
  }

  // Utility method to validate hash format
  static isValidHash(hash: string): boolean {
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  // Utility method to get relative time
  static getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }
}

// WebSocket Service Class
class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 5;
  private reconnectAttempts: number = 0;
  private url: string;

  constructor(url: string = 'ws://localhost:3001/ws') {
    this.url = url;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected', { timestamp: new Date().toISOString() });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.emit(message.type, message.payload);
          this.emit('message', message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('disconnected', { timestamp: new Date().toISOString() });
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', { error, timestamp: new Date().toISOString() });
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached', { 
        attempts: this.reconnectAttempts,
        timestamp: new Date().toISOString() 
      });
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }
}

// Create singleton instances
export const apiClient = new APIClient();
export const webSocketService = new WebSocketService();

// Export classes for testing
export { APIClient, WebSocketService };