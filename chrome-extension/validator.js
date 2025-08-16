/**
 * ProofVault Input Validation and Sanitization Utility
 * Comprehensive validation for legal evidence capture
 */

class InputValidator {
  constructor() {
    this.patterns = {
      // Organization name: alphanumeric, spaces, common business chars
      organizationName: /^[a-zA-Z0-9\s\-_.&,()]+$/,
      
      // User name: alphanumeric, spaces, common name chars
      userName: /^[a-zA-Z0-9\s\-_.]+$/,
      
      // Evidence ID: ProofVault format or UUID
      evidenceId: /^(PV_\d+_[a-z0-9]{9}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
      
      // URL validation
      url: /^https?:\/\/[^\s<>"'{}|\\^`\[\]]+$/,
      
      // Safe filename characters
      filename: /^[a-zA-Z0-9\s\-_.()]+$/
    };
    
    this.limits = {
      organizationName: { min: 2, max: 100 },
      userName: { min: 2, max: 100 },
      url: { min: 5, max: 2000 },
      title: { min: 1, max: 200 },
      evidenceId: { min: 10, max: 50 }
    };
    
    // Characters that could be dangerous in various contexts
    this.dangerousChars = /<>\"'&\x00-\x1f\x7f-\x9f/g;
    this.sqlInjectionChars = /['";\\%_]/g;
    this.xssChars = /<script|javascript:|on\w+=/gi;
  }

  /**
   * Validate and sanitize organization name
   */
  validateOrganizationName(input) {
    const result = this.createValidationResult();
    
    try {
      // Basic validation
      if (!this.validateRequired(input, 'Organization name')) {
        result.errors.push('Organization name is required');
        return result;
      }
      
      // Length validation
      if (!this.validateLength(input, this.limits.organizationName, 'Organization name')) {
        result.errors.push(`Organization name must be between ${this.limits.organizationName.min} and ${this.limits.organizationName.max} characters`);
      }
      
      // Pattern validation
      if (!this.patterns.organizationName.test(input)) {
        result.errors.push('Organization name contains invalid characters');
      }
      
      // Security validation
      if (this.containsDangerousContent(input)) {
        result.errors.push('Organization name contains potentially dangerous characters');
      }
      
      // Sanitize
      result.sanitized = this.sanitizeText(input);
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push('Validation error occurred');
      console.error('Organization name validation failed:', error);
    }
    
    return result;
  }

  /**
   * Validate and sanitize user name
   */
  validateUserName(input) {
    const result = this.createValidationResult();
    
    try {
      // Basic validation
      if (!this.validateRequired(input, 'User name')) {
        result.errors.push('User name is required');
        return result;
      }
      
      // Length validation
      if (!this.validateLength(input, this.limits.userName, 'User name')) {
        result.errors.push(`User name must be between ${this.limits.userName.min} and ${this.limits.userName.max} characters`);
      }
      
      // Pattern validation
      if (!this.patterns.userName.test(input)) {
        result.errors.push('User name contains invalid characters');
      }
      
      // Security validation
      if (this.containsDangerousContent(input)) {
        result.errors.push('User name contains potentially dangerous characters');
      }
      
      // Sanitize
      result.sanitized = this.sanitizeText(input);
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push('Validation error occurred');
      console.error('User name validation failed:', error);
    }
    
    return result;
  }

  /**
   * Validate URL
   */
  validateUrl(input) {
    const result = this.createValidationResult();
    
    try {
      // Basic validation
      if (!this.validateRequired(input, 'URL')) {
        result.errors.push('URL is required');
        return result;
      }
      
      // Length validation
      if (!this.validateLength(input, this.limits.url, 'URL')) {
        result.errors.push(`URL must be between ${this.limits.url.min} and ${this.limits.url.max} characters`);
      }
      
      // Pattern validation
      if (!this.patterns.url.test(input)) {
        result.errors.push('Invalid URL format');
      }
      
      // Detailed URL validation
      try {
        const urlObj = new URL(input);
        
        // Protocol validation
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          result.errors.push('URL must use HTTP or HTTPS protocol');
        }
        
        // Host validation
        if (!urlObj.hostname) {
          result.errors.push('URL must have a valid hostname');
        }
        
        // Dangerous protocols check
        if (input.match(/^(javascript|data|vbscript|file):/i)) {
          result.errors.push('URL protocol is not allowed');
        }
        
      } catch (urlError) {
        result.errors.push('URL format is invalid');
      }
      
      // Security validation
      if (this.containsDangerousContent(input)) {
        result.errors.push('URL contains potentially dangerous characters');
      }
      
      // Sanitize
      result.sanitized = this.sanitizeUrl(input);
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push('URL validation error occurred');
      console.error('URL validation failed:', error);
    }
    
    return result;
  }

  /**
   * Validate page title
   */
  validatePageTitle(input) {
    const result = this.createValidationResult();
    
    try {
      // Title can be empty (some pages don't have titles)
      if (!input || input.trim() === '') {
        result.sanitized = 'Untitled Page';
        result.isValid = true;
        return result;
      }
      
      // Length validation
      if (!this.validateLength(input, this.limits.title, 'Page title')) {
        result.errors.push(`Page title must be between ${this.limits.title.min} and ${this.limits.title.max} characters`);
      }
      
      // Security validation
      if (this.containsDangerousContent(input)) {
        result.errors.push('Page title contains potentially dangerous characters');
      }
      
      // Sanitize
      result.sanitized = this.sanitizeText(input);
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push('Title validation error occurred');
      console.error('Page title validation failed:', error);
    }
    
    return result;
  }

  /**
   * Validate evidence ID
   */
  validateEvidenceId(input) {
    const result = this.createValidationResult();
    
    try {
      // Basic validation
      if (!this.validateRequired(input, 'Evidence ID')) {
        result.errors.push('Evidence ID is required');
        return result;
      }
      
      // Length validation
      if (!this.validateLength(input, this.limits.evidenceId, 'Evidence ID')) {
        result.errors.push(`Evidence ID must be between ${this.limits.evidenceId.min} and ${this.limits.evidenceId.max} characters`);
      }
      
      // Pattern validation
      if (!this.patterns.evidenceId.test(input)) {
        result.errors.push('Evidence ID format is invalid');
      }
      
      // Sanitize (no changes needed for valid IDs)
      result.sanitized = input.trim();
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push('Evidence ID validation error occurred');
      console.error('Evidence ID validation failed:', error);
    }
    
    return result;
  }

  /**
   * Validate PDF blob
   */
  validatePdfBlob(blob) {
    const result = this.createValidationResult();
    
    try {
      // Check if blob exists
      if (!blob) {
        result.errors.push('PDF file is required');
        return result;
      }
      
      // Check if it's a Blob
      if (!(blob instanceof Blob)) {
        result.errors.push('Invalid PDF file format');
        return result;
      }
      
      // Check file size (max 25MB)
      const maxSize = 25 * 1024 * 1024;
      if (blob.size > maxSize) {
        result.errors.push(`PDF file is too large (${Math.round(blob.size / 1024 / 1024)}MB). Maximum size is 25MB`);
      }
      
      // Check minimum size (1KB)
      if (blob.size < 1024) {
        result.errors.push('PDF file is too small or corrupted');
      }
      
      // Check MIME type if available
      if (blob.type && !blob.type.includes('pdf') && blob.type !== 'application/octet-stream') {
        result.warnings = result.warnings || [];
        result.warnings.push('File type may not be PDF');
      }
      
      result.sanitized = blob; // Blobs don't need sanitization
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push('PDF validation error occurred');
      console.error('PDF blob validation failed:', error);
    }
    
    return result;
  }

  /**
   * Validate complete evidence form data
   */
  validateEvidenceForm(formData) {
    const results = {
      organization: this.validateOrganizationName(formData.organization),
      user: this.validateUserName(formData.user),
      url: this.validateUrl(formData.url),
      title: this.validatePageTitle(formData.title)
    };
    
    // Add evidence ID validation if provided
    if (formData.evidenceId) {
      results.evidenceId = this.validateEvidenceId(formData.evidenceId);
    }
    
    // Add PDF validation if provided
    if (formData.pdfBlob) {
      results.pdfBlob = this.validatePdfBlob(formData.pdfBlob);
    }
    
    // Overall validation
    const allValid = Object.values(results).every(result => result.isValid);
    const allErrors = Object.values(results).flatMap(result => result.errors);
    const allWarnings = Object.values(results).flatMap(result => result.warnings || []);
    
    return {
      isValid: allValid,
      results,
      errors: allErrors,
      warnings: allWarnings,
      sanitized: {
        organization: results.organization.sanitized,
        user: results.user.sanitized,
        url: results.url.sanitized,
        title: results.title.sanitized,
        evidenceId: results.evidenceId?.sanitized,
        pdfBlob: results.pdfBlob?.sanitized
      }
    };
  }

  /**
   * Helper method to validate required fields
   */
  validateRequired(input, fieldName) {
    return input !== null && input !== undefined && String(input).trim() !== '';
  }

  /**
   * Helper method to validate length
   */
  validateLength(input, limits, fieldName) {
    const length = String(input).trim().length;
    return length >= limits.min && length <= limits.max;
  }

  /**
   * Check for dangerous content
   */
  containsDangerousContent(input) {
    const text = String(input);
    
    // Check for dangerous characters
    if (this.dangerousChars.test(text)) {
      return true;
    }
    
    // Check for XSS patterns
    if (this.xssChars.test(text)) {
      return true;
    }
    
    // Check for SQL injection patterns
    if (this.sqlInjectionChars.test(text) && /('|"|\b(union|select|insert|update|delete|drop|create|alter)\b)/i.test(text)) {
      return true;
    }
    
    return false;
  }

  /**
   * Sanitize text input
   */
  sanitizeText(input) {
    if (!input) return '';
    
    return String(input)
      .trim()
      .replace(this.dangerousChars, '') // Remove dangerous characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 255); // Limit length
  }

  /**
   * Sanitize URL input
   */
  sanitizeUrl(input) {
    if (!input) return '';
    
    try {
      // Create URL object to normalize
      const url = new URL(input.trim());
      return url.toString();
    } catch (error) {
      // If URL parsing fails, return sanitized string
      return this.sanitizeText(input);
    }
  }

  /**
   * Create validation result object
   */
  createValidationResult() {
    return {
      isValid: false,
      errors: [],
      warnings: [],
      sanitized: null
    };
  }

  /**
   * Generate secure filename from metadata
   */
  generateSecureFilename(metadata) {
    try {
      const sanitizedOrg = this.sanitizeFilenameComponent(metadata.organization || 'Unknown');
      const sanitizedUser = this.sanitizeFilenameComponent(metadata.user || 'User');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const id = metadata.evidenceId || metadata.id || 'Unknown';
      
      return `ProofVault_${sanitizedOrg}_${sanitizedUser}_${timestamp}_${id}.pdf`;
      
    } catch (error) {
      console.error('Filename generation failed:', error);
      return `ProofVault_Evidence_${Date.now()}.pdf`;
    }
  }

  /**
   * Sanitize filename component
   */
  sanitizeFilenameComponent(input) {
    return String(input)
      .trim()
      .replace(/[^a-zA-Z0-9\-_]/g, '_') // Replace invalid chars with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .substring(0, 50); // Limit length
  }
}

// Export for use in other modules
window.InputValidator = InputValidator;