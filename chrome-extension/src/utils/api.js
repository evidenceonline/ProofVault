// API utilities for ProofVault blockchain integration

// Submit PDF evidence to blockchain
export async function submitToBlockchain(data, apiEndpoint) {
  try {
    const response = await fetch(`${apiEndpoint}/api/pdf/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Version': chrome.runtime.getManifest().version
      },
      body: JSON.stringify({
        hash: data.hash,
        metadata: data.metadata,
        signature: data.signature,
        pdfData: data.pdfData // Base64 encoded PDF
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit to blockchain');
    }
    
    const result = await response.json();
    return {
      transactionHash: result.transactionHash,
      registrationId: result.registrationId,
      blockNumber: result.blockNumber,
      timestamp: result.timestamp
    };
  } catch (error) {
    console.error('Blockchain submission error:', error);
    throw error;
  }
}

// Verify PDF hash on blockchain
export async function verifyOnBlockchain(hash, apiEndpoint) {
  try {
    const response = await fetch(`${apiEndpoint}/api/pdf/verify/${hash}`, {
      method: 'GET',
      headers: {
        'X-Extension-Version': chrome.runtime.getManifest().version
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { verified: false, message: 'Hash not found on blockchain' };
      }
      throw new Error('Verification request failed');
    }
    
    const result = await response.json();
    return {
      verified: true,
      data: {
        hash: result.hash,
        submitter: result.submitterAddress,
        timestamp: result.registrationTimestamp,
        blockNumber: result.blockNumber,
        transactionHash: result.transactionHash,
        metadata: result.metadata
      }
    };
  } catch (error) {
    console.error('Verification error:', error);
    throw error;
  }
}

// Get submission history for address
export async function getSubmissionHistory(address, apiEndpoint) {
  try {
    const response = await fetch(`${apiEndpoint}/api/pdf/history/${address}`, {
      method: 'GET',
      headers: {
        'X-Extension-Version': chrome.runtime.getManifest().version
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }
    
    return await response.json();
  } catch (error) {
    console.error('History fetch error:', error);
    throw error;
  }
}

// Validate PDF integrity
export async function validatePDFIntegrity(pdfBlob, expectedHash, apiEndpoint) {
  try {
    const formData = new FormData();
    formData.append('pdf', pdfBlob, 'document.pdf');
    formData.append('expectedHash', expectedHash);
    
    const response = await fetch(`${apiEndpoint}/api/pdf/validate`, {
      method: 'POST',
      headers: {
        'X-Extension-Version': chrome.runtime.getManifest().version
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Validation request failed');
    }
    
    const result = await response.json();
    return {
      isValid: result.isValid,
      calculatedHash: result.calculatedHash,
      expectedHash: result.expectedHash,
      message: result.message
    };
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }
}

// Check API health
export async function checkAPIHealth(apiEndpoint) {
  try {
    const response = await fetch(`${apiEndpoint}/health`, {
      method: 'GET',
      headers: {
        'X-Extension-Version': chrome.runtime.getManifest().version
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Get blockchain network info
export async function getNetworkInfo(apiEndpoint) {
  try {
    const response = await fetch(`${apiEndpoint}/api/network/info`, {
      method: 'GET',
      headers: {
        'X-Extension-Version': chrome.runtime.getManifest().version
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch network info');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Network info error:', error);
    throw error;
  }
}