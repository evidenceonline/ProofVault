// Tests for cryptoUtils.js
import { generateSHA256Hash, hashString, generateKeyPair, signData, verifySignature, generateNonce, isValidSHA256Hash } from './cryptoUtils.js';

describe('CryptoUtils', () => {
  describe('generateSHA256Hash', () => {
    it('should generate hash from blob', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      const hash = await generateSHA256Hash(blob);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
    });
    
    it('should handle empty blob', async () => {
      const blob = new Blob([], { type: 'text/plain' });
      const hash = await generateSHA256Hash(blob);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });
  
  describe('hashString', () => {
    it('should generate hash from string', async () => {
      const hash = await hashString('test string');
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });
    
    it('should produce consistent hashes', async () => {
      const input = 'consistent test';
      const hash1 = await hashString(input);
      const hash2 = await hashString(input);
      
      expect(hash1).toBe(hash2);
    });
  });
  
  describe('generateKeyPair', () => {
    it('should generate key pair', async () => {
      const keyPair = await generateKeyPair();
      
      expect(keyPair).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(typeof keyPair.privateKey).toBe('string');
      expect(typeof keyPair.publicKey).toBe('string');
    });
    
    it('should generate unique key pairs', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });
  });
  
  describe('signData and verifySignature', () => {
    it('should sign and verify data', async () => {
      const keyPair = await generateKeyPair();
      const data = 'test data to sign';
      
      const signature = await signData(data, keyPair.privateKey);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      
      const isValid = await verifySignature(data, signature, keyPair.publicKey);
      expect(isValid).toBe(true);
    });
    
    it('should fail verification with wrong public key', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      const data = 'test data';
      
      const signature = await signData(data, keyPair1.privateKey);
      const isValid = await verifySignature(data, signature, keyPair2.publicKey);
      
      expect(isValid).toBe(false);
    });
    
    it('should fail verification with tampered data', async () => {
      const keyPair = await generateKeyPair();
      const originalData = 'original data';
      const tamperedData = 'tampered data';
      
      const signature = await signData(originalData, keyPair.privateKey);
      const isValid = await verifySignature(tamperedData, signature, keyPair.publicKey);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('generateNonce', () => {
    it('should generate random nonce', () => {
      const nonce = generateNonce();
      
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBe(64); // 32 bytes = 64 hex characters
    });
    
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });
  });
  
  describe('isValidSHA256Hash', () => {
    it('should validate correct hash format', () => {
      const validHash = 'a'.repeat(64);
      expect(isValidSHA256Hash(validHash)).toBe(true);
    });
    
    it('should reject invalid hash formats', () => {
      expect(isValidSHA256Hash('too-short')).toBe(false);
      expect(isValidSHA256Hash('a'.repeat(63))).toBe(false);
      expect(isValidSHA256Hash('a'.repeat(65))).toBe(false);
      expect(isValidSHA256Hash('invalid-characters-!@#$' + 'a'.repeat(42))).toBe(false);
    });
    
    it('should handle edge cases', () => {
      expect(isValidSHA256Hash('')).toBe(false);
      expect(isValidSHA256Hash(null)).toBe(false);
      expect(isValidSHA256Hash(undefined)).toBe(false);
    });
  });
});