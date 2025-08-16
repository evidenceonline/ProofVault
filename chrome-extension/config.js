console.log('[CONFIG] Loading API configuration');

const API_CONFIG = {
  BASE_URL: 'http://localhost:3003/api',
  ENDPOINTS: {
    UPLOAD_PDF: '/pdf/upload',
    LIST_PDFS: '/pdf/list',
    GET_PDF: '/pdf',
    DELETE_PDF: '/pdf',
    HEALTH: '/health'
  },
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3
};

console.log('[CONFIG] API configuration loaded:', API_CONFIG);
window.API_CONFIG = API_CONFIG;