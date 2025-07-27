console.log('[CONFIG] Loading API configuration');
alert('[CONFIG] JavaScript is working - config loading');

const API_CONFIG = {
  BASE_URL: 'http://proofvault.net:3003/api',
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
alert('[CONFIG] API config created: ' + API_CONFIG.BASE_URL);
window.API_CONFIG = API_CONFIG;