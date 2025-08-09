const express = require('express');
const { uploadSinglePDF } = require('../middleware/upload');
const {
  uploadPDF,
  getPDFList,
  getPDFById,
  deletePDFById,
  getPDFStats,
  verifyPDFOnBlockchain
} = require('../controllers/pdfController');

const router = express.Router();

// POST /api/pdf/upload - Upload a PDF file
router.post('/upload', uploadSinglePDF, uploadPDF);

// GET /api/pdf/list - Get list of PDFs with pagination and filtering
// Query parameters:
// - page: page number (default: 1)
// - limit: items per page (default: 10, max: 100)
// - search: global search across company_name, username, pdf_filename, and id
// - company_name: filter by company name (partial match)
// - username: filter by username (partial match)
// - date_from: filter by created date from (ISO 8601 format)
// - date_to: filter by created date to (ISO 8601 format)
// - sort_by: sort field (created_at, company_name, username, pdf_filename)
// - sort_order: ASC or DESC (default: DESC)
router.get('/list', getPDFList);

// GET /api/pdf/stats - Get PDF statistics
router.get('/stats', getPDFStats);

// GET /api/pdf/:id - Get PDF metadata by ID
// Query parameters:
// - download: true/false - if true, downloads the PDF file
router.get('/:id', getPDFById);

// GET /api/pdf/:id/verify - Verify PDF hash on blockchain
router.get('/:id/verify', verifyPDFOnBlockchain);

// DELETE /api/pdf/:id - Delete PDF by ID
router.delete('/:id', deletePDFById);

module.exports = router;