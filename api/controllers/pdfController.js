const { pool } = require('../config/database');
const { APIError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

// Upload PDF file
const uploadPDF = async (req, res, next) => {
  try {
    const { company_name, username } = req.body;
    const file = req.file;
    const fileHash = req.fileHash;

    if (!file) {
      return next(new APIError('No file uploaded', 400));
    }

    const client = await pool.connect();
    
    try {
      // Check if PDF with same hash already exists
      const existingPDF = await client.query(
        'SELECT id, pdf_filename, company_name, username, created_at FROM pdf_records WHERE pdf_hash = $1',
        [fileHash]
      );

      if (existingPDF.rows.length > 0) {
        const existing = existingPDF.rows[0];
        client.release();
        
        return res.status(409).json({
          success: false,
          status: 'error',
          message: 'PDF file already exists',
          data: {
            existing_record: {
              id: existing.id,
              filename: existing.pdf_filename,
              company_name: existing.company_name,
              username: existing.username,
              created_at: existing.created_at
            }
          }
        });
      }

      // Generate file_id in format "company-year-month"
      const now = new Date();
      const year = now.getFullYear();
      const month = now.toLocaleString('en-US', { month: 'long' });
      const file_id = `${company_name}-${year}-${month}`;

      // Generate a UUID for the record
      const recordId = uuidv4();
      
      // Insert new PDF record (only columns that exist in the table)
      const result = await client.query(
        `INSERT INTO pdf_records (id, company_name, username, pdf_filename, pdf_hash, pdf_data, file_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, company_name, username, pdf_filename, pdf_hash, created_at, file_id`,
        [recordId, company_name, username, file.originalname, fileHash, file.buffer, file_id]
      );

      client.release();

      const newRecord = result.rows[0];

      res.status(201).json({
        success: true,
        status: 'success',
        message: 'PDF uploaded successfully',
        data: {
          id: newRecord.id,
          company_name: newRecord.company_name,
          username: newRecord.username,
          filename: newRecord.pdf_filename,
          pdf_hash: newRecord.pdf_hash,
          file_size: file.size, // Use the original file size from multer
          status: 'verified', // Default status since column doesn't exist
          created_at: newRecord.created_at,
          file_id: newRecord.file_id
        }
      });

    } catch (dbError) {
      client.release();
      throw dbError;
    }

  } catch (error) {
    console.error('Error uploading PDF:', error);
    next(error);
  }
};

// Get list of PDFs with pagination and filtering
const getPDFList = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      company_name,
      username,
      search,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;

    // Validate sort parameters - only use existing columns
    const allowedSortFields = ['created_at', 'company_name', 'username', 'pdf_filename', 'file_id'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const client = await pool.connect();

    try {
      // Build WHERE clause
      let whereClause = '';
      let whereParams = [];
      let paramIndex = 1;

      // Global search across multiple fields
      if (search) {
        whereClause += `WHERE (
          company_name ILIKE $${paramIndex} OR 
          username ILIKE $${paramIndex} OR 
          pdf_filename ILIKE $${paramIndex} OR 
          file_id ILIKE $${paramIndex} OR 
          id::text ILIKE $${paramIndex}
        )`;
        whereParams.push(`%${search}%`);
        paramIndex++;
      }

      // Specific field filters
      if (company_name) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += `company_name ILIKE $${paramIndex}`;
        whereParams.push(`%${company_name}%`);
        paramIndex++;
      }

      if (username) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += `username ILIKE $${paramIndex}`;
        whereParams.push(`%${username}%`);
        paramIndex++;
      }

      // Date range filtering
      if (date_from) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += `created_at >= $${paramIndex}`;
        whereParams.push(date_from);
        paramIndex++;
      }

      if (date_to) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += `created_at <= $${paramIndex}`;
        whereParams.push(date_to);
        paramIndex++;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM pdf_records ${whereClause}`;
      const countResult = await client.query(countQuery, whereParams);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get paginated results - handle missing columns gracefully
      const query = `
        SELECT id, company_name, username, pdf_filename, pdf_hash, 
               LENGTH(pdf_data) as file_size, 
               'verified' as status, 
               created_at,
               created_at as updated_at,
               file_id
        FROM pdf_records 
        ${whereClause}
        ORDER BY ${sortField} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const queryParams = [...whereParams, limitNum, offset];
      const result = await client.query(query, queryParams);

      client.release();

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        status: 'success',
        data: result.rows,
        pagination: {
          current_page: pageNum,
          per_page: limitNum,
          total_count: totalCount,
          total_pages: totalPages,
          has_next_page: hasNextPage,
          has_prev_page: hasPrevPage
        },
        filters: {
          search: search || null,
          company_name: company_name || null,
          username: username || null,
          date_from: date_from || null,
          date_to: date_to || null
        },
        sorting: {
          sort_by: sortField,
          sort_order: sortDirection
        }
      });

    } catch (dbError) {
      client.release();
      throw dbError;
    }

  } catch (error) {
    console.error('Error getting PDF list:', error);
    next(error);
  }
};

// Get PDF by ID (download)
const getPDFById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { download = 'false' } = req.query;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return next(new APIError('Invalid PDF ID format', 400));
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT * FROM pdf_records WHERE id = $1',
        [id]
      );

      client.release();

      if (result.rows.length === 0) {
        return next(new APIError('PDF not found', 404));
      }

      const record = result.rows[0];

      // If download parameter is true, send the PDF file
      if (download === 'true') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${record.pdf_filename}"`);
        res.setHeader('Content-Length', record.pdf_data.length);
        return res.send(record.pdf_data);
      }

      // Otherwise, return metadata only
      res.status(200).json({
        success: true,
        status: 'success',
        data: {
          id: record.id,
          company_name: record.company_name,
          username: record.username,
          pdf_filename: record.pdf_filename,
          pdf_hash: record.pdf_hash,
          file_size: record.file_size || record.pdf_data.length,
          status: record.status || 'verified',
          created_at: record.created_at,
          updated_at: record.updated_at,
          file_id: record.file_id,
          download_url: `/api/pdf/${id}?download=true`
        }
      });

    } catch (dbError) {
      client.release();
      throw dbError;
    }

  } catch (error) {
    console.error('Error getting PDF by ID:', error);
    next(error);
  }
};

// Delete PDF by ID
const deletePDFById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return next(new APIError('Invalid PDF ID format', 400));
    }

    const client = await pool.connect();

    try {
      // First check if the record exists
      const checkResult = await client.query(
        'SELECT id, pdf_filename, company_name, username FROM pdf_records WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        client.release();
        return next(new APIError('PDF not found', 404));
      }

      const record = checkResult.rows[0];

      // Delete the record
      await client.query(
        'DELETE FROM pdf_records WHERE id = $1',
        [id]
      );

      client.release();

      res.status(200).json({
        success: true,
        status: 'success',
        message: 'PDF deleted successfully',
        data: {
          deleted_record: {
            id: record.id,
            pdf_filename: record.pdf_filename,
            company_name: record.company_name,
            username: record.username
          }
        }
      });

    } catch (dbError) {
      client.release();
      throw dbError;
    }

  } catch (error) {
    console.error('Error deleting PDF:', error);
    next(error);
  }
};

// Get PDF statistics
const getPDFStats = async (req, res, next) => {
  try {
    const client = await pool.connect();

    try {
      // Get various statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_pdfs,
          COUNT(DISTINCT company_name) as unique_companies,
          COUNT(DISTINCT username) as unique_users,
          SUM(LENGTH(pdf_data)) as total_storage_bytes,
          AVG(LENGTH(pdf_data)) as avg_file_size_bytes,
          MIN(created_at) as oldest_record,
          MAX(created_at) as newest_record
        FROM pdf_records
      `;

      const statsResult = await client.query(statsQuery);
      const stats = statsResult.rows[0];

      // Get top companies by PDF count
      const topCompaniesQuery = `
        SELECT company_name, COUNT(*) as pdf_count
        FROM pdf_records
        GROUP BY company_name
        ORDER BY pdf_count DESC
        LIMIT 10
      `;

      const topCompaniesResult = await client.query(topCompaniesQuery);

      // Get top users by PDF count
      const topUsersQuery = `
        SELECT username, COUNT(*) as pdf_count
        FROM pdf_records
        GROUP BY username
        ORDER BY pdf_count DESC
        LIMIT 10
      `;

      const topUsersResult = await client.query(topUsersQuery);

      // Get records by month for the last 12 months
      const monthlyStatsQuery = `
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as pdf_count
        FROM pdf_records
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `;

      const monthlyStatsResult = await client.query(monthlyStatsQuery);

      client.release();

      res.status(200).json({
        success: true,
        status: 'success',
        data: {
          overview: {
            total_pdfs: parseInt(stats.total_pdfs),
            unique_companies: parseInt(stats.unique_companies),
            unique_users: parseInt(stats.unique_users),
            total_storage_bytes: parseInt(stats.total_storage_bytes),
            total_storage_mb: Math.round(parseInt(stats.total_storage_bytes) / (1024 * 1024) * 100) / 100,
            avg_file_size_bytes: Math.round(parseFloat(stats.avg_file_size_bytes)),
            avg_file_size_mb: Math.round(parseFloat(stats.avg_file_size_bytes) / (1024 * 1024) * 100) / 100,
            oldest_record: stats.oldest_record,
            newest_record: stats.newest_record
          },
          top_companies: topCompaniesResult.rows,
          top_users: topUsersResult.rows,
          monthly_stats: monthlyStatsResult.rows
        }
      });

    } catch (dbError) {
      client.release();
      throw dbError;
    }

  } catch (error) {
    console.error('Error getting PDF stats:', error);
    next(error);
  }
};

module.exports = {
  uploadPDF,
  getPDFList,
  getPDFById,
  deletePDFById,
  getPDFStats
};