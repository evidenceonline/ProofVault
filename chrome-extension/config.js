// Centralized backend configuration
// Set DEVELOPMENT to true for local testing, false for production
const DEVELOPMENT = true;

const PV_CONFIG = DEVELOPMENT ? {
  // Development configuration (local testing)
  API_UPLOAD_URL: "http://localhost:4000/api/pdf/upload",
  API_HEALTH_URL: "http://localhost:4000/api/health",
  WEB_APP_URL: "http://localhost:4002/"
} : {
  // Production configuration (Digital Evidence API on 4000)
  API_UPLOAD_URL: "http://proofvault.net:4000/api/pdf/upload",
  API_HEALTH_URL: "http://proofvault.net:4000/api/health",
  WEB_APP_URL: "http://proofvault.net:4002/"
};