// Cryptographic utilities for ProofVault using Web Crypto API

// Generate SHA-256 hash from blob
export async function generateSHA256Hash(blob) {
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    
    // Generate hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error generating SHA-256 hash:', error);
    throw new Error('Failed to generate hash: ' + error.message);
  }
}

// Generate SHA-256 hash from string
export async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate key pair for signing
export async function generateKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );
    
    // Export keys
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    
    return {
      privateKey: arrayBufferToBase64(privateKey),
      publicKey: arrayBufferToBase64(publicKey)
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate key pair: ' + error.message);
  }
}

// Sign data with private key
export async function signData(data, privateKeyBase64) {
  try {
    // Import private key
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    );
    
    // Sign the data
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      privateKey,
      dataBuffer
    );
    
    return arrayBufferToBase64(signature);
  } catch (error) {
    console.error('Error signing data:', error);
    throw new Error('Failed to sign data: ' + error.message);
  }
}

// Verify signature with public key
export async function verifySignature(data, signature, publicKeyBase64) {
  try {
    // Import public key
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['verify']
    );
    
    // Verify the signature
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const signatureBuffer = base64ToArrayBuffer(signature);
    
    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      signatureBuffer,
      dataBuffer
    );
    
    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate random nonce
export function generateNonce() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate hash format
export function isValidSHA256Hash(hash) {
  return /^[a-f0-9]{64}$/i.test(hash);
}