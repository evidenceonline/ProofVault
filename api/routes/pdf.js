const express = require('express');
const { uploadSinglePDF } = require('../middleware/upload');
const {
  uploadPDF,
  getPDFList,
  getPDFById,
  deletePDFById,
  getPDFStats
} = require('../controllers/pdfController');

const router = express.Router();

// POST /api/pdf/upload - Upload a PDF file
router.post('/upload', uploadSinglePDF, uploadPDF);

// GET /api/pdf/list - Get list of PDFs with pagination and filtering
// Query parameters:
// - page: page number (default: 1)
// - limit: items per page (default: 10, max: 100)
// - company_name: filter by company name (partial match)
// - username: filter by username (partial match)
// - sort_by: sort field (created_at, company_name, username, pdf_filename)
// - sort_order: ASC or DESC (default: DESC)
router.get('/list', getPDFList);

// GET /api/pdf/stats - Get PDF statistics
router.get('/stats', getPDFStats);

// GET /api/pdf/:id - Get PDF metadata by ID
// Query parameters:
// - download: true/false - if true, downloads the PDF file
router.get('/:id', getPDFById);

// DELETE /api/pdf/:id - Delete PDF by ID
router.delete('/:id', deletePDFById);

module.exports = router;