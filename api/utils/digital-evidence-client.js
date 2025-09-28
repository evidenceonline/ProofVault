const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const secp256k1 = require('secp256k1');
const { sha256 } = require('js-sha256');
const { sha512 } = require('js-sha512');

/**
 * Constellation Digital Evidence API Client
 *
 * This client handles all interactions with Constellation's Digital Evidence API
 * for tamper-proof legal evidence verification.
 */
class DigitalEvidenceClient {
  constructor() {
    this.apiKey = process.env.DE_API_KEY;
    this.organizationId = process.env.DE_ORGANIZATION_ID;
    this.tenantId = process.env.DE_TENANT_ID;
    this.baseUrl = 'https://de-api.constellationnetwork.io/v1';

    if (!this.apiKey || !this.organizationId || !this.tenantId) {
      throw new Error('Digital Evidence API credentials not configured. Check environment variables.');
    }

    // Generate or load ECDSA key pair for signing
    this.initializeKeys();
  }

  initializeKeys() {
    // Generate a new secp256k1 key pair for ProofVault system signing
    // In production, you'd want to store and reuse this key
    let privateKey;
    do {
      privateKey = crypto.randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privateKey));

    this.privateKey = privateKey;
    this.publicKey = secp256k1.publicKeyCreate(privateKey, false); // uncompressed format
    this.signerId = 'ProofVault-System'; // Human-readable signer ID
    this.publicKeyHex = Buffer.from(this.publicKey).toString('hex');

    console.log(`🔐 Digital Evidence signing initialized`);
    console.log(`📋 Public Key: ${this.publicKeyHex.slice(0, 20)}...`);
  }

  /**
   * Compute the fingerprint content hash (SHA-256 of canonical JSON)
   * @param {Object} content - The fingerprint content
   * @returns {string} SHA-256 hash in hex format
   */
  computeFingerprintContentHash(content) {
    try {
      // Step 1: Canonicalize JSON according to RFC 8785
      const canonicalJson = this.canonicalizeJson(content);

      // Step 2: Convert to UTF-8 bytes
      const utf8Bytes = Buffer.from(canonicalJson, 'utf8');

      // Step 3: Compute SHA-256 hash
      const sha256Hash = sha256.create();
      sha256Hash.update(utf8Bytes);
      const sha256Hex = sha256Hash.hex();

      return sha256Hex;
    } catch (error) {
      console.error('❌ Fingerprint content hash computation failed:', error);
      throw new Error(`Failed to compute fingerprint content hash: ${error.message}`);
    }
  }

  /**
   * Create ECDSA signature according to Digital Evidence specification
   * @param {Object} content - The fingerprint content to sign
   * @returns {string} DER-encoded signature in hex format
   */
  createSignature(content) {
    try {
      // Step 1: Canonicalize JSON according to RFC 8785
      const canonicalJson = this.canonicalizeJson(content);

      // Step 2: Convert to UTF-8 bytes
      const utf8Bytes = Buffer.from(canonicalJson, 'utf8');

      // Step 3: Compute SHA-256 hash
      const sha256Hash = sha256.create();
      sha256Hash.update(utf8Bytes);
      const sha256Hex = sha256Hash.hex();

      // Step 4: Convert hash hex to UTF-8 bytes
      const hashBytes = Buffer.from(sha256Hex, 'utf8');

      // Step 5: Compute SHA-512 hash
      const sha512Hash = sha512.create();
      sha512Hash.update(hashBytes);
      const sha512Bytes = sha512Hash.arrayBuffer();

      // Step 6: Truncate to 32 bytes
      const truncatedHash = new Uint8Array(sha512Bytes, 0, 32);

      // Step 7: Sign with ECDSA secp256k1
      const signObj = secp256k1.ecdsaSign(truncatedHash, this.privateKey);

      // Step 8: Convert to DER format
      const derSignature = this.toDER(signObj.signature);

      return Buffer.from(derSignature).toString('hex');
    } catch (error) {
      console.error('❌ Signature creation failed:', error);
      throw new Error(`Failed to create signature: ${error.message}`);
    }
  }

  /**
   * Canonicalize JSON according to RFC 8785
   * @param {Object} obj - Object to canonicalize
   * @returns {string} Canonical JSON string
   */
  canonicalizeJson(obj) {
    // Simple RFC 8785 implementation for our use case
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  /**
   * Convert ECDSA signature to DER format
   * @param {Uint8Array} signature - Raw signature from secp256k1
   * @returns {Uint8Array} DER-encoded signature
   */
  toDER(signature) {
    const r = signature.slice(0, 32);
    const s = signature.slice(32, 64);

    // Simple DER encoding for ECDSA signature
    const rBytes = this.removeLeadingZeros(r);
    const sBytes = this.removeLeadingZeros(s);

    const rLen = rBytes.length;
    const sLen = sBytes.length;
    const totalLen = 4 + rLen + sLen;

    const der = new Uint8Array(2 + totalLen);
    der[0] = 0x30; // SEQUENCE
    der[1] = totalLen;
    der[2] = 0x02; // INTEGER (r)
    der[3] = rLen;
    der.set(rBytes, 4);
    der[4 + rLen] = 0x02; // INTEGER (s)
    der[5 + rLen] = sLen;
    der.set(sBytes, 6 + rLen);

    return der;
  }

  /**
   * Remove leading zeros from byte array
   * @param {Uint8Array} bytes - Input bytes
   * @returns {Uint8Array} Bytes with leading zeros removed
   */
  removeLeadingZeros(bytes) {
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) {
      start++;
    }
    // If first bit is set, prepend 0x00 to make it positive
    if (bytes[start] >= 0x80) {
      const result = new Uint8Array(bytes.length - start + 1);
      result[0] = 0x00;
      result.set(bytes.slice(start), 1);
      return result;
    }
    return bytes.slice(start);
  }

  /**
   * Create a fingerprint for digital evidence
   * @param {Object} params - Fingerprint parameters
   * @param {string} params.documentRef - SHA-256 hash of the document
   * @param {string} params.eventId - Unique event identifier (PDF record ID)
   * @param {string} params.documentId - Document identifier (filename or ID)
   * @param {string} params.metadata - Additional metadata (optional)
   * @returns {Object} Fingerprint data with hash and submission details
   */
  async submitFingerprint({ documentRef, eventId, documentId, metadata = {} }) {
    try {
      console.log(`📄 Submitting fingerprint for document: ${documentId}`);

      // Create fingerprint content according to Digital Evidence API spec
      const fingerprintContent = {
        orgId: this.organizationId,
        tenantId: this.tenantId,
        eventId: eventId,
        signerId: this.publicKeyHex,
        documentId: documentId,
        documentRef: documentRef,
        timestamp: new Date().toISOString(),
        version: 1
      };

      // Compute the fingerprint content hash (what should be in metadata.hash)
      const fingerprintContentHash = this.computeFingerprintContentHash(fingerprintContent);
      console.log(`🔍 Document Hash (documentRef): ${documentRef}`);
      console.log(`🔍 Fingerprint Content Hash: ${fingerprintContentHash}`);

      // Create signature according to the documentation
      const signature = this.createSignature(fingerprintContent);

      // Create the complete payload structure as per API spec
      const submission = {
        attestation: {
          content: fingerprintContent,
          proofs: [{
            id: this.publicKeyHex,
            signature: signature,
            algorithm: "SECP256K1_RFC8785_V1"
          }]
        },
        metadata: {
          hash: fingerprintContentHash, // ✅ Use fingerprint content hash, not document hash
          organizationName: 'ProofVault', // Try explicit organization name
          tags: {
            company: metadata.company || 'ProofVault',
            filename: (metadata.filename || documentId).substring(0, 32),
            organizationName: 'ProofVault', // Try in tags too
            organization: 'ProofVault' // Another variation
          }
        }
      };

      // API expects array format
      const payload = [submission];

      console.log(`🔗 Submitting to Digital Evidence API...`);
      console.log(`📄 Payload:`, JSON.stringify(payload, null, 2));

      // Try different endpoint and headers based on API documentation
      console.log(`🔗 Trying endpoint: ${this.baseUrl}/fingerprints`);
      const response = await fetch(`${this.baseUrl}/fingerprints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'ProofVault/1.0'
        },
        body: JSON.stringify(payload)
      });

      console.log(`📄 Response Status: ${response.status}`);
      console.log(`📄 Response Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Digital Evidence API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Digital Evidence submission successful`);
      console.log(`📄 Response:`, JSON.stringify(result, null, 2));

      // Try to extract fingerprint hash from various possible response formats
      let fingerprintHash = null;
      let responseData = null;

      if (Array.isArray(result)) {
        responseData = result[0];
        fingerprintHash = responseData?.hash || responseData?.fingerprintHash;
      } else if (result.hash) {
        fingerprintHash = result.hash;
        responseData = result;
      } else if (result.fingerprintHash) {
        fingerprintHash = result.fingerprintHash;
        responseData = result;
      } else if (result.data?.hash) {
        fingerprintHash = result.data.hash;
        responseData = result.data;
      }

      if (!fingerprintHash) {
        console.log(`⚠️ No fingerprint hash found, using document hash as fallback`);
        fingerprintHash = documentRef; // Use original document hash as fallback
      }

      const explorerUrl = `https://digitalevidence.constellationnetwork.io/fingerprint/${fingerprintHash}`;
      console.log(`🔍 Explorer URL: ${explorerUrl}`);

      return {
        success: true,
        fingerprintHash: fingerprintHash,
        explorerUrl: explorerUrl,
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
        accepted: responseData?.accepted || true,
        eventId: responseData?.eventId || eventId,
        rawResponse: result
      };

    } catch (error) {
      console.error('❌ Digital Evidence submission failed:', error);
      throw new Error(`Failed to submit to Digital Evidence API: ${error.message}`);
    }
  }

  /**
   * Check the status of a submitted fingerprint
   * @param {string} fingerprintHash - The fingerprint hash to check
   * @returns {Object} Status information
   */
  async checkFingerprintStatus(fingerprintHash) {
    try {
      console.log(`🔍 Checking fingerprint status: ${fingerprintHash}`);

      const response = await fetch(`${this.baseUrl}/fingerprints/${fingerprintHash}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'NOT_FOUND' };
        }
        throw new Error(`Status check failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`📊 Fingerprint status: ${result.data?.status || 'Unknown'}`);

      const status = result.data?.status || 'ERROR';

      return {
        status: status,
        isFinalized: status === 'FINALIZED_COMMITMENT',
        explorerUrl: `https://digitalevidence.constellationnetwork.io/fingerprint/${fingerprintHash}`,
        rawResponse: result
      };

    } catch (error) {
      console.error('❌ Status check failed:', error);
      return { status: 'ERROR', error: error.message };
    }
  }

  /**
   * Search for fingerprints by various criteria
   * @param {Object} filters - Search filters
   * @returns {Object} Search results
   */
  async searchFingerprints(filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.documentId) params.append('document_id', filters.documentId);
      if (filters.eventId) params.append('event_id', filters.eventId);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);

      const response = await fetch(`${this.baseUrl}/fingerprints?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Generate a verification certificate URL for legal use
   * @param {string} fingerprintHash - The fingerprint hash
   * @returns {string} Certificate URL
   */
  getVerificationCertificateUrl(fingerprintHash) {
    return `https://digitalevidence.constellationnetwork.io/fingerprint/${fingerprintHash}`;
  }

  /**
   * Health check for Digital Evidence API
   * @returns {boolean} API availability
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/fingerprints/stats`, {
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      console.error('Digital Evidence API health check failed:', error);
      return false;
    }
  }
}

module.exports = new DigitalEvidenceClient();