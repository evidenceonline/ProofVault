const API_CONFIG = {
  BASE_URL: 'http://proofvault.net:3001/api',
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

window.API_CONFIG = API_CONFIG;