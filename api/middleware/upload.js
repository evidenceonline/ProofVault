const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { APIError } = require('./errorHandler');

// Configure multer for memory storage (we'll store in database)
const storage = multer.memoryStorage();

// File filter to only allow PDF files
const fileFilter = (req, file, cb) => {
  // Check file extension
  const allowedExtensions = ['.pdf'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error('Invalid file type. Only PDF files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Check MIME type
  const allowedMimeTypes = ['application/pdf'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error('Invalid file type. Only PDF files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only allow 1 file per request
    fields: 10, // Limit number of fields
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1 * 1024 * 1024 // 1MB limit for field values
  }
});

// Middleware to validate PDF file content
const validatePDFContent = (req, res, next) => {
  if (!req.file) {
    return next(new APIError('No file uploaded', 400));
  }

  const buffer = req.file.buffer;
  
  // Check if file starts with PDF signature
  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
  if (!buffer.subarray(0, 4).equals(pdfSignature)) {
    return next(new APIError('Invalid PDF file format', 400));
  }

  // Check if file is not empty
  if (buffer.length === 0) {
    return next(new APIError('Uploaded file is empty', 400));
  }

  // Add file hash to request for deduplication
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  req.fileHash = hash.digest('hex');

  next();
};

// Middleware to validate required fields
const validateUploadFields = (req, res, next) => {
  const { company_name, username } = req.body;

  if (!company_name || typeof company_name !== 'string' || company_name.trim().length === 0) {
    return next(new APIError('Company name is required and must be a non-empty string', 400));
  }

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return next(new APIError('Username is required and must be a non-empty string', 400));
  }

  // Sanitize input fields
  req.body.company_name = company_name.trim().substring(0, 255);
  req.body.username = username.trim().substring(0, 255);

  next();
};

// Middleware to handle file size exceeded error specifically
const handleFileSizeError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new APIError('File size exceeds the maximum limit of 10MB', 413));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new APIError('Only one file can be uploaded at a time', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new APIError('Unexpected file field. Use "pdf" as the field name', 400));
    }
  }
  
  if (err.code === 'INVALID_FILE_TYPE') {
    return next(new APIError(err.message, 400));
  }

  next(err);
};

// Single file upload middleware with all validations
const uploadSinglePDF = [
  upload.single('pdf'), // Field name should be 'pdf'
  handleFileSizeError,
  validateUploadFields,
  validatePDFContent
];

// Multiple files upload middleware (for future use)
const uploadMultiplePDFs = [
  upload.array('pdfs', 5), // Field name should be 'pdfs', max 5 files
  handleFileSizeError,
  validateUploadFields,
  (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next(new APIError('No files uploaded', 400));
    }

    // Validate each file and generate hashes
    req.fileHashes = [];
    for (const file of req.files) {
      const buffer = file.buffer;
      
      // Check PDF signature
      const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      if (!buffer.subarray(0, 4).equals(pdfSignature)) {
        return next(new APIError(`Invalid PDF file format: ${file.originalname}`, 400));
      }

      // Generate hash
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      req.fileHashes.push(hash.digest('hex'));
    }

    next();
  }
];

module.exports = {
  upload,
  uploadSinglePDF,
  uploadMultiplePDFs,
  validatePDFContent,
  validateUploadFields,
  handleFileSizeError
};