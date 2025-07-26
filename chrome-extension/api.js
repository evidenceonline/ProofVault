class ApiClient {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
    this.maxRetries = API_CONFIG.MAX_RETRIES;
  }

  async makeRequest(url, options = {}, retryCount = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        console.warn(`Request failed, retrying (${retryCount + 1}/${this.maxRetries})...`);
        await this.delay(1000 * (retryCount + 1));
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  isRetryableError(error) {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async uploadPdf(pdfBlob, metadata) {
    const formData = new FormData();
    formData.append('pdf', pdfBlob, `ProofVault_${metadata.id}.pdf`);
    formData.append('company_name', metadata.company);
    formData.append('username', metadata.user);

    const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.UPLOAD_PDF}`;
    const response = await this.makeRequest(url, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }

  async listPdfs(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.company_name) params.append('company_name', filters.company_name);
    if (filters.username) params.append('username', filters.username);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.LIST_PDFS}?${params}`;
    const response = await this.makeRequest(url);

    return response.json();
  }

  async getPdf(id, download = false) {
    const params = download ? '?download=true' : '';
    const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.GET_PDF}/${id}${params}`;
    
    const response = await this.makeRequest(url);

    if (download) {
      return response.blob();
    }
    
    return response.json();
  }

  async deletePdf(id) {
    const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.DELETE_PDF}/${id}`;
    const response = await this.makeRequest(url, {
      method: 'DELETE'
    });

    return response.json();
  }

  async checkHealth() {
    const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.HEALTH}`;
    const response = await this.makeRequest(url);

    return response.json();
  }
}

window.ApiClient = ApiClient;